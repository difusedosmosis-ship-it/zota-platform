"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { getRealtimeBase, fetchWsToken } from "@/lib/realtime";
import { readSession, type SessionUser } from "@/lib/session";
import { requireRole } from "@/lib/route-guard";

type Conversation = {
  id: string;
  consumerId: string;
  vendorUserId: string;
  vendor?: { businessName?: string | null } | null;
  service?: { title: string; category: { name: string } } | null;
  messages?: Array<{ body: string; createdAt: string }>;
};

type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
};

type CallSession = {
  id: string;
  conversationId: string;
  initiatorId: string;
  recipientId: string;
  status: "RINGING" | "ANSWERED" | "DECLINED" | "ENDED" | "MISSED";
  type: "AUDIO" | "VIDEO";
};

type WsPacket = {
  event: string;
  payload: unknown;
};

type SignalPayload = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type SignalEnvelope = {
  fromUserId: string;
  callId: string;
  conversationId: string;
  signal: SignalPayload;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VendorMessagesPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => readSession()?.user ?? null);
  const myUserId = sessionUser?.id ?? "";

  const [status, setStatus] = useState("Connecting inbox...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingSignalsRef = useRef<SignalEnvelope[]>([]);
  const selectedIdRef = useRef("");
  const activeCallRef = useRef<CallSession | null>(null);

  async function loadConversations() {
    const res = await apiGet<{ ok: boolean; conversations: Conversation[] }>("/chat/conversations");
    if (!res.ok || !res.data) {
      setTone("error");
      setStatus(res.error ?? "Could not load inbox.");
      return;
    }
    setConversations(res.data.conversations);
    if (!selectedId && res.data.conversations[0]) setSelectedId(res.data.conversations[0].id);
  }

  async function loadMessages(conversationId: string) {
    const res = await apiGet<{ ok: boolean; messages: ChatMessage[] }>(`/chat/conversations/${conversationId}/messages`);
    if (!res.ok || !res.data) return;
    setMessages(res.data.messages);
    await apiPost(`/chat/conversations/${conversationId}/read`, {});
  }

  async function setupRealtime() {
    try {
      const token = await fetchWsToken();
      const ws = new WebSocket(`${getRealtimeBase()}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setTone("success");
        setStatus("Vendor inbox connected.");
      };

      ws.onmessage = async (event) => {
        const packet = JSON.parse(event.data) as WsPacket;
        if (packet.event === "chat:message") {
          const payload = packet.payload as { conversationId: string; message: ChatMessage };
          const nextMessage = payload.message;
          if (payload.conversationId === selectedIdRef.current) {
            setMessages((prev) => [...prev, nextMessage]);
            await apiPost(`/chat/conversations/${payload.conversationId}/read`, {});
          }
          void loadConversations();
          return;
        }

        if (packet.event === "call:ringing") {
          setIncomingCall((packet.payload as { call: CallSession }).call);
          return;
        }

        if (packet.event === "call:status") {
          const call = (packet.payload as { call: CallSession }).call;
          setActiveCall(call.status === "ANSWERED" ? call : null);
          if (["DECLINED", "ENDED", "MISSED"].includes(call.status)) {
            teardownCall();
            setIncomingCall(null);
            setActiveCall(null);
          }
          return;
        }

        if (packet.event === "call:signal") {
          const payload = packet.payload as SignalEnvelope;
          if (payload.signal?.description?.type === "offer" && !activeCallRef.current) {
            pendingSignalsRef.current.push(payload);
            return;
          }
          await handleSignal(payload);
        }
      };
    } catch (e) {
      setTone("error");
      setStatus(e instanceof Error ? e.message : "Realtime setup failed.");
    }
  }

  async function ensurePeerConnection(otherUserId: string, callId: string, conversationId: string) {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (!event.candidate || !wsRef.current) return;
      wsRef.current.send(
        JSON.stringify({
          event: "call:signal",
          payload: {
            toUserId: otherUserId,
            callId,
            conversationId,
            signal: { candidate: event.candidate },
          },
        }),
      );
    };

    pc.onconnectionstatechange = async () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        await endCall();
      }
    };

    if (!localStreamRef.current) {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    for (const track of localStreamRef.current.getTracks()) pc.addTrack(track, localStreamRef.current);
    return pc;
  }

  async function handleSignal(payload: SignalEnvelope) {
    const pc = await ensurePeerConnection(payload.fromUserId, payload.callId, payload.conversationId);
    if (payload.signal?.description) {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.signal.description));
      if (payload.signal.description.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(
          JSON.stringify({
            event: "call:signal",
            payload: {
              toUserId: payload.fromUserId,
              callId: payload.callId,
              conversationId: payload.conversationId,
              signal: { description: answer },
            },
          }),
        );
      }
      return;
    }
    if (payload.signal?.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(payload.signal.candidate));
    }
  }

  async function sendMessage() {
    if (!selectedId || !draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    const res = await apiPost<{ ok: boolean; message: ChatMessage }>(`/chat/conversations/${selectedId}/messages`, { body });
    if (!res.ok || !res.data) {
      setTone("error");
      setStatus(res.error ?? "Could not send message.");
      setDraft(body);
      return;
    }
    setMessages((prev) => [...prev, res.data!.message]);
    void loadConversations();
  }

  async function startCall() {
    const conversation = conversations.find((row) => row.id === selectedId);
    if (!conversation) return;

    const res = await apiPost<{ ok: boolean; call: CallSession }>("/chat/calls/start", {
      conversationId: conversation.id,
      type: "AUDIO",
    });
    if (!res.ok || !res.data) {
      setTone("error");
      setStatus(res.error ?? "Could not start call.");
      return;
    }

    const call = res.data.call;
    setActiveCall(call);
    const otherUserId = conversation.consumerId;
    const pc = await ensurePeerConnection(otherUserId, call.id, conversation.id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsRef.current?.send(
      JSON.stringify({
        event: "call:signal",
        payload: {
          toUserId: otherUserId,
          callId: call.id,
          conversationId: conversation.id,
          signal: { description: offer },
        },
      }),
    );
  }

  async function acceptCall() {
    if (!incomingCall) return;
    await apiPost(`/chat/calls/${incomingCall.id}/status`, { status: "ANSWERED" });
    setActiveCall(incomingCall);
    activeCallRef.current = incomingCall;
    setIncomingCall(null);
    for (const signal of pendingSignalsRef.current) {
      await handleSignal(signal);
    }
    pendingSignalsRef.current = [];
  }

  async function declineCall() {
    if (!incomingCall) return;
    await apiPost(`/chat/calls/${incomingCall.id}/status`, { status: "DECLINED" });
    setIncomingCall(null);
    pendingSignalsRef.current = [];
    teardownCall();
  }

  async function endCall() {
    if (activeCall) {
      await apiPost(`/chat/calls/${activeCall.id}/status`, { status: "ENDED" });
    }
    teardownCall();
    setActiveCall(null);
    activeCallRef.current = null;
  }

  function teardownCall() {
    pcRef.current?.close();
    pcRef.current = null;
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) track.stop();
      localStreamRef.current = null;
    }
  }

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "VENDOR");
        if (!session || cancelled) return;
        setSessionUser(session.user);
        await loadConversations();
        await setupRealtime();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      wsRef.current?.close();
      teardownCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setTimeout(() => {
      void loadMessages(selectedId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[320px,1fr] gap-4">
        <aside className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Zota Inbox</h1>
            <span className="text-xs text-gray-500">{conversations.length} chats</span>
          </div>
          <div className="mt-4 space-y-2">
            {conversations.map((row) => (
              <button
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className={`w-full text-left rounded-xl border p-3 ${selectedId === row.id ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white"}`}
              >
                <p className="font-semibold text-gray-900">{row.service?.title ?? "Customer conversation"}</p>
                <p className="text-sm text-gray-500">{row.service?.category.name ?? "Direct inquiry"}</p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-1">{row.messages?.[0]?.body ?? "No messages yet."}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col min-h-[70vh]">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{conversations.find((row) => row.id === selectedId)?.service?.title ?? "Select a conversation"}</h2>
              <p className="text-sm text-gray-500">Realtime chat and audio calls with customers</p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={!selectedId || !!activeCall}
                onClick={() => void startCall()}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
              >
                Audio Call
              </button>
              {activeCall && (
                <button onClick={() => void endCall()} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
                  End Call
                </button>
              )}
            </div>
          </div>

          {incomingCall && (
            <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-emerald-900">Incoming customer call</p>
                <p className="text-sm text-emerald-700">Conversation {incomingCall.conversationId.slice(0, 8)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void acceptCall()} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Answer</button>
                <button onClick={() => void declineCall()} className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700">Decline</button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {messages.map((message) => {
              const mine = message.senderId === myUserId;
              return (
                <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${mine ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                    <p>{message.body}</p>
                    <p className={`mt-1 text-xs ${mine ? "text-indigo-100" : "text-gray-500"}`}>{new Date(message.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              );
            })}
            {!messages.length && <div className="text-sm text-gray-500">Select a conversation to start responding.</div>}
          </div>

          <div className="border-t border-gray-200 pt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Reply to customer..."
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3"
            />
            <button onClick={() => void sendMessage()} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">
              Send
            </button>
          </div>
        </section>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}

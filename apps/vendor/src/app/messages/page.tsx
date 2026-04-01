"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function formatConversationTime(value?: string) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  return sameDay ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : date.toLocaleDateString();
}

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
  const [search, setSearch] = useState("");
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingSignalsRef = useRef<SignalEnvelope[]>([]);
  const selectedIdRef = useRef("");
  const activeCallRef = useRef<CallSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((row) => {
      const haystack = [row.service?.title, row.service?.category.name, row.messages?.[0]?.body]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [conversations, search]);

  const selectedConversation = useMemo(
    () => conversations.find((row) => row.id === selectedId) ?? null,
    [conversations, selectedId],
  );

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
    setMessages(res.data!.messages);
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <aside className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Inbox & calls</p>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Customer threads</h1>
              </div>
              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                {conversations.length} chats
              </span>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services or requests"
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
            />

            <div className="mt-4 space-y-3 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
              {!filteredConversations.length ? (
                <div className="rounded-[22px] bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  No customer conversations yet. New request and service threads will appear here automatically.
                </div>
              ) : (
                filteredConversations.map((row) => {
                  const active = selectedId === row.id;
                  return (
                    <button
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full rounded-[22px] border p-4 text-left transition ${
                        active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-black tracking-[-0.03em] text-slate-950">
                            {row.service?.title ?? "Customer inquiry"}
                          </p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            {row.service?.category.name ?? "Direct request"}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">{formatConversationTime(row.messages?.[0]?.createdAt)}</span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                        {row.messages?.[0]?.body ?? "No messages yet."}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex min-h-[72vh] flex-col rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Active conversation</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
                    {selectedConversation?.service?.title ?? "Select a conversation"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Realtime chat and audio calls with customers</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={!selectedId || !!activeCall}
                    onClick={() => void startCall()}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                  >
                    Start audio call
                  </button>
                  {activeCall && (
                    <button
                      onClick={() => void endCall()}
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                    >
                      End call
                    </button>
                  )}
                </div>
              </div>

              {incomingCall && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
                  <div>
                    <p className="font-semibold text-emerald-950">Incoming customer call</p>
                    <p className="mt-1 text-sm text-emerald-700">A customer is calling from the current service thread.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void acceptCall()} className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
                      Answer
                    </button>
                    <button onClick={() => void declineCall()} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700">
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {activeCall && (
                <div className="mt-4 rounded-[22px] border border-sky-200 bg-sky-50 p-4">
                  <p className="font-semibold text-sky-950">Audio call in progress</p>
                  <p className="mt-1 text-sm text-sky-700">Keep this screen open while you finish the call with the customer.</p>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {!selectedConversation ? (
                <div className="grid min-h-[360px] place-items-center rounded-[24px] bg-slate-50 p-6 text-center">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">No conversation selected</p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                      Select a customer thread to respond, send updates, or start a call.
                    </p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="grid min-h-[360px] place-items-center rounded-[24px] bg-slate-50 p-6 text-center">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">This thread is ready</p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                      Confirm availability, negotiate price, or give the customer a next step.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const mine = message.senderId === myUserId;
                  return (
                    <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[82%] rounded-[24px] px-4 py-3 shadow-sm ${
                          mine ? "bg-emerald-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-900"
                        }`}
                      >
                        <p className="text-sm leading-6">{message.body}</p>
                        <p className={`mt-2 text-[11px] ${mine ? "text-emerald-100/80" : "text-slate-400"}`}>
                          {new Date(message.createdAt).toLocaleString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Reply with ETA, pricing, confirmation, or support details..."
                  className="min-h-[56px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button onClick={() => void sendMessage()} className="self-end rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white">
                  Send
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}

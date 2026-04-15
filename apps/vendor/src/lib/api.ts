import { BACKEND_BASE_URL } from "@/lib/backend-base";

export const API_BASE_URL = BACKEND_BASE_URL;

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  requestId?: string | null;
};

function mapPath(path: string) {
  if (path.startsWith("/api/")) return path;
  return `/api/backend${path.startsWith("/") ? path : `/${path}`}`;
}

function resolveBrowserUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

async function parseResponse<T>(res: Response): Promise<ApiResult<T>> {
  const requestId = res.headers.get("x-request-id");
  const raw = await res.text();
  const parsed = raw ? (JSON.parse(raw) as T & { message?: string }) : undefined;

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      requestId,
      error: parsed && typeof parsed === "object" && "message" in parsed ? parsed.message : "Request failed",
    };
  }

  return { ok: true, status: res.status, data: parsed as T, requestId };
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const url = mapPath(path);
  const fallbackUrl = resolveBrowserUrl(url);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(attempt === 0 ? url : fallbackUrl, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });

      const parsed = await parseResponse<T>(res);
      if (parsed.ok || res.status < 500 || attempt === 1) return parsed;
    } catch {
      if (attempt === 1) {
        return { ok: false, status: 0, error: "Network error", requestId: null };
      }
    }
  }

  return { ok: false, status: 0, error: "Unknown request failure", requestId: null };
}

export function apiGet<T>(path: string) {
  return apiRequest<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body: unknown) {
  return apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown) {
  return apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string) {
  return apiRequest<T>(path, { method: "DELETE" });
}

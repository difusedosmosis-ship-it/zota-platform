export type AppNotification = {
  id: string;
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  read: boolean;
};

const KEY = "zota_notifications_vendor";

export function readNotifications() {
  if (typeof window === "undefined") return [] as AppNotification[];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

export function pushNotification(notification: Omit<AppNotification, "id" | "createdAt" | "read">) {
  if (typeof window === "undefined") return;
  const next: AppNotification = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    read: false,
    ...notification,
  };
  const current = readNotifications();
  window.localStorage.setItem(KEY, JSON.stringify([next, ...current].slice(0, 100)));
}

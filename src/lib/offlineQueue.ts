const QUEUE_KEY = "copiloto-offline-queue";

export interface OfflineAction {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

export function getOfflineQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(action: Omit<OfflineAction, "id" | "createdAt">): void {
  const queue = getOfflineQueue();
  queue.push({
    ...action,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function removeFromQueue(id: string): void {
  const queue = getOfflineQueue().filter(a => a.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function isOnline(): boolean {
  return navigator.onLine;
}

// Local data cache
const CACHE_KEY = "copiloto-data-cache";

export function getCachedData<T>(): T | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedData<T>(data: T): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

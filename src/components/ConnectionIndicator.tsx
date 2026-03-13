import { useState, useEffect } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { getOfflineQueue } from "@/lib/offlineQueue";

export function ConnectionIndicator() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Poll offline queue count every 2s
  useEffect(() => {
    const check = () => setPendingCount(getOfflineQueue().length);
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  if (online && pendingCount === 0) return null;

  if (!online) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/15 text-warning text-[10px] font-semibold">
        <CloudOff className="w-3.5 h-3.5" />
        <span>Offline</span>
        {pendingCount > 0 && (
          <span className="ml-0.5 bg-warning text-warning-foreground rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  // Online but has pending items (syncing)
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      <span>Sincronizando ({pendingCount})</span>
    </div>
  );
}

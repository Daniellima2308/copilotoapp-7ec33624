import { useState, useEffect } from "react";
import { CloudOff, Cloud } from "lucide-react";

export function ConnectionIndicator() {
  const [online, setOnline] = useState(navigator.onLine);

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

  if (online) return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/15 text-warning text-[10px] font-semibold">
      <CloudOff className="w-3.5 h-3.5" />
      <span>Offline</span>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";

export function NotificationPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      const dismissed = sessionStorage.getItem("notif-dismissed");
      if (!dismissed) setShow(true);
    }
  }, []);

  const handleEnable = async () => {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      new Notification("Copiloto 🚛", { body: "Alertas de manutenção ativados!" });
    }
    setShow(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("notif-dismissed", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="rounded-xl p-4 bg-primary/10 border border-primary/20 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/20">
        <Bell className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">Alertas de manutenção</p>
        <p className="text-xs text-muted-foreground">Deseja receber alertas quando a manutenção do seu caminhão estiver próxima?</p>
      </div>
      <div className="flex gap-2">
        <button onClick={handleDismiss} className="text-xs text-muted-foreground px-2 py-1">Não</button>
        <button onClick={handleEnable} className="text-xs font-bold text-primary bg-primary/20 px-3 py-1.5 rounded-lg">Ativar</button>
      </div>
    </div>
  );
}

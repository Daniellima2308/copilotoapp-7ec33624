import { useLocation, useNavigate } from "react-router-dom";
import { Home, Calculator, Truck, ClipboardList, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/", label: "Início", icon: Home, id: "nav-home" },
  { path: "/freight-analysis", label: "Calculadora", icon: Calculator, id: "nav-calculator" },
  { path: "/vehicles", label: "Frota", icon: Truck, id: "nav-vehicles" },
  { path: "/history", label: "Histórico", icon: ClipboardList, id: "nav-history" },
  { path: "/menu", label: "Menu", icon: Settings, id: "nav-menu" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const hiddenPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/new-trip", "/trip/"];
  const shouldHide = hiddenPaths.some((p) => location.pathname.startsWith(p));
  if (shouldHide) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-[72px] max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              id={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isActive ? "text-profit" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_6px_hsl(142_71%_45%/0.5)]")} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn("text-[11px] font-semibold leading-tight", isActive && "text-profit")}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Calculator, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/freight-analysis", label: "Análise", icon: Calculator },
  { path: "/vehicles", label: "Veículos", icon: Truck },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on trip detail / new trip pages
  const hiddenPaths = ["/new-trip", "/trip/"];
  const shouldHide = hiddenPaths.some((p) => location.pathname.startsWith(p));
  if (shouldHide) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

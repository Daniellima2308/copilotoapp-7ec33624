import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X, User, Lock, Wrench, MessageCircle, Lightbulb, LogOut, Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Menu">
          <Menu className="w-6 h-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 bg-card border-border p-0">
        <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-border">
          <h2 className="text-lg font-bold">Menu</h2>
        </div>
        <nav className="px-3 py-4 space-y-1">
          <MenuItem icon={User} label="Meu Perfil" onClick={() => go("/menu")} />
          <MenuItem icon={Lock} label="Alterar Senha" onClick={() => go("/menu")} />
          <MenuItem icon={Wrench} label="Manutenção" onClick={() => go("/maintenance")} />
          <MenuItem icon={Wallet} label="Gastos Pessoais" onClick={() => go("/personal-expenses")} />
          <MenuItem icon={MessageCircle} label="Suporte" onClick={() => go("/menu")} />
          <MenuItem icon={Lightbulb} label="Sugestões" onClick={() => go("/menu")} />
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <button
            onClick={async () => { await signOut(); navigate("/login"); }}
            className="w-full bg-expense/10 hover:bg-expense/20 text-expense rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-bold transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sair da Conta
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-lg p-3 flex items-center gap-3 hover:bg-accent/50 transition-colors">
      <Icon className="w-5 h-5 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

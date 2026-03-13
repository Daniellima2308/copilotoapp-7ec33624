import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, User, Lock, Wrench, MessageCircle, Lightbulb, LogOut, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const SUBJECT_OPTIONS = ["Dúvida", "Problema", "Sugestão", "Outros"] as const;

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // Modal states
  const [showPassword, setShowPassword] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [supportMsg, setSupportMsg] = useState("");
  const [suggestionMsg, setSuggestionMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const go = (path: string) => { setOpen(false); navigate(path); };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
      setNewPassword("");
      setShowPassword(false);
    }
    setSubmitting(false);
  };

  const handleSendSupport = async () => {
    if (!supportMsg.trim() || !user) return;
    setSubmitting(true);
    try {
      await supabase.functions.invoke("send-contact-email", {
        body: { subject_type: "Dúvida", message: supportMsg.trim() },
      });
      toast({ title: "Mensagem enviada!", description: "Nossa equipe vai responder em breve." });
      setSupportMsg("");
      setShowSupport(false);
    } catch {
      toast({ title: "Erro ao enviar", description: "Tente novamente.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleSendSuggestion = async () => {
    if (!suggestionMsg.trim() || !user) return;
    setSubmitting(true);
    try {
      await supabase.functions.invoke("send-contact-email", {
        body: { subject_type: "Sugestão", message: suggestionMsg.trim() },
      });
      toast({ title: "Sugestão enviada!", description: "Obrigado pelo feedback!" });
      setSuggestionMsg("");
      setShowSuggestion(false);
    } catch {
      toast({ title: "Erro ao enviar", description: "Tente novamente.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <>
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
            <MenuItem icon={User} label="Meu Perfil" onClick={() => go("/perfil")} />
            <MenuItem icon={Lock} label="Alterar Senha" onClick={() => { setOpen(false); setShowPassword(true); }} />
            <MenuItem icon={Wrench} label="Manutenção" onClick={() => go("/maintenance")} />
            <MenuItem icon={Wallet} label="Gastos Pessoais" onClick={() => go("/personal-expenses")} />
            <MenuItem icon={MessageCircle} label="Suporte" onClick={() => { setOpen(false); setShowSupport(true); }} />
            <MenuItem icon={Lightbulb} label="Sugestões" onClick={() => { setOpen(false); setShowSuggestion(true); }} />
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
            <button
              onClick={async () => { setOpen(false); await signOut(); navigate("/login"); }}
              className="w-full bg-expense/10 hover:bg-expense/20 text-expense rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-bold transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sair da Conta
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Password Modal */}
      {showPassword && (
        <Modal title="🔒 Alterar Senha" onClose={() => { setShowPassword(false); setNewPassword(""); }}>
          <input
            type="password"
            placeholder="Nova senha (mínimo 6 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input-field w-full text-base py-3"
            minLength={6}
          />
          <button
            onClick={handleChangePassword}
            disabled={submitting}
            className="w-full gradient-profit text-primary-foreground rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {submitting ? "Salvando..." : "Alterar Senha"}
          </button>
        </Modal>
      )}

      {/* Support Modal */}
      {showSupport && (
        <Modal title="💬 Falar com o Suporte" onClose={() => { setShowSupport(false); setSupportMsg(""); }}>
          <textarea
            placeholder="Descreva sua dúvida ou problema..."
            value={supportMsg}
            onChange={(e) => setSupportMsg(e.target.value)}
            className="input-field w-full min-h-[120px] text-base"
          />
          <button
            onClick={handleSendSupport}
            disabled={submitting || !supportMsg.trim()}
            className="w-full gradient-profit text-primary-foreground rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {submitting ? "Enviando..." : "Enviar Mensagem"}
          </button>
        </Modal>
      )}

      {/* Suggestion Modal */}
      {showSuggestion && (
        <Modal title="💡 Caixa de Sugestões" onClose={() => { setShowSuggestion(false); setSuggestionMsg(""); }}>
          <textarea
            placeholder="Compartilhe sua ideia para melhorar o app..."
            value={suggestionMsg}
            onChange={(e) => setSuggestionMsg(e.target.value)}
            className="input-field w-full min-h-[120px] text-base"
          />
          <button
            onClick={handleSendSuggestion}
            disabled={submitting || !suggestionMsg.trim()}
            className="w-full bg-warning text-warning-foreground rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {submitting ? "Enviando..." : "Enviar Sugestão"}
          </button>
        </Modal>
      )}
    </>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-lg p-3 flex items-center gap-3 hover:bg-accent/50 transition-colors">
      <Icon className="w-5 h-5 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

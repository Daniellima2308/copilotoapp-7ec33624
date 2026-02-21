import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  User, Mail, Lock, MessageCircle, Lightbulb, LogOut, ChevronRight, Camera,
} from "lucide-react";

const MenuPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null }>({ display_name: null, avatar_url: null });
  const [showSupport, setShowSupport] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [supportMsg, setSupportMsg] = useState("");
  const [suggestionMsg, setSuggestionMsg] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setEditName(data.display_name || "");
        }
      });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleSendSupport = async () => {
    if (!supportMsg.trim() || !user) return;
    setSubmitting(true);
    await supabase.from("support_messages").insert({ user_id: user.id, message: supportMsg.trim() });
    toast({ title: "Mensagem enviada!", description: "Nossa equipe vai responder em breve." });
    setSupportMsg("");
    setShowSupport(false);
    setSubmitting(false);
  };

  const handleSendSuggestion = async () => {
    if (!suggestionMsg.trim() || !user) return;
    setSubmitting(true);
    await supabase.from("suggestions").insert({ user_id: user.id, suggestion: suggestionMsg.trim() });
    toast({ title: "Sugestão enviada! 💡", description: "Obrigado por ajudar a melhorar o Copiloto!" });
    setSuggestionMsg("");
    setShowSuggestion(false);
    setSubmitting(false);
  };

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
      toast({ title: "Senha alterada!" });
      setNewPassword("");
      setShowPassword(false);
    }
    setSubmitting(false);
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("profiles").update({ display_name: editName.trim() }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setProfile((p) => ({ ...p, display_name: editName.trim() }));
      toast({ title: "Perfil atualizado!" });
      setShowEditProfile(false);
    }
    setSubmitting(false);
  };

  const initials = (profile.display_name || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="px-4 pt-6 pb-6">
        <h1 className="text-xl font-bold">Menu</h1>
      </header>

      <div className="px-4 space-y-6">
        {/* Profile Card */}
        <div className="gradient-card rounded-xl p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-black shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : initials}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold truncate">{profile.display_name || "Motorista"}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        {/* Minha Conta */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Minha Conta</h2>
          <div className="space-y-1">
            <MenuItem icon={User} label="Editar Perfil" onClick={() => setShowEditProfile(true)} />
            <MenuItem icon={Lock} label="Alterar Senha" onClick={() => setShowPassword(true)} />
          </div>
        </section>

        {/* Central de Ajuda */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Central de Ajuda</h2>
          <div className="space-y-1">
            <MenuItem icon={MessageCircle} label="Falar com o Suporte" onClick={() => setShowSupport(true)} />
            <button
              onClick={() => setShowSuggestion(true)}
              className="w-full gradient-card rounded-lg p-4 flex items-center justify-between hover:bg-accent/50 transition-colors border border-warning/30"
            >
              <div className="flex items-center gap-3">
                <Lightbulb className="w-5 h-5 text-warning" />
                <span className="text-sm font-medium text-warning">Caixa de Sugestões</span>
              </div>
              <ChevronRight className="w-4 h-4 text-warning" />
            </button>
            <p className="text-[10px] text-muted-foreground/60 pl-1">Tem uma ideia para melhorar o app? Clique aqui!</p>
          </div>
        </section>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full bg-expense/10 hover:bg-expense/20 text-expense rounded-xl p-4 flex items-center justify-center gap-2 text-base font-bold transition-colors"
        >
          <LogOut className="w-5 h-5" /> SAIR DA CONTA
        </button>
      </div>

      {/* Modals */}
      {showSupport && (
        <Modal title="💬 Falar com o Suporte" onClose={() => setShowSupport(false)}>
          <textarea
            placeholder="Descreva sua dúvida ou problema..."
            value={supportMsg}
            onChange={(e) => setSupportMsg(e.target.value)}
            className="input-field w-full min-h-[120px] text-base"
          />
          <button onClick={handleSendSupport} disabled={submitting || !supportMsg.trim()} className="w-full gradient-profit text-primary-foreground rounded-xl py-3 font-bold disabled:opacity-50">
            Enviar
          </button>
        </Modal>
      )}

      {showSuggestion && (
        <Modal title="💡 Caixa de Sugestões" onClose={() => setShowSuggestion(false)}>
          <textarea
            placeholder="Sua ideia para melhorar o Copiloto..."
            value={suggestionMsg}
            onChange={(e) => setSuggestionMsg(e.target.value)}
            className="input-field w-full min-h-[120px] text-base"
          />
          <button onClick={handleSendSuggestion} disabled={submitting || !suggestionMsg.trim()} className="w-full bg-warning text-warning-foreground rounded-xl py-3 font-bold disabled:opacity-50">
            Enviar Sugestão
          </button>
        </Modal>
      )}

      {showPassword && (
        <Modal title="🔒 Alterar Senha" onClose={() => setShowPassword(false)}>
          <input
            type="password"
            placeholder="Nova senha (mínimo 6 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input-field w-full text-base py-3"
            minLength={6}
          />
          <button onClick={handleChangePassword} disabled={submitting} className="w-full gradient-profit text-primary-foreground rounded-xl py-3 font-bold disabled:opacity-50">
            Alterar Senha
          </button>
        </Modal>
      )}

      {showEditProfile && (
        <Modal title="✏️ Editar Perfil" onClose={() => setShowEditProfile(false)}>
          <input
            type="text"
            placeholder="Seu nome"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="input-field w-full text-base py-3"
          />
          <button onClick={handleUpdateProfile} disabled={submitting} className="w-full gradient-profit text-primary-foreground rounded-xl py-3 font-bold disabled:opacity-50">
            Salvar
          </button>
        </Modal>
      )}
    </div>
  );
};

function MenuItem({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full gradient-card rounded-lg p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
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

export default MenuPage;

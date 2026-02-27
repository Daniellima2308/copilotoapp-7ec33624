import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  User, Lock, MessageCircle, Lightbulb, LogOut, ChevronRight, Camera, Loader2, Wrench, Wallet,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

const SUBJECT_OPTIONS = ["Dúvida", "Problema", "Sugestão", "Outros"] as const;

const MenuPage = () => {
  const { user, signOut } = useAuth();
  const { personalExpensesEnabled, setPersonalExpensesEnabled } = useApp();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null }>({ display_name: null, avatar_url: null });
  const [showContact, setShowContact] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [contactSubject, setContactSubject] = useState<string>(SUBJECT_OPTIONS[0]);
  const [contactMsg, setContactMsg] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSendContact = async () => {
    if (!contactMsg.trim() || !user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: { subject_type: contactSubject, message: contactMsg.trim() },
      });

      if (error) throw error;

      toast({ title: "Mensagem enviada com sucesso!", description: "Nossa equipe vai analisar e responder em breve." });
      setContactMsg("");
      setContactSubject(SUBJECT_OPTIONS[0]);
      setShowContact(false);
    } catch (err) {
      toast({ title: "Erro ao enviar", description: "Tente novamente mais tarde.", variant: "destructive" });
    }
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "O tamanho máximo é 2MB.", variant: "destructive" });
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setProfile((p) => ({ ...p, avatar_url: avatarUrl }));
      toast({ title: "Foto de perfil atualizada com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message || "Tente novamente.", variant: "destructive" });
    }
    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          <button
            type="button"
            className="relative w-16 h-16 rounded-full shrink-0 group"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-black">
                {initials}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center border-2 border-card">
              <Camera className="w-3 h-3 text-primary-foreground" />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
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
            <MenuItem icon={Wrench} label="Manutenção dos Veículos" onClick={() => navigate("/maintenance")} />
          </div>
        </section>

        {/* Central de Ajuda */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Central de Ajuda</h2>
          <div className="space-y-1">
            <MenuItem icon={MessageCircle} label="Falar com o Suporte" onClick={() => { setContactSubject("Dúvida"); setShowContact(true); }} />
            <button
              onClick={() => { setContactSubject("Sugestão"); setShowContact(true); }}
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

        {/* Preferências do App */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Preferências do App</h2>
          <div className="gradient-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Wallet className="w-5 h-5 text-warning shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Controle de Gastos Pessoais</p>
                  <p className="text-[10px] text-muted-foreground/60 leading-tight">Anote gastos com alimentação, banho e pernoite separados do frete.</p>
                </div>
              </div>
              <Switch checked={personalExpensesEnabled} onCheckedChange={setPersonalExpensesEnabled} />
            </div>
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

      {/* Contact Modal (Support + Suggestions unified) */}
      {showContact && (
        <Modal title={contactSubject === "Sugestão" ? "💡 Caixa de Sugestões" : "💬 Falar com o Suporte"} onClose={() => setShowContact(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Assunto</label>
              <select
                value={contactSubject}
                onChange={(e) => setContactSubject(e.target.value)}
                className="input-field w-full py-3 text-base"
              >
                {SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mensagem</label>
              <textarea
                placeholder="Descreva sua dúvida, problema ou sugestão..."
                value={contactMsg}
                onChange={(e) => setContactMsg(e.target.value)}
                className="input-field w-full min-h-[120px] text-base"
              />
            </div>
            <button
              onClick={handleSendContact}
              disabled={submitting || !contactMsg.trim()}
              className={`w-full rounded-xl py-3 font-bold disabled:opacity-50 ${
                contactSubject === "Sugestão"
                  ? "bg-warning text-warning-foreground"
                  : "gradient-profit text-primary-foreground"
              }`}
            >
              {submitting ? "Enviando..." : "Enviar Mensagem"}
            </button>
          </div>
        </Modal>
      )}

      {/* Password Modal */}
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

      {/* Edit Profile Modal */}
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

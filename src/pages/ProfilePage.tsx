import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Camera, Loader2, Pencil, Phone, Wallet, LogOut, Truck, MapPin, TrendingUp, ChevronLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { data, personalExpensesEnabled, setPersonalExpensesEnabled } = useApp();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null; phone: string | null }>({
    display_name: null, avatar_url: null, phone: null,
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit modals
  const [showEditName, setShowEditName] = useState(false);
  const [showEditPhone, setShowEditPhone] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url, phone").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setEditName(data.display_name || "");
          setEditPhone(data.phone || "");
        }
      });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Máximo 2MB.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
      if (updateError) throw updateError;
      setProfile((p) => ({ ...p, avatar_url: avatarUrl }));
      toast({ title: "Foto atualizada!" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      toast({ title: "Erro no upload", description: message, variant: "destructive" });
    }
    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpdateName = async () => {
    if (!editName.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("profiles").update({ display_name: editName.trim() }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setProfile((p) => ({ ...p, display_name: editName.trim() }));
      toast({ title: "Nome atualizado!" });
      setShowEditName(false);
    }
    setSubmitting(false);
  };

  const handleUpdatePhone = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("profiles").update({ phone: editPhone.trim() || null }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setProfile((p) => ({ ...p, phone: editPhone.trim() || null }));
      toast({ title: "Telefone atualizado!" });
      setShowEditPhone(false);
    }
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const initials = (profile.display_name || user?.email || "U").slice(0, 2).toUpperCase();

  // Stats
  const totalTrips = data.trips.length;
  const totalKm = data.trips.reduce((acc, t) => acc + (t.estimatedDistance || 0), 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = data.trips
    .filter((t) => new Date(t.createdAt) >= monthStart)
    .flatMap((t) => t.freights)
    .reduce((acc, f) => acc + (f.grossValue - f.commissionValue), 0);

  // Main vehicle
  const mainVehicle = data.vehicles[0] || null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-accent/50 transition-colors" style={{ minHeight: 52, minWidth: 52 }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Meu Perfil</h1>
      </header>

      <div className="px-4 space-y-6">
        {/* Avatar + Info */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            className="relative w-24 h-24 rounded-full shrink-0 group"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            style={{ minHeight: 52 }}
          >
            {uploadingAvatar ? (
              <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-black">
                {initials}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center border-2 border-card">
              <Camera className="w-4 h-4 text-primary-foreground" />
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

          <div className="text-center">
            <p className="text-lg font-bold">{profile.display_name || "Motorista"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {profile.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
          </div>
        </div>

        {/* Edit buttons */}
        <div className="space-y-2">
          <ProfileButton icon={Pencil} label="Editar Nome" onClick={() => { setEditName(profile.display_name || ""); setShowEditName(true); }} />
          <ProfileButton icon={Phone} label={profile.phone ? "Editar Telefone" : "Adicionar Telefone"} onClick={() => { setEditPhone(profile.phone || ""); setShowEditPhone(true); }} />
        </div>

        {/* Main Vehicle */}
        {mainVehicle && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Veículo Principal</h2>
            <div className="gradient-card rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Truck className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{mainVehicle.brand} {mainVehicle.model}</p>
                <p className="text-xs text-muted-foreground">Placa: {mainVehicle.plate}</p>
                <p className="text-xs text-muted-foreground">KM atual: {mainVehicle.currentKm.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </section>
        )}

        {/* Stats */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Estatísticas</h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={MapPin} label="Viagens" value={String(totalTrips)} />
            <StatCard icon={Truck} label="KM Rodados" value={totalKm.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} />
            <StatCard icon={TrendingUp} label="Faturamento/Mês" value={`R$ ${monthRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} />
          </div>
        </section>

        {/* Preferences */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Preferências</h2>
          <div className="gradient-card rounded-xl p-4">
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
          className="w-full bg-expense/10 hover:bg-expense/20 text-expense rounded-xl flex items-center justify-center gap-2 text-base font-bold transition-colors"
          style={{ minHeight: 52 }}
        >
          <LogOut className="w-5 h-5" /> SAIR DA CONTA
        </button>
      </div>

      {/* Edit Name Modal */}
      {showEditName && (
        <Modal title="✏️ Editar Nome" onClose={() => setShowEditName(false)}>
          <input
            type="text"
            placeholder="Seu nome"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="input-field w-full text-base py-3"
          />
          <button onClick={handleUpdateName} disabled={submitting} className="w-full gradient-profit text-primary-foreground rounded-xl font-bold disabled:opacity-50" style={{ minHeight: 52 }}>
            {submitting ? "Salvando..." : "Salvar"}
          </button>
        </Modal>
      )}

      {/* Edit Phone Modal */}
      {showEditPhone && (
        <Modal title="📱 Editar Telefone" onClose={() => setShowEditPhone(false)}>
          <input
            type="tel"
            placeholder="(11) 99999-9999"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            className="input-field w-full text-base py-3"
          />
          <button onClick={handleUpdatePhone} disabled={submitting} className="w-full gradient-profit text-primary-foreground rounded-xl font-bold disabled:opacity-50" style={{ minHeight: 52 }}>
            {submitting ? "Salvando..." : "Salvar"}
          </button>
        </Modal>
      )}
    </div>
  );
};

function ProfileButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full gradient-card rounded-xl flex items-center gap-3 hover:bg-accent/50 transition-colors px-4" style={{ minHeight: 52 }}>
      <Icon className="w-5 h-5 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="gradient-card rounded-xl p-3 text-center">
      <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
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

export default ProfilePage;

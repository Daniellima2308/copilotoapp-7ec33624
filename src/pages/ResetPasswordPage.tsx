import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { BrandWordmark } from "@/components/branding/BrandWordmark";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    } else {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setReady(true);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) return;
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada!", description: "Sua senha foi atualizada com sucesso." });
      navigate("/");
    }
    setSubmitting(false);
  };

  if (!ready) {
    return <div className="min-h-screen bg-background flex items-center justify-center px-6"><p className="text-muted-foreground">Aguardando verificação...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <BrandWordmark theme="dark" className="h-auto w-full max-w-[240px] mx-auto mb-4" />
          <h1 className="text-2xl font-black">Nova Senha</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" placeholder="Nova senha (mínimo 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field w-full text-base py-4" autoComplete="new-password" minLength={6} />
          <button type="submit" disabled={submitting} className="w-full gradient-profit text-primary-foreground rounded-xl py-4 text-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50">Alterar Senha</button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

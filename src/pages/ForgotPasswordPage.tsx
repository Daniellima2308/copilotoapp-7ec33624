import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { BrandWordmark } from "@/components/branding/BrandWordmark";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <BrandWordmark theme="dark" className="h-auto w-full max-w-[240px] mx-auto mb-4" />
          <h1 className="text-2xl font-black">Esqueci a Senha</h1>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Um link de recuperação foi enviado para <strong className="text-foreground">{email}</strong>.</p>
            <Link to="/login" className="text-primary hover:underline font-medium text-sm">Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" placeholder="Digite seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field w-full text-base py-4" autoComplete="email" />
            <button type="submit" disabled={submitting} className="w-full gradient-profit text-primary-foreground rounded-xl py-4 text-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50">Enviar Link</button>
            <div className="text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Voltar ao login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

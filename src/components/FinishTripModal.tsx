import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  minKm: number;
  activeFreight: { origin: string; destination: string } | null;
  onConfirm: (km: number) => Promise<void>;
  isSubmitting?: boolean;
}

export function FinishTripModal({ open, onClose, minKm, activeFreight, onConfirm, isSubmitting = false }: Props) {
  const [km, setKm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setKm("");
      setError("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(km);
    if (!val || val < minKm) {
      setError(`O KM deve ser no mínimo ${minKm.toLocaleString("pt-BR")}`);
      return;
    }

    await onConfirm(val);
    setKm("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar viagem?</DialogTitle>
          <DialogDescription>
            {activeFreight
              ? "Confirme o KM de chegada para encerrar esta viagem. O frete em andamento será concluído junto para evitar lançamento em aberto."
              : "Confirme o KM de chegada no painel para encerrar esta viagem com os valores lançados até agora."}
          </DialogDescription>
        </DialogHeader>

        {activeFreight && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Frete em andamento será encerrado agora</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {activeFreight.origin} → {activeFreight.destination} será marcado como concluído ao finalizar a viagem.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <input
              type="number"
              placeholder={`KM atual do painel (mín: ${minKm.toLocaleString("pt-BR")})`}
              value={km}
              onChange={(e) => {
                setKm(e.target.value);
                setError("");
              }}
              className="input-field w-full text-lg"
              autoFocus
              disabled={isSubmitting}
            />
            <p className="text-[11px] text-muted-foreground">Use o KM que está no painel neste momento.</p>
            {error && <p className="text-xs text-expense">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isSubmitting} className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 min-h-[44px]">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Finalizando...</> : "Finalizar viagem"}
            </button>
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]">
              Cancelar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

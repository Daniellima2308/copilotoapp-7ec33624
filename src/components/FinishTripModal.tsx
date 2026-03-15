import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  minKm: number;
  activeFreight: { origin: string; destination: string } | null;
  onConfirm: (km: number) => void;
}

export function FinishTripModal({ open, onClose, minKm, activeFreight, onConfirm }: Props) {

  const [km, setKm] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(km);
    if (!val || val < minKm) {
      setError(`O KM deve ser no mínimo ${minKm.toLocaleString("pt-BR")}`);
      return;
    }
    onConfirm(val);
    setKm("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar Viagem</DialogTitle>
          <DialogDescription>{activeFreight ? `Informe o KM de chegada. O frete em andamento (${activeFreight.origin} → ${activeFreight.destination}) será concluído junto com a viagem.` : "Informe o KM de chegada no painel do caminhão."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="number"
              placeholder={`KM Atual (mín: ${minKm.toLocaleString("pt-BR")})`}
              value={km}
              onChange={(e) => { setKm(e.target.value); setError(""); }}
              className="input-field w-full text-lg"
              autoFocus
            />
            {error && <p className="text-xs text-expense mt-1">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold">
              Finalizar
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">
              Cancelar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

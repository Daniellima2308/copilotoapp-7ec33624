import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PendingFreightSummary {
  id: string;
  origin: string;
  destination: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  minKm: number;
  activeFreight: { origin: string; destination: string } | null;
  pendingFreights?: PendingFreightSummary[];
  onConfirm: (params: {
    km: number;
    allowPendingPlanned: boolean;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function FinishTripModal({
  open,
  onClose,
  minKm,
  activeFreight,
  pendingFreights = [],
  onConfirm,
  isSubmitting = false,
}: Props) {
  const [km, setKm] = useState("");
  const [error, setError] = useState("");
  const [plannedAcknowledged, setPlannedAcknowledged] = useState(false);

  const hasPendingPlanned = pendingFreights.length > 0;
  const nextPendingFreight = pendingFreights[0] ?? null;

  useEffect(() => {
    if (!open) {
      setKm("");
      setError("");
      setPlannedAcknowledged(false);
    }
  }, [open]);

  const minKmLabel = useMemo(
    () => minKm.toLocaleString("pt-BR"),
    [minKm],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(km);
    if (!val || val < minKm) {
      setError(`O KM de chegada precisa ser no mínimo ${minKmLabel}.`);
      return;
    }

    if (hasPendingPlanned && !plannedAcknowledged) {
      setError(
        "Confirme primeiro que os trechos não iniciados devem ficar fora do consolidado final.",
      );
      return;
    }

    await onConfirm({
      km: val,
      allowPendingPlanned: plannedAcknowledged,
    });
    setKm("");
    setError("");
    setPlannedAcknowledged(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar esta viagem?</DialogTitle>
          <DialogDescription>
            Confirme o KM do painel para encerrar a operação e consolidar o resultado final desta viagem.
          </DialogDescription>
        </DialogHeader>

        {activeFreight && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">O frete em andamento será encerrado junto</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {activeFreight.origin} → {activeFreight.destination} será marcado como concluído ao finalizar a viagem.
                </p>
              </div>
            </div>
          </div>
        )}

        {hasPendingPlanned && (
          <div className="rounded-lg border border-expense/30 bg-expense/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-expense" />
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Existem trechos ainda não iniciados</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Ao finalizar agora, esses trechos ficam fora do consolidado final da viagem. Nada passa batido sem sua confirmação.
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-background/70 px-2.5 py-2 text-xs text-foreground">
                  <p className="font-medium">
                    {pendingFreights.length === 1
                      ? "Trecho pendente"
                      : `${pendingFreights.length} trechos pendentes`}
                  </p>
                  {nextPendingFreight && (
                    <p className="mt-1 text-muted-foreground">
                      Próximo não iniciado: {nextPendingFreight.origin} → {nextPendingFreight.destination}
                    </p>
                  )}
                </div>
                <label className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={plannedAcknowledged}
                    onChange={(e) => {
                      setPlannedAcknowledged(e.target.checked);
                      setError("");
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                    disabled={isSubmitting}
                  />
                  <span className="leading-relaxed text-muted-foreground">
                    Entendi que os trechos não iniciados não entram no fechamento final desta viagem.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <input
              type="number"
              placeholder={`KM do painel agora (mín: ${minKmLabel})`}
              value={km}
              onChange={(e) => {
                setKm(e.target.value);
                setError("");
              }}
              className="input-field w-full text-lg"
              autoFocus
              disabled={isSubmitting}
            />
            <p className="text-[11px] text-muted-foreground">
              Use o maior KM real já confirmado na operação. Esse valor vira a base do fechamento final da viagem.
            </p>
            {error && <p className="text-xs text-expense">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 gradient-profit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Finalizando...
                </>
              ) : (
                "Finalizar viagem"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

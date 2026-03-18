import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Trip, Freight, Vehicle, FREIGHT_STATUS_LABELS } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  PlayCircle,
  Plus,
  Trash2,
  Ruler,
  Wallet,
  Pencil,
} from "lucide-react";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canEditCommissionPercentForFreight,
  getDefaultCommissionPercentForVehicle,
  profileUsesFixedCommission,
  shouldShowCommissionFieldByDefault,
  shouldShowCommissionToggle,
} from "@/lib/vehicleOperation";

interface FreightTabProps {
  trip: Trip;
  vehicle?: Vehicle;
  isOpen: boolean;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  addFreight: (
    tripId: string,
    f: Omit<
      Freight,
      "id" | "tripId" | "commissionValue" | "status" | "estimatedDistance"
    >,
  ) => Promise<void>;
  updateFreight: (
    tripId: string,
    freightId: string,
    f: Omit<
      Freight,
      "id" | "tripId" | "commissionValue" | "status" | "estimatedDistance"
    >,
  ) => Promise<void>;
  deleteFreight: (tripId: string, freightId: string) => Promise<void>;
  startFreight: (tripId: string, freightId: string) => Promise<void>;
  completeFreight: (
    tripId: string,
    freightId: string,
    option?: "complete_only" | "start_next_if_planned",
  ) => Promise<{ promotedFreightId?: string | null }>;
  onRequestOpenFreightForm?: () => void;
}

export function FreightTab({
  trip,
  vehicle,
  isOpen,
  showForm,
  setShowForm,
  addFreight,
  updateFreight,
  deleteFreight,
  startFreight,
  completeFreight,
  onRequestOpenFreightForm,
}: FreightTabProps) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [km, setKm] = useState("");
  const [gross, setGross] = useState("");
  const [useCommission, setUseCommission] = useState(false);
  const [comm, setComm] = useState("");
  const [finishingFreight, setFinishingFreight] = useState<Freight | null>(
    null,
  );
  const [editingKmFreight, setEditingKmFreight] = useState<Freight | null>(
    null,
  );
  const [routeReviewFreight, setRouteReviewFreight] = useState<Freight | null>(
    null,
  );
  const [editOrigin, setEditOrigin] = useState("");
  const [editDestination, setEditDestination] = useState("");
  const [editKmInitial, setEditKmInitial] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishingFreight, setIsFinishingFreight] = useState(false);
  const [isSavingKm, setIsSavingKm] = useState(false);
  const [isSavingRouteReview, setIsSavingRouteReview] = useState(false);
  const [pendingStartId, setPendingStartId] = useState<string | null>(null);
  const { toast } = useToast();

  const defaultCommission = useMemo(
    () => getDefaultCommissionPercentForVehicle(vehicle),
    [vehicle],
  );
  const usesFixedCommission = vehicle
    ? profileUsesFixedCommission(vehicle.operationProfile)
    : false;
  const isDriverOwnerProfile = vehicle?.operationProfile === "driver_owner";
  const showToggle = vehicle
    ? isDriverOwnerProfile ||
      shouldShowCommissionToggle(vehicle.operationProfile)
    : true;
  const showCommissionInput = vehicle
    ? usesFixedCommission || (showToggle && useCommission)
    : useCommission;

  useEffect(() => {
    if (!showForm) return;

    if (
      vehicle &&
      shouldShowCommissionFieldByDefault(vehicle.operationProfile)
    ) {
      setUseCommission(true);
      setComm(defaultCommission.toString());
      return;
    }

    setUseCommission(false);
    setComm("");
  }, [showForm, vehicle, defaultCommission]);

  const statusClassByFreight: Record<Freight["status"], string> = {
    planned: "bg-secondary text-muted-foreground border-border",
    in_progress: "bg-warning/15 text-warning border-warning/30",
    completed: "bg-profit/15 text-profit border-profit/30",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !dest || !km || !gross || isSubmitting) return;
    if (showCommissionInput && !comm) return;

    const commissionPercent = showCommissionInput ? parseFloat(comm) : 0;

    try {
      setIsSubmitting(true);
      await addFreight(trip.id, {
        origin,
        destination: dest,
        kmInitial: parseFloat(km),
        grossValue: parseFloat(gross),
        commissionPercent,
        createdAt: new Date().toISOString(),
      });
      setOrigin("");
      setDest("");
      setKm("");
      setGross("");
      setUseCommission(false);
      setComm("");
      setShowForm(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar este frete agora.";
      toast({
        title: "Não foi possível salvar agora",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartFreight = async (freightId: string) => {
    if (pendingStartId) return;
    try {
      setPendingStartId(freightId);
      await startFreight(trip.id, freightId);
    } finally {
      setPendingStartId(null);
    }
  };

  const handleCompleteWithOption = async (
    option: "complete_only" | "start_next_if_planned",
  ) => {
    if (!finishingFreight || isFinishingFreight) return;
    try {
      setIsFinishingFreight(true);
      const { promotedFreightId } = await completeFreight(
        trip.id,
        finishingFreight.id,
        option,
      );
      const hadPlannedFreight = trip.freights.some(
        (f) => f.status === "planned" && f.id !== finishingFreight.id,
      );

      if (option === "start_next_if_planned") {
        if (promotedFreightId) {
          toast({
            title: "Frete concluído",
            description: "Próximo frete iniciado.",
          });
        } else {
          onRequestOpenFreightForm?.();
          toast({
            title: "Frete concluído",
            description: "Agora você pode lançar o próximo frete.",
          });
        }
      } else if (!hadPlannedFreight) {
        toast({
          title: "Frete concluído",
          description: "Viagem pronta para finalizar quando você quiser.",
        });
      } else {
        toast({
          title: "Frete concluído",
          description: "Próximo frete ficou aguardando início.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tenta novamente.";
      toast({
        title: "Não deu para concluir o frete",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsFinishingFreight(false);
      setFinishingFreight(null);
    }
  };

  const openEditKmDialog = (freight: Freight) => {
    setEditingKmFreight(freight);
    setEditKmInitial(String(freight.kmInitial));
  };

  const openRouteReviewDialog = (freight: Freight) => {
    setRouteReviewFreight(freight);
    setEditOrigin(freight.origin);
    setEditDestination(freight.destination);
  };

  const handleSaveKmEdit = async () => {
    if (!editingKmFreight || isSavingKm) return;

    const parsedKm = Number(editKmInitial);
    if (!Number.isFinite(parsedKm)) return;

    try {
      setIsSavingKm(true);
      await updateFreight(trip.id, editingKmFreight.id, {
        origin: editingKmFreight.origin,
        destination: editingKmFreight.destination,
        kmInitial: parsedKm,
        grossValue: editingKmFreight.grossValue,
        commissionPercent: editingKmFreight.commissionPercent,
        createdAt: editingKmFreight.createdAt,
      });

      setEditingKmFreight(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tenta novamente.";
      toast({
        title: "Não foi possível salvar agora",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingKm(false);
    }
  };

  const handleSaveRouteReview = async () => {
    if (!routeReviewFreight || isSavingRouteReview) return;
    if (!editOrigin.trim() || !editDestination.trim()) return;

    try {
      setIsSavingRouteReview(true);
      await updateFreight(trip.id, routeReviewFreight.id, {
        origin: editOrigin.trim(),
        destination: editDestination.trim(),
        kmInitial: routeReviewFreight.kmInitial,
        grossValue: routeReviewFreight.grossValue,
        commissionPercent: routeReviewFreight.commissionPercent,
        createdAt: routeReviewFreight.createdAt,
      });

      toast({
        title: "Rota revisada",
        description:
          "Salvamos origem e destino de novo para tentar liberar a previsão deste trecho.",
      });
      setRouteReviewFreight(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tenta novamente.";
      toast({
        title: "Não foi possível revisar a rota agora",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingRouteReview(false);
    }
  };

  const hasPlannedFreight = trip.freights.some(
    (freight) => freight.status === "planned",
  );
  const hasInProgressFreight = trip.freights.some(
    (freight) => freight.status === "in_progress",
  );

  return (
    <div className="space-y-2">
      {trip.freights.length === 0 && (
        <div className="gradient-card rounded-xl border border-dashed border-border/70 p-4">
          <p className="text-sm font-semibold text-foreground">
            Ainda não tem frete nesta viagem.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Cadastre o primeiro trecho para começar a acompanhar bruto,
            comissão, KM e progresso no hero.
          </p>
        </div>
      )}

      {trip.freights.length > 0 && !hasInProgressFreight && (
        <div className="rounded-xl border border-border/70 bg-secondary/35 p-3">
          <p className="text-xs font-semibold text-foreground">
            {hasPlannedFreight
              ? "Tem frete aguardando início."
              : "Nenhum frete está rodando agora."}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {hasPlannedFreight
              ? "Toque em Iniciar no próximo trecho para voltar a acompanhar o andamento da viagem em tempo real."
              : "Se os trechos já acabaram, você pode revisar os lançamentos e finalizar a viagem quando achar melhor."}
          </p>
        </div>
      )}

      {trip.freights.map((f: Freight) => (
        <div key={f.id} className="gradient-card rounded-xl p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span>
                  {f.origin} → {f.destination}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClassByFreight[f.status]}`}
                >
                  {FREIGHT_STATUS_LABELS[f.status]}
                </span>
                <p className="text-xs text-muted-foreground">
                  Trecho cadastrado neste frete.
                </p>
              </div>
            </div>
            {isOpen && (
              <button
                onClick={() => deleteFreight(trip.id, f.id)}
                className="p-1"
              >
                <Trash2 className="w-3.5 h-3.5 text-expense" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-md bg-secondary/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Bruto
              </p>
              <p className="text-sm font-mono font-bold text-profit">
                {formatCurrency(f.grossValue)}
              </p>
            </div>
            <div className="rounded-md bg-secondary/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Wallet className="w-3 h-3" />
                {isDriverOwnerProfile ? "Retirada" : "Comissão"}
              </p>
              <p className="text-sm font-mono font-bold">
                {formatCurrency(f.commissionValue)}
              </p>
            </div>
            <div className="rounded-md bg-secondary/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Ruler className="w-3 h-3" />
                KM inicial
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-mono font-bold">
                  {formatNumber(f.kmInitial)} km
                </p>
                {isOpen && (
                  <button
                    onClick={() => openEditKmDialog(f)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Editar KM inicial"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md bg-secondary/60 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              KM estimado
            </p>
            <p className="text-sm font-mono font-bold">
              {formatNumber(f.estimatedDistance || 0)} km
            </p>
            {f.estimatedDistance <= 0 && (
              <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
                <p className="text-xs font-semibold text-foreground">
                  Sem previsão no momento
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Ainda não conseguimos estimar a distância deste trecho. Você
                  pode seguir lançando a viagem normalmente e revisar origem e
                  destino para tentar liberar a previsão.
                </p>
                <button
                  type="button"
                  onClick={() => openRouteReviewDialog(f)}
                  className="mt-2 inline-flex min-h-[44px] items-center rounded-lg border border-border/70 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-background"
                >
                  Revisar rota
                </button>
              </div>
            )}
          </div>

          {isOpen && (
            <div className="flex flex-wrap gap-2">
              {f.status !== "in_progress" && f.status !== "completed" && (
                <button
                  onClick={() => handleStartFreight(f.id)}
                  disabled={pendingStartId === f.id}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pendingStartId === f.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlayCircle className="w-3.5 h-3.5" />
                  )}{" "}
                  Iniciar
                </button>
              )}
              {f.status === "in_progress" && (
                <button
                  onClick={() => setFinishingFreight(f)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {isOpen &&
        (showForm ? (
          <form
            onSubmit={handleSubmit}
            className="gradient-card rounded-xl p-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <CityAutocomplete
                placeholder="Origem"
                value={origin}
                onChange={setOrigin}
                className="input-field"
              />
              <CityAutocomplete
                placeholder="Destino"
                value={dest}
                onChange={setDest}
                className="input-field"
              />
              <input
                placeholder="KM Inicial"
                type="number"
                min="0"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                className="input-field"
                disabled={isSubmitting}
              />
              <input
                placeholder="Valor Bruto (R$)"
                type="number"
                step="0.01"
                min="0.01"
                value={gross}
                onChange={(e) => setGross(e.target.value)}
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            {showToggle && (
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={useCommission}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const shouldUse = e.target.checked;
                    setUseCommission(shouldUse);
                    if (!shouldUse) setComm("");
                  }}
                />
                {isDriverOwnerProfile
                  ? "Separar minha retirada neste frete?"
                  : "Usar comissão neste frete?"}
              </label>
            )}

            {usesFixedCommission && (
              <p className="text-xs text-muted-foreground">
                {isDriverOwnerProfile
                  ? "Retirada aplicada"
                  : "Comissão aplicada"}
                : {defaultCommission}%
              </p>
            )}

            {showCommissionInput && (
              <input
                placeholder={
                  isDriverOwnerProfile ? "Retirada (%)" : "Comissão (%)"
                }
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={comm}
                onChange={(e) => setComm(e.target.value)}
                disabled={
                  isSubmitting || !canEditCommissionPercentForFreight(vehicle)
                }
                className="input-field"
              />
            )}

            {!showToggle && vehicle?.operationProfile === "driver_owner" && (
              <p className="text-xs text-muted-foreground">
                Neste perfil, os fretes entram sem retirada e o foco fica no
                líquido da viagem.
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  "Salvar frete"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full border border-dashed border-border rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm font-medium min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Novo Frete
          </button>
        ))}

      <Dialog
        open={!!finishingFreight}
        onOpenChange={(open) =>
          !open && !isFinishingFreight && setFinishingFreight(null)
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir frete atual?</DialogTitle>
            <DialogDescription>
              {finishingFreight
                ? `Você vai encerrar o trecho ${finishingFreight.origin} → ${finishingFreight.destination}. Se houver outro frete planejado, dá para iniciar na sequência.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground leading-relaxed">
            Toque em{" "}
            <span className="font-semibold text-foreground">
              Iniciar próximo frete
            </span>{" "}
            para já seguir com o próximo trecho planejado. Se preferir, conclua
            só este frete e decida depois.
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <button
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              disabled={isFinishingFreight}
              onClick={() => handleCompleteWithOption("start_next_if_planned")}
            >
              {isFinishingFreight ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Concluindo...
                </>
              ) : (
                "Concluir e iniciar próximo"
              )}
            </button>
            <button
              className="w-full rounded-md border px-3 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isFinishingFreight}
              onClick={() => handleCompleteWithOption("complete_only")}
            >
              Só concluir este frete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingKmFreight}
        onOpenChange={(open) =>
          !open && !isSavingKm && setEditingKmFreight(null)
        }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar KM inicial</DialogTitle>
            <DialogDescription>
              Ajuste o KM deste frete. O progresso da viagem será recalculado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              value={editKmInitial}
              onChange={(e) => setEditKmInitial(e.target.value)}
              type="number"
              min="0"
              className="input-field"
              disabled={isSavingKm}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveKmEdit}
                disabled={isSavingKm}
                className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isSavingKm ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  "Salvar ajuste"
                )}
              </button>
              <button
                onClick={() => setEditingKmFreight(null)}
                disabled={isSavingKm}
                className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!routeReviewFreight}
        onOpenChange={(open) =>
          !open && !isSavingRouteReview && setRouteReviewFreight(null)
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revisar rota deste frete</DialogTitle>
            <DialogDescription>
              Confira origem e destino. Ao salvar de novo, o app tenta liberar a
              previsão deste trecho.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3">
              <CityAutocomplete
                placeholder="Origem"
                value={editOrigin}
                onChange={setEditOrigin}
                className="input-field"
              />
              <CityAutocomplete
                placeholder="Destino"
                value={editDestination}
                onChange={setEditDestination}
                className="input-field"
              />
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
              Você pode continuar usando a viagem normalmente. Esta revisão só
              tenta destravar a previsão da rota para este trecho.
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveRouteReview}
                disabled={
                  isSavingRouteReview ||
                  !editOrigin.trim() ||
                  !editDestination.trim()
                }
                className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isSavingRouteReview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  "Salvar e tentar previsão"
                )}
              </button>
              <button
                onClick={() => setRouteReviewFreight(null)}
                disabled={isSavingRouteReview}
                className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

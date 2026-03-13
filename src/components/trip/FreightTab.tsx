import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Trip, Freight, Vehicle, FREIGHT_STATUS_LABELS } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { CheckCircle2, MapPin, PlayCircle, Plus, Trash2, Ruler, Wallet, Pencil } from "lucide-react";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  addFreight: (tripId: string, f: Omit<Freight, "id" | "tripId" | "commissionValue" | "status" | "estimatedDistance">) => Promise<void>;
  updateFreight: (tripId: string, freightId: string, f: Omit<Freight, "id" | "tripId" | "commissionValue" | "status" | "estimatedDistance">) => Promise<void>;
  deleteFreight: (tripId: string, freightId: string) => Promise<void>;
  startFreight: (tripId: string, freightId: string) => Promise<void>;
  completeFreight: (
    tripId: string,
    freightId: string,
    option?: "complete_only" | "start_next_if_planned",
  ) => Promise<{ promotedFreightId?: string | null }>;
  onRequestOpenFreightForm?: () => void;
}

export function FreightTab({ trip, vehicle, isOpen, showForm, setShowForm, addFreight, updateFreight, deleteFreight, startFreight, completeFreight, onRequestOpenFreightForm }: FreightTabProps) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [km, setKm] = useState("");
  const [gross, setGross] = useState("");
  const [useCommission, setUseCommission] = useState(false);
  const [comm, setComm] = useState("");
  const [finishingFreight, setFinishingFreight] = useState<Freight | null>(null);
  const [editingFreight, setEditingFreight] = useState<Freight | null>(null);
  const [editKmInitial, setEditKmInitial] = useState("");
  const { toast } = useToast();

  const defaultCommission = useMemo(() => getDefaultCommissionPercentForVehicle(vehicle), [vehicle]);
  const usesFixedCommission = vehicle ? profileUsesFixedCommission(vehicle.operationProfile) : false;
  const isDriverOwnerProfile = vehicle?.operationProfile === "driver_owner";
  const showToggle = vehicle ? (isDriverOwnerProfile || shouldShowCommissionToggle(vehicle.operationProfile)) : true;
  const showCommissionInput = vehicle
    ? (usesFixedCommission || (showToggle && useCommission))
    : useCommission;

  useEffect(() => {
    if (!showForm) return;

    if (vehicle && shouldShowCommissionFieldByDefault(vehicle.operationProfile)) {
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
    if (!origin || !dest || !km || !gross) return;
    if (showCommissionInput && !comm) return;

    const commissionPercent = showCommissionInput ? parseFloat(comm) : 0;

    try {
      await addFreight(trip.id, { origin, destination: dest, kmInitial: parseFloat(km), grossValue: parseFloat(gross), commissionPercent, createdAt: new Date().toISOString() });
      setOrigin("");
      setDest("");
      setKm("");
      setGross("");
      setUseCommission(false);
      setComm("");
      setShowForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar este frete agora.";
      toast({ title: "Não deu para salvar", description: message, variant: "destructive" });
    }
  };

  const handleCompleteWithOption = async (option: "complete_only" | "start_next_if_planned") => {
    if (!finishingFreight) return;
    try {
      const { promotedFreightId } = await completeFreight(trip.id, finishingFreight.id, option);
      const hadPlannedFreight = trip.freights.some((f) => f.status === "planned" && f.id !== finishingFreight.id);

      if (option === "start_next_if_planned") {
        if (promotedFreightId) {
          toast({ title: "Frete concluído", description: "Próximo frete iniciado e hero atualizado." });
        } else {
          onRequestOpenFreightForm?.();
          toast({ title: "Frete concluído", description: "Cadastre o próximo frete para continuar a viagem." });
        }
      } else if (!hadPlannedFreight) {
        toast({ title: "Frete concluído", description: "Sem frete em andamento. Você pode finalizar a viagem quando quiser." });
      } else {
        toast({ title: "Frete concluído", description: "Próximo frete ficou como planejado aguardando início." });
      }
    } finally {
      setFinishingFreight(null);
    }
  };

  const openEditKmDialog = (freight: Freight) => {
    setEditingFreight(freight);
    setEditKmInitial(String(freight.kmInitial));
  };

  const handleSaveKmEdit = async () => {
    if (!editingFreight) return;

    const parsedKm = Number(editKmInitial);
    if (!Number.isFinite(parsedKm)) return;

    await updateFreight(trip.id, editingFreight.id, {
      origin: editingFreight.origin,
      destination: editingFreight.destination,
      kmInitial: parsedKm,
      grossValue: editingFreight.grossValue,
      commissionPercent: editingFreight.commissionPercent,
      createdAt: editingFreight.createdAt,
    });

    toast({ title: "KM inicial atualizado", description: "Odômetro, hero e progresso foram recalculados." });
    setEditingFreight(null);
  };

  return (
    <div className="space-y-2">
      {trip.freights.map((f: Freight) => (
        <div key={f.id} className="gradient-card rounded-xl p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{f.origin} → {f.destination}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClassByFreight[f.status]}`}>{FREIGHT_STATUS_LABELS[f.status]}</span>
                <p className="text-xs text-muted-foreground">Trecho cadastrado neste frete.</p>
              </div>
            </div>
            {isOpen && <button onClick={() => deleteFreight(trip.id, f.id)} className="p-1"><Trash2 className="w-3.5 h-3.5 text-expense" /></button>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-md bg-secondary/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bruto</p>
              <p className="text-sm font-mono font-bold text-profit">{formatCurrency(f.grossValue)}</p>
            </div>
            <div className="rounded-md bg-secondary/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Wallet className="w-3 h-3" />{isDriverOwnerProfile ? "Retirada" : "Comissão"}</p>
              <p className="text-sm font-mono font-bold">{formatCurrency(f.commissionValue)}</p>
            </div>
            <div className="rounded-md bg-secondary/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Ruler className="w-3 h-3" />KM inicial</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-mono font-bold">{formatNumber(f.kmInitial)} km</p>
                {isOpen && (
                  <button onClick={() => openEditKmDialog(f)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Editar KM inicial">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md bg-secondary/60 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">KM estimado</p>
            <p className="text-sm font-mono font-bold">{formatNumber(f.estimatedDistance || 0)} km</p>
          </div>

          {isOpen && (
            <div className="flex flex-wrap gap-2">
              {f.status !== "in_progress" && f.status !== "completed" && (
                <button onClick={() => startFreight(trip.id, f.id)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary">
                  <PlayCircle className="w-3.5 h-3.5" /> Iniciar
                </button>
              )}
              {f.status === "in_progress" && (
                <button onClick={() => setFinishingFreight(f)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {isOpen && (showForm ? (
        <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <CityAutocomplete placeholder="Origem" value={origin} onChange={setOrigin} className="input-field" />
            <CityAutocomplete placeholder="Destino" value={dest} onChange={setDest} className="input-field" />
            <input placeholder="KM Inicial" type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} className="input-field" />
            <input placeholder="Valor Bruto (R$)" type="number" step="0.01" min="0.01" value={gross} onChange={(e) => setGross(e.target.value)} className="input-field" />
          </div>

          {showToggle && (
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={useCommission}
                onChange={(e) => {
                  const shouldUse = e.target.checked;
                  setUseCommission(shouldUse);
                  if (!shouldUse) setComm("");
                }}
              />
              {isDriverOwnerProfile ? "Separar minha retirada neste frete?" : "Usar comissão neste frete?"}
            </label>
          )}

          {usesFixedCommission && (
            <p className="text-xs text-muted-foreground">{isDriverOwnerProfile ? "Retirada aplicada" : "Comissão aplicada"}: {defaultCommission}%</p>
          )}

          {showCommissionInput && (
            <input
              placeholder={isDriverOwnerProfile ? "Retirada (%)" : "Comissão (%)"}
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={comm}
              onChange={(e) => setComm(e.target.value)}
              disabled={!canEditCommissionPercentForFreight(vehicle)}
              className="input-field"
            />
          )}

          {!showToggle && vehicle?.operationProfile === "driver_owner" && (
            <p className="text-xs text-muted-foreground">Neste perfil, os fretes entram sem retirada e o foco fica no líquido da viagem.</p>
          )}

          <div className="flex gap-2">
            <button type="submit" className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold">Salvar</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">Cancelar</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full border border-dashed border-border rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" /> Novo Frete
        </button>
      ))}

      <Dialog open={!!finishingFreight} onOpenChange={(open) => !open && setFinishingFreight(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir frete atual?</DialogTitle>
            <DialogDescription>
              O frete em andamento será marcado como concluído. Você deseja iniciar outro frete agora?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" onClick={() => handleCompleteWithOption("start_next_if_planned")}>Iniciar outro frete agora</button>
            <button className="w-full rounded-md border px-3 py-2 text-sm font-semibold" onClick={() => handleCompleteWithOption("complete_only")}>Só concluir este frete</button>
            <button className="w-full rounded-md bg-secondary px-3 py-2 text-sm" onClick={() => setFinishingFreight(null)}>Cancelar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingFreight} onOpenChange={(open) => !open && setEditingFreight(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar KM inicial</DialogTitle>
            <DialogDescription>
              Atualize apenas o KM inicial deste frete. O Copiloto recalcula odômetro e hero automaticamente.
            </DialogDescription>
          </DialogHeader>
          <input
            type="number"
            min="0"
            value={editKmInitial}
            onChange={(e) => setEditKmInitial(e.target.value)}
            className="input-field"
            placeholder="KM inicial"
          />
          <DialogFooter>
            <button className="rounded-md bg-secondary px-3 py-2 text-sm" onClick={() => setEditingFreight(null)}>Cancelar</button>
            <button className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" onClick={handleSaveKmEdit}>Salvar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

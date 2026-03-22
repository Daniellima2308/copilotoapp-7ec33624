import { useState } from "react";
import { Trip, Fueling } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { Fuel, Droplets, Loader2, Pencil, Trash2, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { DeleteConfirmDialog } from "@/components/trip/DeleteConfirmDialog";

interface FuelTabProps {
  trip: Trip;
  isOpen: boolean;
  addFueling: (tripId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => Promise<void>;
  updateFueling: (tripId: string, fuelingId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => Promise<void>;
  deleteFueling: (tripId: string, fuelingId: string) => Promise<void>;
}

function FuelForm({
  initial,
  onSubmit,
  onCancel,
  isEdit,
  isSubmitting,
}: {
  initial?: Partial<Fueling>;
  onSubmit: (data: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
  isSubmitting: boolean;
}) {
  const [station, setStation] = useState(initial?.stationName || "");
  const [value, setValue] = useState(initial?.totalValue != null ? String(initial.originalTotalValue ?? initial.totalValue) : "");
  const [liters, setLiters] = useState(initial?.liters != null ? String(initial.liters) : "");
  const [kmCur, setKmCur] = useState(initial?.kmCurrent != null ? String(initial.kmCurrent) : "");
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [fullTank, setFullTank] = useState(initial?.fullTank ?? true);
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(initial?.receiptUrl);

  const calcPricePerLiter = () => {
    const v = parseFloat(value);
    const l = parseFloat(liters);
    if (v > 0 && l > 0) return (v / l).toFixed(3);
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!station || !value || !liters || !kmCur || isSubmitting) return;
    await onSubmit({
      stationName: station,
      totalValue: parseFloat(value),
      liters: parseFloat(liters),
      kmCurrent: parseFloat(kmCur),
      date,
      fullTank,
      receiptUrl,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Nome do Posto" value={station} onChange={(e) => setStation(e.target.value)} className="input-field col-span-2" disabled={isSubmitting} />
        <input placeholder="Valor Total (R$)" type="number" step="0.01" min="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="input-field" disabled={isSubmitting} />
        <input placeholder="Litros" type="number" step="0.01" min="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} className="input-field" disabled={isSubmitting} />
        <input placeholder="Odômetro Atual (KM)" type="number" min="0" value={kmCur} onChange={(e) => setKmCur(e.target.value)} className="input-field" disabled={isSubmitting} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" disabled={isSubmitting} />
      </div>
      {calcPricePerLiter() && (
        <div className="flex items-center gap-2 px-1 py-1.5 rounded-md bg-profit/10">
          <Fuel className="w-3.5 h-3.5 text-profit" />
          <span className="text-xs font-semibold text-profit">Preço/L: R$ {calcPricePerLiter()}</span>
        </div>
      )}
      <div className="flex items-center gap-3 py-1">
        <Switch id={`fullTank-${isEdit ? 'edit' : 'new'}`} checked={fullTank} onCheckedChange={setFullTank} disabled={isSubmitting} />
        <Label htmlFor={`fullTank-${isEdit ? 'edit' : 'new'}`} className="text-sm font-medium cursor-pointer">Foi tanque cheio?</Label>
      </div>
      <ReceiptUpload value={receiptUrl} onChange={setReceiptUrl} />
      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting} className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">{isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {isEdit ? 'Atualizando...' : 'Salvando...'}</> : isEdit ? "Atualizar abastecimento" : "Salvar abastecimento"}</button>
        <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed">Cancelar</button>
      </div>
    </form>
  );
}

export function FuelTab({ trip, isOpen, addFueling, updateFueling, deleteFueling }: FuelTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [fuelingToDelete, setFuelingToDelete] = useState<Fueling | null>(null);
  const [isDeletingFueling, setIsDeletingFueling] = useState(false);

  const handleAdd = async (data: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => {
    try {
      setSubmittingKey("new");
      await addFueling(trip.id, data);
      setShowNewForm(false);
    } finally {
      setSubmittingKey(null);
    }
  };

  const handleUpdate = async (fuelingId: string, data: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => {
    try {
      setSubmittingKey(fuelingId);
      await updateFueling(trip.id, fuelingId, data);
      setExpandedId(null);
    } finally {
      setSubmittingKey(null);
    }
  };

  const handleDeleteFueling = async () => {
    if (!fuelingToDelete || isDeletingFueling) return;

    try {
      setIsDeletingFueling(true);
      await deleteFueling(trip.id, fuelingToDelete.id);
      setFuelingToDelete(null);
    } finally {
      setIsDeletingFueling(false);
    }
  };

  return (
    <>
    <div className="space-y-2">
      {trip.fuelings.length === 0 && (
        <div className="gradient-card rounded-xl border border-dashed border-border/70 p-4">
          <p className="text-sm font-semibold text-foreground">Ainda não há abastecimento lançado.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Quando entrar o primeiro abastecimento, o Copiloto começa a montar média, custo e uma leitura mais fiel da viagem.
          </p>
        </div>
      )}

      {trip.fuelings.map((f: Fueling) => {
        const isFullTank = f.fullTank ?? true;
        const isProrated = f.allocatedValue != null && f.originalTotalValue != null;
        const displayValue = isProrated ? f.allocatedValue! : f.totalValue;
        const isExpanded = expandedId === f.id;

        return (
          <div key={f.id} className="space-y-0">
            <div className={`gradient-card p-3 ${isExpanded ? "rounded-t-lg" : "rounded-lg"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-md ${isFullTank ? "bg-profit/15" : "bg-warning/15"}`}>
                    {isFullTank ? <Fuel className="w-4 h-4 text-profit" /> : <Droplets className="w-4 h-4 text-warning" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{f.stationName}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(f.liters)}L • R$ {formatNumber(f.pricePerLiter)}/L</p>
                    {(() => {
                      const freightKms = trip.freights.map((fr) => fr.kmInitial).filter((k: number) => k > 0);
                      const firstFuelingKm = trip.fuelings[0]?.kmCurrent ?? f.kmCurrent;
                      const tripStartKm = freightKms.length > 0 ? Math.min(...freightKms, firstFuelingKm) : firstFuelingKm;
                      const fIdx = trip.fuelings.findIndex((fu: Fueling) => fu.id === f.id);
                      const isInitialFueling = fIdx === 0 || f.kmCurrent === tripStartKm;
                      if (isInitialFueling && f.average > 0) {
                        return (
                          <p className="text-xs font-semibold text-profit flex items-center gap-1">
                            Média: {formatNumber(f.average)} km/l
                            <span
                              title="Média calculada comparando este tanque cheio com o último tanque cheio válido do veículo"
                              className="cursor-help text-muted-foreground"
                              aria-label="Informação sobre a média"
                            >
                              Info
                            </span>
                          </p>
                        );
                      }
                      if (isInitialFueling && f.average === 0) {
                        return (
                          <div>
                            <p className="text-xs font-semibold text-info">Marco Zero</p>
                            <p className="text-[10px] italic text-muted-foreground">A média ainda não aparece porque falta um tanque cheio anterior válido para comparar KM e litros.</p>
                          </div>
                        );
                      }
                      if (isFullTank && f.average > 0) {
                        return <p className="text-xs font-semibold text-profit">Média: {formatNumber(f.average)} km/l</p>;
                      }
                      if (!isFullTank) {
                        return <p className="text-xs text-warning">Este lançamento entrou no custo, mas a média só fecha depois de um tanque cheio válido.</p>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-mono text-expense">{formatCurrency(displayValue)}</span>
                  {isOpen && (
                    <>
                      <button onClick={() => setExpandedId(isExpanded ? null : f.id)} className="p-1">
                        <Pencil className={`w-3.5 h-3.5 transition-colors ${isExpanded ? "text-primary" : "text-muted-foreground hover:text-foreground"}`} />
                      </button>
                      <button onClick={() => setFuelingToDelete(f)} className="p-1" aria-label="Excluir abastecimento"><Trash2 className="w-3.5 h-3.5 text-expense" /></button>
                    </>
                  )}
                </div>
              </div>
              {isProrated && (
                <div className="mt-2 px-2 py-1.5 rounded-md bg-accent/50 border border-border/50">
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Este abastecimento cruzou mais de uma viagem. Nesta viagem ficou <span className="font-semibold">{formatCurrency(displayValue)}</span>. Total pago na bomba: <span className="font-semibold">{formatCurrency(f.originalTotalValue!)}</span>.
                  </p>
                </div>
              )}
            </div>
            {isExpanded && (
              <div className="border border-t-0 border-border rounded-b-lg overflow-hidden">
                <FuelForm
                  initial={f}
                  isEdit
                  isSubmitting={submittingKey === f.id}
                  onSubmit={(data) => handleUpdate(f.id, data)}
                  onCancel={() => setExpandedId(null)}
                />
              </div>
            )}
          </div>
        );
      })}
      {isOpen && (showNewForm ? (
        <FuelForm isEdit={false} isSubmitting={submittingKey === 'new'} onSubmit={handleAdd} onCancel={() => setShowNewForm(false)} />
      ) : (
        <button onClick={() => setShowNewForm(true)}
          className="w-full border border-dashed border-border rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm font-medium min-h-[44px]">
          <Plus className="w-4 h-4" /> Adicionar abastecimento
        </button>
      ))}
    </div>
    <DeleteConfirmDialog
      open={!!fuelingToDelete}
      onOpenChange={(open) => {
        if (!open && !isDeletingFueling) setFuelingToDelete(null);
      }}
      onConfirm={handleDeleteFueling}
      title="Excluir abastecimento?"
      description={fuelingToDelete?.allocatedValue != null && fuelingToDelete?.originalTotalValue != null
        ? "Esse abastecimento também ajustou custos de outras viagens. Ao excluir, o app vai retirar esses ajustes, refazer a média e revisar o odômetro do veículo."
        : "Ao excluir, o app remove este lançamento, refaz a média que depender dele e revisa o odômetro do veículo."}
      isLoading={isDeletingFueling}
    />
    </>
  );
}

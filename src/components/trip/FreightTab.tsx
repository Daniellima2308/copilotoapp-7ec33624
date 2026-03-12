import { useState } from "react";
import { Trip, Freight } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { MapPin, Plus, Trash2, Ruler } from "lucide-react";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import { toast } from "@/hooks/use-toast";
import { normalizeDecimalInput, parseDecimal } from "@/lib/inputMasks";

interface FreightTabProps {
  trip: Trip;
  isOpen: boolean;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  addFreight: (tripId: string, f: Omit<Freight, "id" | "tripId" | "commissionValue">) => Promise<void>;
  deleteFreight: (tripId: string, freightId: string) => Promise<void>;
}

export function FreightTab({ trip, isOpen, showForm, setShowForm, addFreight, deleteFreight }: FreightTabProps) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [km, setKm] = useState("");
  const [gross, setGross] = useState("");
  const [comm, setComm] = useState("17");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const kmValue = parseDecimal(km);
    const grossValue = parseDecimal(gross);
    const commissionPercent = parseDecimal(comm);

    if (!origin || !dest || !km || !gross) {
      toast({ title: "Campos obrigatórios", description: "Preencha origem, destino, KM e valor do frete.", variant: "destructive" });
      return;
    }
    if (kmValue <= 0 || grossValue <= 0) {
      toast({ title: "Valores inválidos", description: "KM e valor bruto devem ser maiores que zero.", variant: "destructive" });
      return;
    }
    if (commissionPercent < 0 || commissionPercent > 100) {
      toast({ title: "Comissão inválida", description: "A comissão deve ficar entre 0% e 100%.", variant: "destructive" });
      return;
    }

    addFreight(trip.id, { origin, destination: dest, kmInitial: kmValue, grossValue, commissionPercent, createdAt: new Date().toISOString() });
    setOrigin(""); setDest(""); setKm(""); setGross(""); setComm("17"); setShowForm(false);
  };

  return (
    <div className="space-y-2">
      {trip.freights.map((f: Freight) => (
        <div key={f.id} className="gradient-card rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{f.origin} → {f.destination}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Ruler className="w-3 h-3" /> {formatNumber(f.kmInitial)} km
              </span>
              <span className="text-xs text-muted-foreground">Comissão: {formatCurrency(f.commissionValue)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-profit">{formatCurrency(f.grossValue)}</span>
            {isOpen && <button onClick={() => deleteFreight(trip.id, f.id)} className="p-1"><Trash2 className="w-3.5 h-3.5 text-expense" /></button>}
          </div>
        </div>
      ))}
      {isOpen && (showForm ? (
        <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <CityAutocomplete placeholder="Origem" value={origin} onChange={setOrigin} className="input-field" />
            <CityAutocomplete placeholder="Destino" value={dest} onChange={setDest} className="input-field" />
            <input placeholder="KM Inicial" inputMode="decimal" value={km} onChange={(e) => setKm(normalizeDecimalInput(e.target.value))} className="input-field" />
            <input placeholder="Valor Bruto (R$)" inputMode="decimal" value={gross} onChange={(e) => setGross(normalizeDecimalInput(e.target.value))} className="input-field" />
            <input placeholder="Comissão (%)" inputMode="decimal" value={comm} onChange={(e) => setComm(normalizeDecimalInput(e.target.value))} className="input-field" />
          </div>
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
    </div>
  );
}

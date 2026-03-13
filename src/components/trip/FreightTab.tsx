import { useState } from "react";
import { Trip, Freight } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { MapPin, Plus, Trash2, Ruler, Wallet } from "lucide-react";
import { CityAutocomplete } from "@/components/CityAutocomplete";

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
    if (!origin || !dest || !km || !gross) return;
    addFreight(trip.id, { origin, destination: dest, kmInitial: parseFloat(km), grossValue: parseFloat(gross), commissionPercent: parseFloat(comm), createdAt: new Date().toISOString() });
    setOrigin(""); setDest(""); setKm(""); setGross(""); setComm("17"); setShowForm(false);
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
              <p className="text-xs text-muted-foreground">Trecho cadastrado neste frete.</p>
            </div>
            {isOpen && <button onClick={() => deleteFreight(trip.id, f.id)} className="p-1"><Trash2 className="w-3.5 h-3.5 text-expense" /></button>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md bg-secondary/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bruto</p>
              <p className="text-sm font-mono font-bold text-profit">{formatCurrency(f.grossValue)}</p>
            </div>
            <div className="rounded-md bg-secondary/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Wallet className="w-3 h-3" />Comissão</p>
              <p className="text-sm font-mono font-bold">{formatCurrency(f.commissionValue)}</p>
            </div>
            <div className="rounded-md bg-secondary/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Ruler className="w-3 h-3" />KM inicial</p>
              <p className="text-sm font-mono font-bold">{formatNumber(f.kmInitial)} km</p>
            </div>
          </div>
        </div>
      ))}
      {isOpen && (showForm ? (
        <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <CityAutocomplete placeholder="Origem" value={origin} onChange={setOrigin} className="input-field" />
            <CityAutocomplete placeholder="Destino" value={dest} onChange={setDest} className="input-field" />
            <input placeholder="KM Inicial" type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} className="input-field" />
            <input placeholder="Valor Bruto (R$)" type="number" step="0.01" min="0.01" value={gross} onChange={(e) => setGross(e.target.value)} className="input-field" />
            <input placeholder="Comissão (%)" type="number" step="0.1" min="0" max="100" value={comm} onChange={(e) => setComm(e.target.value)} className="input-field" />
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

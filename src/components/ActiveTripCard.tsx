import { Trip, Vehicle } from "@/types";
import { useApp } from "@/context/AppContext";
import { getTripGrossRevenue, getLastDestination, formatCurrency } from "@/lib/calculations";
import { Truck, MapPin, ChevronRight, CheckCircle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ActiveTripCardProps {
  trip: Trip;
}

export function ActiveTripCard({ trip }: ActiveTripCardProps) {
  const { data, finishTrip, deleteTrip } = useApp();
  const navigate = useNavigate();
  const vehicle = data.vehicles.find((v) => v.id === trip.vehicleId);
  const gross = getTripGrossRevenue(trip);
  const lastDest = getLastDestination(trip);

  return (
    <div className="gradient-active-trip rounded-xl p-5 cursor-pointer transition-all hover:scale-[1.01]"
      onClick={() => navigate(`/trip/${trip.id}`)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-profit animate-pulse-glow" />
          <span className="text-xs font-semibold uppercase tracking-widest text-profit">
            Viagem Ativa
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <Truck className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-medium text-secondary-foreground">
          {vehicle ? `${vehicle.brand} ${vehicle.model} - ${vehicle.plate}` : "Veículo não encontrado"}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <MapPin className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Último destino: <span className="text-foreground font-medium">{lastDest}</span></span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-muted-foreground">Faturamento Parcial</span>
          <p className="text-2xl font-bold font-mono text-profit">{formatCurrency(gross)}</p>
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => finishTrip(trip.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-profit/10 text-profit text-xs font-semibold hover:bg-profit/20 transition-colors"
          >
            <CheckCircle className="w-4 h-4" /> Finalizar
          </button>
          <button
            onClick={() => {
              if (confirm("Excluir viagem e todos os dados vinculados?")) deleteTrip(trip.id);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-expense/10 text-expense text-xs font-semibold hover:bg-expense/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

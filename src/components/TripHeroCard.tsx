import { Trip, Vehicle } from "@/types";
import { formatDate, formatNumber, getTripLatestCheckpointKm } from "@/lib/calculations";
import { Gauge, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getCurrentFreight } from "@/lib/freightStatus";
import { calculateEta } from "@/lib/freightAnalysis";

interface TripHeroCardProps {
  trip: Trip;
  vehicle: Vehicle | undefined;
}

const AVG_SPEED_KMH = 65;

export function TripHeroCard({ trip, vehicle }: TripHeroCardProps) {
  const currentKm = vehicle?.currentKm || 0;
  const currentFreight = getCurrentFreight(trip);

  const tripLatestKm = getTripLatestCheckpointKm(trip);
  const effectiveCurrentKm = Math.max(currentKm, tripLatestKm);

  const freightEstimated = currentFreight?.estimatedDistance || 0;
  const rawProgressKm = currentFreight ? effectiveCurrentKm - currentFreight.kmInitial : 0;
  const progressedKm = Math.max(0, rawProgressKm);
  const cappedProgressKm = freightEstimated > 0 ? Math.min(progressedKm, freightEstimated) : progressedKm;
  const remainingKm = freightEstimated > 0 ? Math.max(0, freightEstimated - cappedProgressKm) : 0;
  const progressPercent = freightEstimated > 0 ? Math.min(100, (cappedProgressKm / freightEstimated) * 100) : 0;

  const eta = remainingKm > 0 ? calculateEta(remainingKm, AVG_SPEED_KMH) : null;

  const shouldShowEta = !!currentFreight && freightEstimated > 0;

  return (
    <div className="gradient-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {vehicle ? `${vehicle.brand} ${vehicle.model}` : "Veículo"}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded bg-accent text-[11px] font-mono font-bold tracking-wider text-muted-foreground border border-border">
              {vehicle?.plate || "---"}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(trip.createdAt)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end text-muted-foreground mb-0.5">
            <Gauge className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Odômetro</span>
          </div>
          <p className="text-lg font-black font-mono text-foreground">
            {formatNumber(currentKm)} <span className="text-xs font-medium text-muted-foreground">km</span>
          </p>
        </div>
      </div>

      {currentFreight ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-primary">Previsão do frete atual</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {currentFreight.origin} → {currentFreight.destination}
          </p>

          {shouldShowEta ? (
            <>
              <Progress value={progressPercent} className="h-2.5 bg-secondary" />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-secondary/60 p-2">
                  <p className="text-muted-foreground">Tempo restante</p>
                  <p className="font-bold text-foreground">{eta?.durationLabel ?? "Chegando"}</p>
                </div>
                <div className="rounded-md bg-secondary/60 p-2">
                  <p className="text-muted-foreground">Chegada prevista</p>
                  <p className="font-bold text-foreground">{eta?.arrivalLabel ?? "Agora"}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {formatNumber(cappedProgressKm)} / {formatNumber(freightEstimated)} km no frete em andamento.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Frete em andamento sem distância estimada para calcular previsão.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-secondary/50 p-3">
          <p className="text-xs font-semibold text-foreground">Sem frete em andamento para calcular previsão.</p>
          <p className="text-[11px] text-muted-foreground mt-1">Inicie um frete na lista abaixo para liberar ETA no hero.</p>
        </div>
      )}
    </div>
  );
}

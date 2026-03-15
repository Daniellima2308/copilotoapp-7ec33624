import { Trip, Vehicle } from "@/types";
import { formatDate, formatNumber, getTripLatestCheckpointKm } from "@/lib/calculations";
import { Clock3, Gauge, MapPin, Route } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getCurrentFreight } from "@/lib/freightStatus";
import { calculateEta } from "@/lib/freightAnalysis";

interface TripHeroCardProps {
  trip: Trip;
  vehicle: Vehicle | undefined;
}

const AVG_SPEED_KMH = 65;

export function TripHeroCard({ trip, vehicle }: TripHeroCardProps) {
  const vehicleOdometerKm = vehicle?.currentKm || 0;
  const currentFreight = getCurrentFreight(trip);

  const tripLatestKm = getTripLatestCheckpointKm(trip);
  const heroReferenceKm = Math.max(vehicleOdometerKm, tripLatestKm);

  const freightEstimated = currentFreight?.estimatedDistance || 0;
  const rawProgressKm = currentFreight ? heroReferenceKm - currentFreight.kmInitial : 0;
  const progressedKm = Math.max(0, rawProgressKm);
  const cappedProgressKm = freightEstimated > 0 ? Math.min(progressedKm, freightEstimated) : progressedKm;
  const remainingKm = freightEstimated > 0 ? Math.max(0, freightEstimated - cappedProgressKm) : 0;
  const progressPercent = freightEstimated > 0 ? Math.min(100, (cappedProgressKm / freightEstimated) * 100) : 0;

  const eta = remainingKm > 0 ? calculateEta(remainingKm, AVG_SPEED_KMH) : null;

  const shouldShowEta = !!currentFreight && freightEstimated > 0;
  const hasPlannedFreight = trip.freights.some((freight) => freight.status === "planned");

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
            {formatNumber(heroReferenceKm)} <span className="text-xs font-medium text-muted-foreground">km</span>
          </p>
          {tripLatestKm > vehicleOdometerKm && (
            <p className="text-[10px] text-muted-foreground">Baseado no último lançamento de KM desta viagem.</p>
          )}
        </div>
      </div>

      {currentFreight ? (
        <div className="space-y-2.5">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 leading-tight">
            <MapPin className="w-3.5 h-3.5 text-primary" /> {currentFreight.origin} → {currentFreight.destination}
          </p>

          {shouldShowEta ? (
            <>
              <Progress value={progressPercent} className="h-2.5 bg-secondary" />
              <div className="space-y-1.5 rounded-lg bg-secondary/40 px-2.5 py-2 border border-border/60">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Previsão do frete atual</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground">
                  <span className="inline-flex items-center gap-1 font-semibold font-mono">
                    <Route className="w-3 h-3 text-muted-foreground" />
                    {formatNumber(cappedProgressKm)} / {formatNumber(freightEstimated)} km
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="w-3 h-3 text-muted-foreground" />
                    {eta?.durationLabel ?? "Chegando"}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    {eta?.arrivalLabel ?? "Agora"}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-warning">Não foi possível calcular a rota estimada deste frete. Consulte o aviso de diagnóstico para ver o motivo.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-secondary/50 p-3">
          <p className="text-xs font-semibold text-foreground">Sem frete em andamento para calcular previsão.</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {hasPlannedFreight
              ? "Próximo frete aguardando início. Toque em Iniciar no trecho planejado."
              : "Inicie um frete na lista abaixo para liberar ETA no hero."}
          </p>
        </div>
      )}
    </div>
  );
}

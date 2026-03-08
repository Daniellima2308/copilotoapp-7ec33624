import { Trip, Vehicle } from "@/types";
import { getTripTotalKm, formatNumber, formatDate } from "@/lib/calculations";
import { Gauge, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface TripHeroCardProps {
  trip: Trip;
  vehicle: Vehicle | undefined;
}

export function TripHeroCard({ trip, vehicle }: TripHeroCardProps) {
  const currentKm = vehicle?.currentKm || 0;
  const totalKm = getTripTotalKm(trip);
  const estimated = trip.estimatedDistance || 0;
  const progressPercent = estimated > 0 ? Math.min(100, (totalKm / estimated) * 100) : 0;

  return (
    <div className="gradient-card rounded-xl p-4 space-y-3">
      {/* Vehicle info */}
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
        {/* Odometer */}
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

      {/* Progress bar */}
      {estimated > 0 && (
        <div className="space-y-1.5">
          <Progress value={progressPercent} className="h-2.5 bg-secondary" />
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>
                <span className="font-semibold text-foreground">{formatNumber(totalKm)}</span> / {formatNumber(estimated)} km
              </span>
            </div>
            <span className="font-bold text-primary">{Math.round(progressPercent)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

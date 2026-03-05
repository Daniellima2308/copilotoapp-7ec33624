import { Trip } from "@/types";
import { useApp } from "@/context/AppContext";
import { getTripGrossRevenue, getTripNetRevenue, getLastDestination, formatCurrency, formatDate } from "@/lib/calculations";
import { CheckCircle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TripHistoryListProps {
  trips: Trip[];
}

export function TripHistoryList({ trips }: TripHistoryListProps) {
  const { data } = useApp();
  const navigate = useNavigate();

  if (trips.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhuma viagem finalizada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {trips.map((trip) => {
        const vehicle = data.vehicles.find((v) => v.id === trip.vehicleId);
        const net = getTripNetRevenue(trip);
        return (
          <div
            key={trip.id}
            onClick={() => navigate(`/trip/${trip.id}`)}
            className="gradient-card rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {vehicle ? `${vehicle.plate} • ${vehicle.brand} ${vehicle.model}` : "—"} → {getLastDestination(trip)}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(trip.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold font-mono ${net >= 0 ? "text-profit" : "text-expense"}`}>
                {formatCurrency(net)}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

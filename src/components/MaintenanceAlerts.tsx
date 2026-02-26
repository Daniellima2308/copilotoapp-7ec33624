import { MaintenanceAlert } from "@/types";
import { AlertTriangle, Wrench } from "lucide-react";

interface Props {
  alerts: MaintenanceAlert[];
}

export function MaintenanceAlerts({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <section className="space-y-2">
      {alerts.map((alert) => {
        const isOverdue = alert.status === "overdue";
        return (
          <div
            key={alert.service.id}
            className={`rounded-xl p-4 flex items-center gap-3 ${
              isOverdue
                ? "bg-expense/10 border border-expense/30"
                : "bg-warning/10 border border-warning/30"
            }`}
          >
            <div className={`p-2 rounded-lg ${isOverdue ? "bg-expense/20" : "bg-warning/20"}`}>
              {isOverdue ? (
                <AlertTriangle className="w-5 h-5 text-expense" />
              ) : (
                <Wrench className="w-5 h-5 text-warning" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${isOverdue ? "text-expense" : "text-warning"}`}>
                {isOverdue ? "Atenção" : "Manutenção Próxima"}: {alert.service.serviceName}
                {isOverdue ? " Vencido!" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {alert.vehicle.brand} {alert.vehicle.model} • {alert.vehicle.plate}
                {isOverdue
                  ? ` • ${Math.abs(Math.round(alert.kmRemaining))} km além do limite`
                  : ` • Faltam ${Math.round(alert.kmRemaining)} km`}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

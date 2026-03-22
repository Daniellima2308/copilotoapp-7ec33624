import { Vehicle, MaintenanceService, MaintenanceAlert } from "@/types";

export function getMaintenanceAlerts(
  vehicles: Vehicle[],
  services: MaintenanceService[]
): MaintenanceAlert[] {
  const alerts: MaintenanceAlert[] = [];
  
  for (const service of services) {
    const vehicle = vehicles.find(v => v.id === service.vehicleId);
    if (!vehicle) continue;
    
    const kmSinceChange = vehicle.currentKm - service.lastChangeKm;
    const kmRemaining = service.intervalKm - kmSinceChange;
    
    let status: MaintenanceAlert["status"] = "ok";
    if (kmRemaining <= 0) {
      status = "overdue";
    } else if (kmRemaining <= 500) {
      status = "warning";
    }
    
    if (status !== "ok") {
      alerts.push({ service, vehicle, kmSinceChange, kmRemaining, status });
    }
  }
  
  return alerts.sort((a, b) => a.kmRemaining - b.kmRemaining);
}

export function checkAndNotifyMaintenance(alerts: MaintenanceAlert[]) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  
  for (const alert of alerts) {
    const statusText = alert.status === "overdue" ? "Vencida" : "Próxima";
    new Notification("Alerta do SENTINELA", {
      body: `Atenção: A manutenção de ${alert.service.serviceName} está ${statusText}. Verifique o aplicativo.`,
      icon: "/branding/sentinela/icon-fallback.svg",
    });
  }
}

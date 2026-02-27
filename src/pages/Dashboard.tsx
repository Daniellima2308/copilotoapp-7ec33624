import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { SummaryCards } from "@/components/SummaryCards";
import { ActiveTripCard } from "@/components/ActiveTripCard";
import { TripHistoryList } from "@/components/TripHistoryList";
import { PeriodFilter } from "@/components/PeriodFilter";
import { MaintenanceAlerts } from "@/components/MaintenanceAlerts";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { getTripGrossRevenue, getTripTotalCommissions, getTripTotalExpenses, getTripNetRevenue } from "@/lib/calculations";
import { getMaintenanceAlerts } from "@/lib/maintenance";
import { Trip } from "@/types";
import { Plus, Trash2, FileDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import logoImg from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";
import { exportMultipleTripsPdf } from "@/lib/exportPdf";

function filterTripsByPeriod(trips: Trip[], period: string): Trip[] {
  if (period === "all") return trips;
  const now = new Date();
  const start = new Date();
  switch (period) {
    case "today": start.setHours(0, 0, 0, 0); break;
    case "week": start.setDate(now.getDate() - 7); break;
    case "month": start.setMonth(now.getMonth() - 1); break;
    case "year": start.setFullYear(now.getFullYear() - 1); break;
  }
  return trips.filter((t) => new Date(t.createdAt) >= start);
}

const Dashboard = () => {
  const { data, getActiveTrip, clearHistory, loading } = useApp();
  const [period, setPeriod] = useState("month");
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const navigate = useNavigate();

  const activeTrip = getActiveTrip();

  const vehicleFilteredTrips = useMemo(() => {
    if (selectedVehicleId === "all") return data.trips;
    return data.trips.filter(t => t.vehicleId === selectedVehicleId);
  }, [data.trips, selectedVehicleId]);

  const filteredTrips = useMemo(() => filterTripsByPeriod(vehicleFilteredTrips, period), [vehicleFilteredTrips, period]);
  const maintenanceAlerts = useMemo(() => getMaintenanceAlerts(data.vehicles, data.maintenanceServices), [data.vehicles, data.maintenanceServices]);

  const grossRevenue = filteredTrips.reduce((s, t) => s + getTripGrossRevenue(t), 0);
  const totalCommissions = filteredTrips.reduce((s, t) => s + getTripTotalCommissions(t), 0);
  const totalExpenses = filteredTrips.reduce((s, t) => s + getTripTotalExpenses(t), 0);
  const netRevenue = filteredTrips.reduce((s, t) => s + getTripNetRevenue(t), 0);

  const finishedTrips = filteredTrips.filter((t) => t.status === "finished");

  const handleNewTrip = () => {
    if (activeTrip) { alert("Finalize a viagem ativa antes de iniciar uma nova."); return; }
    if (data.vehicles.length === 0) { navigate("/vehicles"); return; }
    navigate("/new-trip");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <img src={logoImg} alt="Copiloto" className="h-10 w-auto drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
          <div className="flex-1">
            <h1 className="text-xl font-black tracking-tight">Copiloto</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">seu parceiro na gestão de viagem</p>
          </div>
          <ConnectionIndicator />
        </div>
      </header>

      <div className="px-4 space-y-5">
        <NotificationPrompt />

        {/* Maintenance Alerts */}
        <MaintenanceAlerts alerts={maintenanceAlerts} />

        {/* Vehicle Filter (only for 2+ vehicles) */}
        {data.vehicles.length >= 2 && (
          <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
            <SelectTrigger className="bg-secondary border-none text-sm h-[42px]">
              <SelectValue placeholder="Todos os Veículos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Veículos</SelectItem>
              {data.vehicles.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.plate} • {v.brand} {v.model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Period Filter + Export PDF */}
        <div className="flex items-center gap-2">
          <div className="flex-1"><PeriodFilter value={period} onChange={setPeriod} /></div>
          {filteredTrips.length > 0 && (
            <button
              onClick={() => {
                const periodLabels: Record<string, string> = { all: "Todos", today: "Hoje", week: "Semana", month: "Mês", year: "Ano" };
                exportMultipleTripsPdf(filteredTrips, data.vehicles, periodLabels[period] || period);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-profit/10 text-profit hover:bg-profit/20 transition-colors text-xs font-bold whitespace-nowrap"
            >
              <FileDown className="w-4 h-4" /> PDF
            </button>
          )}
        </div>

        <SummaryCards grossRevenue={grossRevenue} netRevenue={netRevenue} totalExpenses={totalExpenses} totalCommissions={totalCommissions} />

        {activeTrip && <section><ActiveTripCard trip={activeTrip} /></section>}

        {!activeTrip && (
          <button onClick={handleNewTrip}
            className="w-full gradient-profit text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-2 font-bold text-sm hover:opacity-90 transition-opacity">
            <Plus className="w-5 h-5" /> Nova Viagem
          </button>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Histórico</h2>
            <div className="flex items-center gap-3">
              {finishedTrips.length > 0 && (
                <button onClick={() => { if (confirm("Limpar todo o histórico de viagens finalizadas?")) clearHistory(); }}
                  className="flex items-center gap-1 text-xs text-expense hover:text-expense/80 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Limpar
                </button>
              )}
            </div>
          </div>
          <TripHistoryList trips={finishedTrips} />
        </section>
      </div>
    </div>
  );
};

export default Dashboard;

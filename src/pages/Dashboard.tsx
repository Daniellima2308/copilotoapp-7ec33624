import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { SummaryCards } from "@/components/SummaryCards";
import { ActiveTripCard } from "@/components/ActiveTripCard";
import { TripHistoryList } from "@/components/TripHistoryList";
import { PeriodFilter } from "@/components/PeriodFilter";
import { getTripGrossRevenue, getTripTotalCommissions, getTripTotalExpenses, getTripNetRevenue } from "@/lib/calculations";
import { Trip } from "@/types";
import { Plus, Truck, Trash2, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { exportMultipleTripsPdf } from "@/lib/exportPdf";

function filterTripsByPeriod(trips: Trip[], period: string): Trip[] {
  if (period === "all") return trips;
  const now = new Date();
  const start = new Date();
  switch (period) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "week":
      start.setDate(now.getDate() - 7);
      break;
    case "month":
      start.setMonth(now.getMonth() - 1);
      break;
    case "year":
      start.setFullYear(now.getFullYear() - 1);
      break;
  }
  return trips.filter((t) => new Date(t.createdAt) >= start);
}

const Dashboard = () => {
  const { data, getActiveTrip, addTrip, clearHistory } = useApp();
  const [period, setPeriod] = useState("month");
  const navigate = useNavigate();

  const activeTrip = getActiveTrip();
  const filteredTrips = useMemo(() => filterTripsByPeriod(data.trips, period), [data.trips, period]);

  const grossRevenue = filteredTrips.reduce((s, t) => s + getTripGrossRevenue(t), 0);
  const totalCommissions = filteredTrips.reduce((s, t) => s + getTripTotalCommissions(t), 0);
  const totalExpenses = filteredTrips.reduce((s, t) => s + getTripTotalExpenses(t), 0);
  const netRevenue = filteredTrips.reduce((s, t) => s + getTripNetRevenue(t), 0);

  const finishedTrips = filteredTrips.filter((t) => t.status === "finished");

  const handleNewTrip = () => {
    if (activeTrip) {
      alert("Finalize a viagem ativa antes de iniciar uma nova.");
      return;
    }
    if (data.vehicles.length === 0) {
      navigate("/vehicles");
      return;
    }
    navigate("/new-trip");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Estrada Real</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Gestão de Fretes</p>
          </div>
          <button
            onClick={() => navigate("/vehicles")}
            className="p-2.5 rounded-lg bg-secondary hover:bg-accent transition-colors"
          >
            <Truck className="w-5 h-5 text-secondary-foreground" />
          </button>
        </div>
      </header>

      <div className="px-4 space-y-5">
        {/* Period Filter */}
        <PeriodFilter value={period} onChange={setPeriod} />

        {/* Summary */}
        <SummaryCards
          grossRevenue={grossRevenue}
          netRevenue={netRevenue}
          totalExpenses={totalExpenses}
          totalCommissions={totalCommissions}
        />

        {/* Active Trip */}
        {activeTrip && (
          <section>
            <ActiveTripCard trip={activeTrip} />
          </section>
        )}

        {/* New Trip Button */}
        {!activeTrip && (
          <button
            onClick={handleNewTrip}
            className="w-full gradient-profit text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-2 font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            Nova Viagem
          </button>
        )}

        {/* History */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Histórico
            </h2>
            <div className="flex items-center gap-3">
              {filteredTrips.length > 0 && (
                <button
                  onClick={() => {
                    const periodLabels: Record<string, string> = { all: "Todos", today: "Hoje", week: "Semana", month: "Mês", year: "Ano" };
                    exportMultipleTripsPdf(filteredTrips, data.vehicles, periodLabels[period] || period);
                  }}
                  className="flex items-center gap-1 text-xs text-profit hover:text-profit/80 transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" /> Exportar PDF
                </button>
              )}
              {finishedTrips.length > 0 && (
                <button
                  onClick={() => { if (confirm("Limpar todo o histórico de viagens finalizadas?")) clearHistory(); }}
                  className="flex items-center gap-1 text-xs text-expense hover:text-expense/80 transition-colors"
                >
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

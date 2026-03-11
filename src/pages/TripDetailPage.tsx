import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import {
  getTripGrossRevenue, getTripNetRevenue,
  getTripAverageConsumption, getTripCostPerKm, getTripProfitPerKm,
  formatCurrency, formatNumber, getEffectiveKm,
} from "@/lib/calculations";
import {
  ArrowLeft, Fuel, MapPin, Receipt, Gauge, DollarSign, TrendingUp,
  TrendingDown, Trash2, CheckCircle, FileDown, Route,
} from "lucide-react";
import { exportSingleTripPdf } from "@/lib/exportPdf";
import { FinishTripModal } from "@/components/FinishTripModal";
import { TripHeroCard } from "@/components/TripHeroCard";
import { FreightTab } from "@/components/trip/FreightTab";
import { FuelTab } from "@/components/trip/FuelTab";
import { ExpenseTab } from "@/components/trip/ExpenseTab";

type Tab = "freights" | "fuel" | "expenses";

const TripDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, finishTrip, deleteTrip, addFreight, deleteFreight, addFueling, updateFueling, deleteFueling, addExpense, deleteExpense } = useApp();
  const trip = data.trips.find((t) => t.id === id);
  const [tab, setTab] = useState<Tab>("freights");
  const [showForm, setShowForm] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  if (!trip) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Viagem não encontrada.</div>;
  }

  const vehicle = data.vehicles.find((v) => v.id === trip.vehicleId);
  const isOpen = trip.status === "open";
  const gross = getTripGrossRevenue(trip);
  const net = getTripNetRevenue(trip);
  const avgConsumption = getTripAverageConsumption(trip);
  const costKm = getTripCostPerKm(trip);
  const profitKm = getTripProfitPerKm(trip);
  const totalKm = effectiveKm.km;
  const effectiveKm = getEffectiveKm(trip);

  const handleFinish = async (km: number) => {
    await finishTrip(trip.id, km);
    setShowFinishModal(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Minimal header */}
      <header className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold whitespace-nowrap">Detalhes</h1>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => exportSingleTripPdf(trip, data.vehicles)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-accent transition-colors text-xs font-semibold min-h-[44px]">
              <FileDown className="w-4 h-4 text-profit" /> <span className="text-profit">PDF</span>
            </button>
            {isOpen && (
              <>
                <button onClick={() => setShowFinishModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-profit/10 hover:bg-profit/20 transition-colors text-xs font-semibold min-h-[44px]">
                  <CheckCircle className="w-4 h-4 text-profit" /> <span className="text-profit">Finalizar</span>
                </button>
                <button onClick={async () => { if (confirm("Excluir viagem?")) { await deleteTrip(trip.id); navigate("/"); } }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-expense/10 hover:bg-expense/20 transition-colors text-xs font-semibold min-h-[44px]">
                  <Trash2 className="w-4 h-4 text-expense" /> <span className="text-expense">Excluir</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4">
        {/* Hero Card */}
        <TripHeroCard trip={trip} vehicle={vehicle} />

        {/* Metric Cards - 3 cols with KM total */}
        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="Bruto" value={formatCurrency(gross)} icon={<DollarSign className="w-4 h-4" />} />
          <MetricCard label="Líquido" value={formatCurrency(net)} icon={<TrendingUp className="w-4 h-4" />} valueClass={net >= 0 ? "text-profit" : "text-expense"} />
          <MetricCard label="KM Total" value={`${formatNumber(effectiveKm.km)} km`} icon={<Route className="w-4 h-4" />} subtitle={effectiveKm.isEstimate ? "(Estimativa)" : undefined} />
          <MetricCard label="Lucro/KM" value={`R$ ${formatNumber(profitKm)}`} icon={<TrendingUp className="w-4 h-4" />} valueClass="text-profit" />
          <MetricCard label="Custo/KM" value={`R$ ${formatNumber(costKm)}`} icon={<TrendingDown className="w-4 h-4" />} valueClass="text-expense" />
          {avgConsumption > 0 && (
            <MetricCard label="Média" value={`${formatNumber(avgConsumption)} km/l`} icon={<Gauge className="w-4 h-4" />} valueClass="text-profit" />
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {([["freights", "Fretes", MapPin], ["fuel", "Abastecimentos", Fuel], ["expenses", "Despesas", Receipt]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => { setTab(key); setShowForm(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                tab === key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === "freights" && <FreightTab trip={trip} isOpen={isOpen} showForm={showForm} setShowForm={setShowForm} addFreight={addFreight} deleteFreight={deleteFreight} />}
        {tab === "fuel" && <FuelTab trip={trip} isOpen={isOpen} addFueling={addFueling} updateFueling={updateFueling} deleteFueling={deleteFueling} />}
        {tab === "expenses" && <ExpenseTab trip={trip} isOpen={isOpen} showForm={showForm} setShowForm={setShowForm} addExpense={addExpense} deleteExpense={deleteExpense} />}
      </div>

      <FinishTripModal
        open={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        minKm={vehicle?.currentKm || 0}
        onConfirm={handleFinish}
      />
    </div>
  );
};

function MetricCard({ label, value, icon, valueClass = "text-foreground", subtitle }: { label: string; value: string; icon: React.ReactNode; valueClass?: string; subtitle?: string }) {
  return (
    <div className="gradient-card rounded-lg p-2.5">
      <div className="flex items-center gap-1 mb-1 text-muted-foreground">{icon}<span className="text-[9px] uppercase tracking-wider font-semibold">{label}</span></div>
      <p className={`text-sm font-bold font-mono ${valueClass}`}>{value}</p>
      {subtitle && <p className="text-[9px] italic text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export default TripDetailPage;

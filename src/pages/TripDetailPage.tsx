import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import {
  getTripGrossRevenue, getTripNetRevenue, getTripTotalExpenses, getTripTotalCommissions,
  getTripAverageConsumption, getTripCostPerKm, getTripProfitPerKm, getTripTotalKm,
  formatCurrency, formatNumber, formatDate,
} from "@/lib/calculations";
import { EXPENSE_CATEGORY_LABELS, ExpenseCategory, Fueling } from "@/types";
import {
  ArrowLeft, Plus, Fuel, MapPin, Receipt, Gauge, DollarSign, TrendingUp,
  TrendingDown, Trash2, CheckCircle, Pencil,
} from "lucide-react";
import { CityAutocomplete } from "@/components/CityAutocomplete";

type Tab = "freights" | "fuel" | "expenses";

const TripDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, finishTrip, deleteTrip, addFreight, deleteFreight, addFueling, updateFueling, deleteFueling, addExpense, deleteExpense } = useApp();
  const trip = data.trips.find((t) => t.id === id);
  const [tab, setTab] = useState<Tab>("freights");
  const [showForm, setShowForm] = useState(false);

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
  const totalKm = getTripTotalKm(trip);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{vehicle ? `${vehicle.brand} ${vehicle.model}` : "Viagem"}</h1>
            <p className="text-xs text-muted-foreground font-mono">{vehicle?.plate} • {formatDate(trip.createdAt)}</p>
          </div>
          {isOpen && (
            <div className="flex gap-1.5">
              <button onClick={() => { finishTrip(trip.id); navigate("/"); }}
                className="p-2 rounded-lg bg-profit/10 hover:bg-profit/20 transition-colors">
                <CheckCircle className="w-4 h-4 text-profit" />
              </button>
              <button onClick={() => { if (confirm("Excluir viagem?")) { deleteTrip(trip.id); navigate("/"); } }}
                className="p-2 rounded-lg bg-expense/10 hover:bg-expense/20 transition-colors">
                <Trash2 className="w-4 h-4 text-expense" />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="px-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Bruto" value={formatCurrency(gross)} icon={<DollarSign className="w-4 h-4" />} />
          <MetricCard label="Líquido" value={formatCurrency(net)} icon={<TrendingUp className="w-4 h-4" />} valueClass={net >= 0 ? "text-profit" : "text-expense"} />
          <MetricCard label="Lucro/KM" value={`R$ ${formatNumber(profitKm)}`} icon={<TrendingUp className="w-4 h-4" />} valueClass="text-profit" />
          <MetricCard label="Custo/KM" value={`R$ ${formatNumber(costKm)}`} icon={<TrendingDown className="w-4 h-4" />} valueClass="text-expense" />
        </div>

        {avgConsumption > 0 && (
          <div className="gradient-active-trip rounded-xl p-4 text-center glow-profit">
            <Gauge className="w-6 h-6 text-profit mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Média Geral da Viagem</p>
            <p className="text-3xl font-black font-mono text-profit">{formatNumber(avgConsumption)} <span className="text-sm font-medium">km/l</span></p>
            <p className="text-xs text-muted-foreground mt-1">{formatNumber(totalKm)} km rodados</p>
          </div>
        )}

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
        {tab === "fuel" && <FuelTab trip={trip} isOpen={isOpen} showForm={showForm} setShowForm={setShowForm} addFueling={addFueling} updateFueling={updateFueling} deleteFueling={deleteFueling} />}
        {tab === "expenses" && <ExpenseTab trip={trip} isOpen={isOpen} showForm={showForm} setShowForm={setShowForm} addExpense={addExpense} deleteExpense={deleteExpense} />}
      </div>
    </div>
  );
};

function MetricCard({ label, value, icon, valueClass = "text-foreground" }: { label: string; value: string; icon: React.ReactNode; valueClass?: string }) {
  return (
    <div className="gradient-card rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span></div>
      <p className={`text-lg font-bold font-mono ${valueClass}`}>{value}</p>
    </div>
  );
}

function FreightTab({ trip, isOpen, showForm, setShowForm, addFreight, deleteFreight }: any) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [km, setKm] = useState("");
  const [gross, setGross] = useState("");
  const [comm, setComm] = useState("17");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !dest || !km || !gross) return;
    addFreight(trip.id, { origin, destination: dest, kmInitial: parseFloat(km), grossValue: parseFloat(gross), commissionPercent: parseFloat(comm), createdAt: new Date().toISOString() });
    setOrigin(""); setDest(""); setKm(""); setGross(""); setComm("17"); setShowForm(false);
  };

  return (
    <div className="space-y-2">
      {trip.freights.map((f: any) => (
        <div key={f.id} className="gradient-card rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{f.origin} → {f.destination}</p>
            <p className="text-xs text-muted-foreground">KM: {formatNumber(f.kmInitial)} • Comissão: {formatCurrency(f.commissionValue)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-profit">{formatCurrency(f.grossValue)}</span>
            {isOpen && <button onClick={() => deleteFreight(trip.id, f.id)} className="p-1"><Trash2 className="w-3.5 h-3.5 text-expense" /></button>}
          </div>
        </div>
      ))}
      {isOpen && (showForm ? (
        <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <CityAutocomplete placeholder="Origem" value={origin} onChange={setOrigin} className="input-field" />
            <CityAutocomplete placeholder="Destino" value={dest} onChange={setDest} className="input-field" />
            <input placeholder="KM Inicial" type="number" value={km} onChange={(e) => setKm(e.target.value)} className="input-field" />
            <input placeholder="Valor Bruto (R$)" type="number" step="0.01" value={gross} onChange={(e) => setGross(e.target.value)} className="input-field" />
            <input placeholder="Comissão (%)" type="number" step="0.1" value={comm} onChange={(e) => setComm(e.target.value)} className="input-field" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold">Salvar</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">Cancelar</button>
          </div>
        </form>
      ) : (
        <AddButton onClick={() => setShowForm(true)} label="Novo Frete" />
      ))}
    </div>
  );
}

function FuelTab({ trip, isOpen, showForm, setShowForm, addFueling, updateFueling, deleteFueling }: any) {
  const [station, setStation] = useState("");
  const [value, setValue] = useState("");
  const [liters, setLiters] = useState("");
  const [kmCur, setKmCur] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (f: Fueling) => {
    setStation(f.stationName);
    setValue(String(f.totalValue));
    setLiters(String(f.liters));
    setKmCur(String(f.kmCurrent));
    setDate(f.date);
    setEditingId(f.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setStation(""); setValue(""); setLiters(""); setKmCur("");
    setDate(new Date().toISOString().slice(0, 10));
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!station || !value || !liters || !kmCur) return;
    const payload = { stationName: station, totalValue: parseFloat(value), liters: parseFloat(liters), kmCurrent: parseFloat(kmCur), date };
    if (editingId) {
      updateFueling(trip.id, editingId, payload);
    } else {
      addFueling(trip.id, payload);
    }
    resetForm();
  };

  return (
    <div className="space-y-2">
      {trip.fuelings.map((f: any) => (
        <div key={f.id} className="gradient-card rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{f.stationName}</p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(f.liters)}L • R$ {formatNumber(f.pricePerLiter)}/L • {formatNumber(f.average)} km/l
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-expense">{formatCurrency(f.totalValue)}</span>
            {isOpen && (
              <>
                <button onClick={() => startEdit(f)} className="p-1"><Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>
                <button onClick={() => deleteFueling(trip.id, f.id)} className="p-1"><Trash2 className="w-3.5 h-3.5 text-expense" /></button>
              </>
            )}
          </div>
        </div>
      ))}
      {isOpen && (showForm ? (
        <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Nome do Posto" value={station} onChange={(e) => setStation(e.target.value)} className="input-field col-span-2" />
            <input placeholder="Valor Total (R$)" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="input-field" />
            <input placeholder="Litros" type="number" step="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} className="input-field" />
            <input placeholder="KM Atual" type="number" value={kmCur} onChange={(e) => setKmCur(e.target.value)} className="input-field" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold">
              {editingId ? "Atualizar" : "Salvar"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">Cancelar</button>
          </div>
        </form>
      ) : (
        <AddButton onClick={() => setShowForm(true)} label="Novo Abastecimento" />
      ))}
    </div>
  );
}

function ExpenseTab({ trip, isOpen, showForm, setShowForm, addExpense, deleteExpense }: any) {
  const [cat, setCat] = useState<ExpenseCategory>("pedagio");
  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    const finalDesc = desc.trim() || EXPENSE_CATEGORY_LABELS[cat];
    addExpense(trip.id, { category: cat, description: finalDesc, value: parseFloat(value), date });
    setDesc(""); setValue(""); setShowForm(false);
  };

  return (
    <div className="space-y-2">
      {trip.expenses.map((e: any) => (
        <div key={e.id} className="gradient-card rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{e.description}</p>
            <p className="text-xs text-muted-foreground">{EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory]} • {formatDate(e.date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-expense">{formatCurrency(e.value)}</span>
            {isOpen && <button onClick={() => deleteExpense(trip.id, e.id)} className="p-1"><Trash2 className="w-3.5 h-3.5 text-expense" /></button>}
          </div>
        </div>
      ))}
      {isOpen && (showForm ? (
        <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory)} className="input-field col-span-2">
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} className="input-field col-span-2" />
            <input placeholder="Valor (R$)" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="input-field" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold">Salvar</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">Cancelar</button>
          </div>
        </form>
      ) : (
        <AddButton onClick={() => setShowForm(true)} label="Nova Despesa" />
      ))}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="w-full border border-dashed border-border rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm font-medium">
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}

export default TripDetailPage;

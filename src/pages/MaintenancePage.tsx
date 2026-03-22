import { useState } from "react";
import { useApp } from "@/context/app-context";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Wrench, Gauge, Truck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaintenanceService } from "@/types";
import { formatNumber } from "@/lib/calculations";

const COMMON_SERVICES = [
  "Óleo de Motor",
  "Filtro de Óleo",
  "Filtro de Ar",
  "Filtro de Combustível",
  "Lonas de Freio",
  "Filtro Separador",
  "Correia do Motor",
  "Fluido de Arrefecimento",
  "Graxa (Engraxar)",
  "Outro",
];

const MaintenancePage = () => {
  const { data, addMaintenanceService, deleteMaintenanceService } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialVehicleId = searchParams.get("vehicleId") || data.vehicles[0]?.id || "";
  const [showForm, setShowForm] = useState(false);
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [serviceName, setServiceName] = useState("");
  const [customName, setCustomName] = useState("");
  const [lastKm, setLastKm] = useState("");
  const [intervalKm, setIntervalKm] = useState("10000");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = serviceName === "Outro" ? customName : serviceName;
    if (!vehicleId || !finalName || !lastKm || !intervalKm) return;
    await addMaintenanceService({
      vehicleId,
      serviceName: finalName,
      lastChangeKm: parseFloat(lastKm),
      intervalKm: parseFloat(intervalKm),
    });
    setServiceName("");
    setCustomName("");
    setLastKm("");
    setIntervalKm("10000");
    setShowForm(false);
  };

  // Empty state: no vehicles
  if (data.vehicles.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="px-4 pt-6 pb-4 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Manutenção</h1>
        </header>
        <div className="px-4 flex flex-col items-center justify-center text-center mt-16 space-y-4">
          <Truck className="w-16 h-16 text-muted-foreground/40" />
          <h2 className="text-lg font-bold">Acompanhe a saúde do seu bruto! 🚛</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Aqui o SENTINELA te avisa a hora certa de trocar óleo, filtros e lonas de freio, evitando que você fique na mão no trecho e gaste com imprevistos. Para ativar os alertas, você precisa cadastrar o seu primeiro veículo.
          </p>
          <button
            onClick={() => navigate("/vehicles")}
            className="gradient-profit text-primary-foreground rounded-xl px-6 py-3 font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Ir para Frota
          </button>
        </div>
      </div>
    );
  }

  const vehicleServices = data.maintenanceServices.filter(s => s.vehicleId === vehicleId);
  const selectedVehicle = data.vehicles.find(v => v.id === vehicleId);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Manutenção</h1>
      </header>

      <div className="px-4 space-y-4">
        {/* Vehicle selector */}
        {data.vehicles.length > 1 && (
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="bg-secondary border-none text-sm h-[42px]">
              <SelectValue placeholder="Selecione o veículo" />
            </SelectTrigger>
            <SelectContent>
              {data.vehicles.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedVehicle && (
          <div className="gradient-card rounded-xl p-4 flex items-center gap-3">
            <Gauge className="w-5 h-5 text-profit" />
            <div>
              <p className="text-xs text-muted-foreground">
                {selectedVehicle.brand} {selectedVehicle.model} • Odômetro Atual
              </p>
              <p className="text-lg font-bold font-mono">{formatNumber(selectedVehicle.currentKm)} km</p>
            </div>
          </div>
        )}

        {/* Services list */}
        {vehicleServices.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Nenhum serviço cadastrado para este veículo.</p>
          </div>
        )}

        {vehicleServices.map((s: MaintenanceService) => {
          const vehicle = data.vehicles.find(v => v.id === s.vehicleId);
          const kmSince = vehicle ? vehicle.currentKm - s.lastChangeKm : 0;
          const kmRemaining = s.intervalKm - kmSince;
          const isOverdue = kmRemaining <= 0;
          const isWarning = kmRemaining > 0 && kmRemaining <= 500;
          const pct = Math.min(100, (kmSince / s.intervalKm) * 100);

          return (
            <div key={s.id} className="gradient-card rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className={`w-4 h-4 ${isOverdue ? "text-expense" : isWarning ? "text-warning" : "text-muted-foreground"}`} />
                  <span className="text-sm font-semibold">{s.serviceName}</span>
                </div>
                <button onClick={async () => { if (confirm("Excluir serviço?")) await deleteMaintenanceService(s.id); }}
                  className="p-1.5 rounded-lg hover:bg-expense/10">
                  <Trash2 className="w-3.5 h-3.5 text-expense" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Última troca: {formatNumber(s.lastChangeKm)} km • Intervalo: {formatNumber(s.intervalKm)} km</p>
                <p className={`font-semibold ${isOverdue ? "text-expense" : isWarning ? "text-warning" : "text-profit"}`}>
                  {isOverdue ? `Vencido há ${formatNumber(Math.abs(kmRemaining))} km` : `Faltam ${formatNumber(kmRemaining)} km`}
                </p>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${isOverdue ? "bg-expense" : isWarning ? "bg-warning" : "bg-profit"}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Add form */}
        {showForm ? (
          <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
            {data.vehicles.length > 1 && (
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger className="bg-secondary border-none text-sm h-[42px]">
                  <SelectValue placeholder="Veículo" />
                </SelectTrigger>
                <SelectContent>
                  {data.vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={serviceName} onValueChange={setServiceName}>
              <SelectTrigger className="bg-secondary border-none text-sm h-[42px]">
                <SelectValue placeholder="Tipo de Serviço" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_SERVICES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {serviceName === "Outro" && (
              <input placeholder="Nome do serviço" value={customName} onChange={e => setCustomName(e.target.value)}
                className="input-field w-full" />
            )}
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="KM da Última Troca" type="number" value={lastKm} onChange={e => setLastKm(e.target.value)}
                className="input-field" />
              <input placeholder="Intervalo (KM)" type="number" value={intervalKm} onChange={e => setIntervalKm(e.target.value)}
                className="input-field" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold">Salvar</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">Cancelar</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="w-full border border-dashed border-border rounded-xl p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> Adicionar Serviço de Manutenção
          </button>
        )}
      </div>
    </div>
  );
};

export default MaintenancePage;

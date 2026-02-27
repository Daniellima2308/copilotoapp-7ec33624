import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Truck, User, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TRUCK_BRANDS = ["Mercedes-Benz", "Scania", "Volvo", "Volkswagen", "Ford", "Iveco", "DAF"] as const;

const MODELS_BY_BRAND: Record<string, string[]> = {
  "Mercedes-Benz": ["1113", "1513", "1620", "1634", "1935", "1938", "Atego 2425", "Atego 2426", "Atego 2430", "Atron 1635", "Axor 2544", "Axor 2546", "Actros 2546", "Actros 2651"],
  "Scania": ["112", "113", "124", "G380", "G420", "P310", "P360", "R440", "R450", "R500", "R540"],
  "Volvo": ["EDC", "NL12", "VM 270", "VM 330", "FH12 380", "FH 400", "FH 440", "FH 460", "FH 500", "FH 540"],
  "Volkswagen": ["Worker 13.180", "Worker 24.220", "Titan 18.310", "Constellation 24.250", "Constellation 24.280", "Constellation 25.320", "Meteor 28.460", "Meteor 29.520"],
  "Ford": ["F-4000", "Cargo 815", "Cargo 1119", "Cargo 2422", "Cargo 2429", "Cargo 2842"],
  "Iveco": ["EuroTech", "Tector 240E28", "Stralis 380", "Stralis 460", "Hi-Way 440", "Hi-Way 480", "Hi-Way 560"],
  "DAF": ["CF 85", "XF 105", "XF 480", "XF 530"],
};

const VehiclesPage = () => {
  const { data, addVehicle, deleteVehicle } = useApp();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [year, setYear] = useState("");
  const [plate, setPlate] = useState("");
  const [currentKm, setCurrentKm] = useState("");
  const [isFleetOwner, setIsFleetOwner] = useState(false);
  const [driverName, setDriverName] = useState("");

  const availableModels = brand ? (MODELS_BY_BRAND[brand] || []) : [];

  const handleBrandChange = (val: string) => { setBrand(val); setModel(""); setCustomModel(""); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalModel = model === "__custom" ? customModel : model;
    if (!brand || !finalModel || !year || !plate || !currentKm) return;
    if (isFleetOwner && !driverName.trim()) return;
    addVehicle({
      brand, model: finalModel, year: parseInt(year), plate: plate.toUpperCase(),
      currentKm: parseFloat(currentKm),
      isFleetOwner, driverName: isFleetOwner ? driverName.trim() : undefined,
    });
    setBrand(""); setModel(""); setCustomModel(""); setYear(""); setPlate(""); setCurrentKm("");
    setIsFleetOwner(false); setDriverName(""); setShowForm(false);
  };

  const inputClass = "bg-secondary text-foreground rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Veículos</h1>
      </header>

      <div className="px-4 space-y-3">
        {data.vehicles.map((v) => (
          <div key={v.id} className="gradient-card rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{v.brand} {v.model} {v.year}</p>
                <p className="text-xs text-muted-foreground font-mono">{v.plate} • {v.currentKm.toLocaleString("pt-BR")} km</p>
                {v.driverName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <User className="w-3 h-3" /> {v.driverName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => navigate(`/maintenance?vehicleId=${v.id}`)}
                className="p-2 rounded-lg hover:bg-accent transition-colors" title="Ver Manutenções">
                <Wrench className="w-4 h-4 text-muted-foreground" />
              </button>
              <button onClick={() => { if (confirm("Excluir veículo?")) deleteVehicle(v.id); }}
                className="p-2 rounded-lg hover:bg-expense/10 transition-colors">
                <Trash2 className="w-4 h-4 text-expense" />
              </button>
            </div>
          </div>
        ))}

        {showForm ? (
          <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select value={brand} onValueChange={handleBrandChange}>
                <SelectTrigger className="bg-secondary border-none text-sm h-[42px]"><SelectValue placeholder="Marca" /></SelectTrigger>
                <SelectContent>{TRUCK_BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={model} onValueChange={setModel} disabled={!brand}>
                <SelectTrigger className="bg-secondary border-none text-sm h-[42px]"><SelectValue placeholder="Modelo" /></SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  <SelectItem value="__custom">Outro modelo...</SelectItem>
                </SelectContent>
              </Select>
              {model === "__custom" && (
                <input placeholder="Digite o modelo" value={customModel} onChange={(e) => setCustomModel(e.target.value)} className={`${inputClass} col-span-2`} />
              )}
              <input placeholder="Ano" type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputClass} />
              <input placeholder="Placa (ABC1D23)" value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={7} className={`${inputClass} uppercase font-mono`} />
              <input placeholder="KM Atual do Painel" type="number" value={currentKm} onChange={(e) => setCurrentKm(e.target.value)} className={`${inputClass} col-span-2`} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm text-foreground">Você é dono de frota?</label>
                <p className="text-[10px] text-muted-foreground/60 leading-tight">selecione pra colocar o nome do motorista do seu caminhão</p>
              </div>
              <Switch checked={isFleetOwner} onCheckedChange={setIsFleetOwner} />
            </div>
            {isFleetOwner && (
              <input placeholder="Nome do Motorista" value={driverName} onChange={(e) => setDriverName(e.target.value)} className={`${inputClass} w-full`} />
            )}
            <div className="flex gap-2">
              <button type="submit" className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold">Salvar</button>
              <button type="button" onClick={() => { setShowForm(false); setBrand(""); setModel(""); setCustomModel(""); setYear(""); setPlate(""); setCurrentKm(""); setIsFleetOwner(false); setDriverName(""); }}
                className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">Cancelar</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="w-full border border-dashed border-border rounded-xl p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> Adicionar Veículo
          </button>
        )}
      </div>
    </div>
  );
};

export default VehiclesPage;

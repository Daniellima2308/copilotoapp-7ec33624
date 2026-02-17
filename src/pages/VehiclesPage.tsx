import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Truck } from "lucide-react";

const VehiclesPage = () => {
  const { data, addVehicle, deleteVehicle } = useApp();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [plate, setPlate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !model || !year || !plate) return;
    addVehicle({ brand, model, year: parseInt(year), plate: plate.toUpperCase() });
    setBrand(""); setModel(""); setYear(""); setPlate("");
    setShowForm(false);
  };

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
                <p className="text-xs text-muted-foreground font-mono">{v.plate}</p>
              </div>
            </div>
            <button onClick={() => { if (confirm("Excluir veículo?")) deleteVehicle(v.id); }}
              className="p-2 rounded-lg hover:bg-expense/10 transition-colors">
              <Trash2 className="w-4 h-4 text-expense" />
            </button>
          </div>
        ))}

        {showForm ? (
          <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Marca (ex: Mercedes-Benz)" value={brand} onChange={(e) => setBrand(e.target.value)}
                className="bg-secondary text-foreground rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary" />
              <input placeholder="Modelo (ex: Atego 2426)" value={model} onChange={(e) => setModel(e.target.value)}
                className="bg-secondary text-foreground rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary" />
              <input placeholder="Ano" type="number" value={year} onChange={(e) => setYear(e.target.value)}
                className="bg-secondary text-foreground rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary" />
              <input placeholder="Placa (ABC1D23)" value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={7}
                className="bg-secondary text-foreground rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary uppercase font-mono" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold">
                Salvar
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">
                Cancelar
              </button>
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

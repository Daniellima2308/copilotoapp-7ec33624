import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NewTripPage = () => {
  const { data, addTrip } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const preSelectedVehicleId = (location.state as { preSelectedVehicleId?: string } | null)?.preSelectedVehicleId;

  const busyVehicleIds = new Set(
    data.trips.filter(t => t.status === "open").map(t => t.vehicleId)
  );

  const defaultVehicle = preSelectedVehicleId && !busyVehicleIds.has(preSelectedVehicleId)
    ? preSelectedVehicleId
    : data.vehicles.find(v => !busyVehicleIds.has(v.id))?.id || "";

  const [vehicleId, setVehicleId] = useState(defaultVehicle);

  const handleCreate = async () => {
    if (!vehicleId || busyVehicleIds.has(vehicleId)) return;
    const trip = await addTrip(vehicleId);
    navigate(`/trip/${trip.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Nova Viagem</h1>
      </header>

      <div className="px-4 space-y-4">
        <p className="text-sm text-muted-foreground">Selecione o veículo para esta jornada:</p>

        <div className="space-y-2">
          {data.vehicles.map((v) => {
            const isBusy = busyVehicleIds.has(v.id);
            return (
              <button
                key={v.id}
                onClick={() => !isBusy && setVehicleId(v.id)}
                disabled={isBusy}
                className={`w-full rounded-lg p-4 flex items-center gap-3 transition-colors ${
                  isBusy
                    ? "opacity-50 cursor-not-allowed gradient-card"
                    : vehicleId === v.id
                      ? "gradient-active-trip"
                      : "gradient-card hover:bg-accent/50"
                }`}
              >
                <Truck className="w-5 h-5 text-muted-foreground" />
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{v.brand} {v.model} {v.year}</p>
                  <p className="text-xs text-muted-foreground font-mono">{v.plate}</p>
                </div>
                {isBusy && (
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] font-bold uppercase">
                    Em Viagem
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {data.vehicles.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">Cadastre um veículo primeiro.</p>
            <button onClick={() => navigate("/vehicles")} className="gradient-profit text-primary-foreground rounded-lg px-6 py-2.5 text-sm font-bold">
              Cadastrar Veículo
            </button>
          </div>
        )}

        {vehicleId && !busyVehicleIds.has(vehicleId) && (
          <button onClick={handleCreate} className="w-full gradient-profit text-primary-foreground rounded-xl py-3 font-bold text-sm">
            Iniciar Viagem
          </button>
        )}
      </div>
    </div>
  );
};

export default NewTripPage;

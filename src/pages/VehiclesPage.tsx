import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/app-context";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Trash2, Truck, User, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DriverBond, Vehicle, VehicleOperationProfile } from "@/types";
import {
  getCommissionPercentFeedback,
  getFleetOwnerStateByProfile,
  getVehicleOperatorDisplayName,
  isDriverNameRequiredByProfile,
  profileUsesFixedCommission,
  VEHICLE_OPERATION_PROFILE_LABELS,
} from "@/lib/vehicleOperation";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

const DRIVER_BOND_LABELS: Record<DriverBond, string> = {
  autonomo: "Autônomo",
  clt: "CLT",
  agregado: "Agregado",
  outro: "Outro",
};

const formatPercentLabel = (val: number) => `${Number(val.toFixed(1))}%`;

const VehiclesPage = () => {
  const { data, addVehicle, updateVehicle, deleteVehicle } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [year, setYear] = useState("");
  const [plate, setPlate] = useState("");
  const [currentKm, setCurrentKm] = useState("");
  const [operationProfile, setOperationProfile] = useState<VehicleOperationProfile>("driver_owner");
  const [driverBond, setDriverBond] = useState<DriverBond | "">("");
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState("");
  const [isFleetOwner, setIsFleetOwner] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editCommissionPercent, setEditCommissionPercent] = useState("");
  const [isUpdatingCommission, setIsUpdatingCommission] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [isDeletingVehicleId, setIsDeletingVehicleId] = useState<string | null>(null);

  const availableModels = brand ? (MODELS_BY_BRAND[brand] || []) : [];
  const requiresDefaultCommission = profileUsesFixedCommission(operationProfile);
  const autoFleetOwnerState = useMemo(() => getFleetOwnerStateByProfile(operationProfile), [operationProfile]);
  const isFleetOwnerLocked = autoFleetOwnerState !== null;
  const effectiveFleetOwner = autoFleetOwnerState ?? isFleetOwner;
  const requiresDriverName = isDriverNameRequiredByProfile(operationProfile);

  useEffect(() => {
    if (autoFleetOwnerState !== null) {
      setIsFleetOwner(autoFleetOwnerState);
      if (!autoFleetOwnerState) setDriverName("");
    }
  }, [autoFleetOwnerState]);

  useEffect(() => {
    if (!showCelebration) return;
    const timeout = window.setTimeout(() => setShowCelebration(false), 900);
    return () => window.clearTimeout(timeout);
  }, [showCelebration]);

  const handleBrandChange = (val: string) => { setBrand(val); setModel(""); setCustomModel(""); };

  const clearForm = () => {
    setBrand(""); setModel(""); setCustomModel(""); setYear(""); setPlate(""); setCurrentKm("");
    setOperationProfile("driver_owner");
    setDriverBond("");
    setDefaultCommissionPercent("");
    setIsFleetOwner(false);
    setDriverName("");
    setShowForm(false);
  };

  const openCommissionEditor = (vehicle: Vehicle) => {
    setEditVehicle(vehicle);
    setEditCommissionPercent(vehicle.defaultCommissionPercent != null ? String(vehicle.defaultCommissionPercent) : "");
  };

  const handleUpdateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVehicle) return;

    const parsed = parseFloat(editCommissionPercent);
    if (!editCommissionPercent || Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      toast({ title: "Não deu para salvar", description: "Informe um percentual entre 0 e 100.", variant: "destructive" });
      return;
    }

    const currentPercent = editVehicle.defaultCommissionPercent ?? 0;
    if (parsed === currentPercent) {
      toast({
        title: "Sem alterações",
        description: `O percentual padrão já está em ${formatPercentLabel(parsed)}.`,
      });
      return;
    }

    setIsUpdatingCommission(true);
    try {
      await updateVehicle(editVehicle.id, { defaultCommissionPercent: parsed });

      const feedback = getCommissionPercentFeedback(editVehicle.operationProfile, currentPercent, parsed);
      if (feedback.celebrate) setShowCelebration(true);

      toast({
        title: feedback.title,
        description: "Novo percentual será usado nos próximos fretes. Fretes antigos não serão alterados.",
      });

      setEditVehicle(null);
      setEditCommissionPercent("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tente novamente em instantes.";
      toast({ title: "Não deu para salvar", description: message, variant: "destructive" });
    } finally {
      setIsUpdatingCommission(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalModel = model === "__custom" ? customModel.trim() : model;
    const normalizedDriverName = driverName.trim();
    const parsedYear = parseInt(year, 10);
    const parsedKm = parseFloat(currentKm);
    const parsedDefaultCommission = requiresDefaultCommission ? parseFloat(defaultCommissionPercent) : null;

    if (!brand || !finalModel || !year || !plate || !currentKm) {
      toast({ title: "Não deu para salvar", description: "Informe marca, modelo, ano, placa e KM do painel.", variant: "destructive" });
      return;
    }

    if (requiresDefaultCommission && !defaultCommissionPercent) {
      toast({ title: "Não deu para salvar", description: "Informe o percentual padrão de comissão para este perfil.", variant: "destructive" });
      return;
    }

    if (Number.isNaN(parsedYear) || parsedYear < 1900) {
      toast({ title: "Não deu para salvar", description: "Informe um ano válido para o veículo.", variant: "destructive" });
      return;
    }

    if (Number.isNaN(parsedKm) || parsedKm < 0) {
      toast({ title: "Não deu para salvar", description: "Informe um KM válido do painel.", variant: "destructive" });
      return;
    }

    if (requiresDefaultCommission && (parsedDefaultCommission == null || Number.isNaN(parsedDefaultCommission) || parsedDefaultCommission < 0 || parsedDefaultCommission > 100)) {
      toast({ title: "Não deu para salvar", description: "Informe um percentual de comissão entre 0 e 100.", variant: "destructive" });
      return;
    }

    if (requiresDriverName && !normalizedDriverName) {
      toast({ title: "Não deu para salvar", description: "Preencha o nome do motorista para este perfil de veículo.", variant: "destructive" });
      return;
    }

    setIsSavingVehicle(true);
    try {
      await addVehicle({
        brand,
        model: finalModel,
        year: parsedYear,
        plate: plate.toUpperCase(),
        currentKm: parsedKm,
        operationProfile,
        driverBond: driverBond || undefined,
        defaultCommissionPercent: requiresDefaultCommission ? parsedDefaultCommission ?? undefined : undefined,
        isFleetOwner: effectiveFleetOwner,
        driverName: effectiveFleetOwner && normalizedDriverName ? normalizedDriverName : undefined,
      });

      toast({ title: "Veículo salvo com sucesso.", description: "A lista foi atualizada com os dados mais recentes." });
      clearForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tente novamente em instantes.";
      toast({ title: "Não deu para salvar", description: message, variant: "destructive" });
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm("Excluir veículo?")) return;

    setIsDeletingVehicleId(vehicleId);
    try {
      await deleteVehicle(vehicleId);
      toast({ title: "Veículo excluído com sucesso." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tente novamente em instantes.";
      toast({ title: "Não deu para excluir", description: message, variant: "destructive" });
    } finally {
      setIsDeletingVehicleId(null);
    }
  };

  const inputClass = "bg-secondary text-foreground rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background pb-24 relative overflow-x-hidden">
      {showCelebration && (
        <div className="pointer-events-none fixed right-6 top-20 z-50 flex gap-2" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-profit animate-ping" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-ping [animation-delay:120ms]" />
          <span className="h-2 w-2 rounded-full bg-warning animate-ping [animation-delay:220ms]" />
        </div>
      )}

      <header className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Veículos</h1>
      </header>

      <div className="px-4 space-y-3">
        {data.vehicles.map((v) => {
          const canEditDefaultCommission = profileUsesFixedCommission(v.operationProfile);

          return (
            <div key={v.id} className="gradient-card rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{v.brand} {v.model} {v.year}</p>
                  <p className="text-xs text-muted-foreground font-mono">{v.plate} • {v.currentKm.toLocaleString("pt-BR")} km</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{VEHICLE_OPERATION_PROFILE_LABELS[v.operationProfile]}</p>
                  {v.driverBond && <p className="text-xs text-muted-foreground/90">Vínculo: {DRIVER_BOND_LABELS[v.driverBond]}</p>}
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <User className="w-3 h-3" /> {getVehicleOperatorDisplayName(v)}
                  </p>
                  {canEditDefaultCommission && (
                    <p className="text-xs text-muted-foreground/90 mt-0.5">Comissão padrão: {formatPercentLabel(v.defaultCommissionPercent ?? 0)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canEditDefaultCommission && (
                  <button
                    onClick={() => openCommissionEditor(v)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="Editar percentual padrão"
                  >
                    <Pencil className="w-4 h-4 text-primary" />
                  </button>
                )}
                <button onClick={() => navigate(`/maintenance?vehicleId=${v.id}`)}
                  className="p-2 rounded-lg hover:bg-accent transition-colors" title="Ver Manutenções">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => handleDeleteVehicle(v.id)} disabled={isDeletingVehicleId === v.id}
                  className="p-2 rounded-lg hover:bg-expense/10 transition-colors">
                  <Trash2 className="w-4 h-4 text-expense" />
                </button>
              </div>
            </div>
          );
        })}

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

              <Select value={operationProfile} onValueChange={(value) => setOperationProfile(value as VehicleOperationProfile)}>
                <SelectTrigger className="bg-secondary border-none text-sm h-[42px] col-span-2">
                  <SelectValue placeholder="Perfil de operação do veículo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_OPERATION_PROFILE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={driverBond} onValueChange={(value) => setDriverBond(value as DriverBond)}>
                <SelectTrigger className="bg-secondary border-none text-sm h-[42px] col-span-2">
                  <SelectValue placeholder="Vínculo do motorista (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DRIVER_BOND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {requiresDefaultCommission && (
                <input
                  placeholder="Percentual padrão de comissão (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={defaultCommissionPercent}
                  onChange={(e) => setDefaultCommissionPercent(e.target.value)}
                  className={`${inputClass} col-span-2`}
                />
              )}
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm text-foreground">Você é dono de frota?</label>
                <p className="text-[10px] text-muted-foreground/60 leading-tight">selecione pra colocar o nome do motorista do seu caminhão</p>
              </div>
              <Switch checked={effectiveFleetOwner} onCheckedChange={setIsFleetOwner} disabled={isFleetOwnerLocked} />
            </div>
            {effectiveFleetOwner && (
              <input placeholder="Nome do Motorista" value={driverName} onChange={(e) => setDriverName(e.target.value)} className={`${inputClass} w-full`} />
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={isSavingVehicle} className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold disabled:opacity-70">
                {isSavingVehicle ? "Salvando..." : "Salvar"}
              </button>
              <button type="button" onClick={clearForm}
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

      <Dialog open={!!editVehicle} onOpenChange={(open) => { if (!open) setEditVehicle(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar percentual padrão</DialogTitle>
            <DialogDescription>
              Atualize o percentual do veículo para os próximos fretes. O histórico antigo não muda.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCommission} className="space-y-3">
            <input
              placeholder="Percentual padrão de comissão (%)"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={editCommissionPercent}
              onChange={(e) => setEditCommissionPercent(e.target.value)}
              className={`${inputClass} w-full`}
            />
            <p className="text-xs text-muted-foreground">Novo percentual será usado apenas nos próximos fretes.</p>
            <div className="flex gap-2">
              <button type="submit" disabled={isUpdatingCommission} className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold disabled:opacity-70">
                {isUpdatingCommission ? "Salvando..." : "Salvar percentual"}
              </button>
              <button type="button" onClick={() => setEditVehicle(null)} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">Cancelar</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VehiclesPage;

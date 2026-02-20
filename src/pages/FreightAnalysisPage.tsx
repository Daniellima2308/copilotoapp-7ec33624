import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { getRouteDistance } from "@/lib/routeApi";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Fuel, MapPin, DollarSign, Gauge, Truck, AlertTriangle, CheckCircle, TrendingUp, Calculator, Route } from "lucide-react";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/calculations";

// Coeficientes ANTT aproximados (R$/km) por número de eixos — Referência ANTT 2024
const ANTT_COEF_PER_KM: Record<number, number> = {
  2: 3.35,
  3: 3.65,
  4: 4.15,
  5: 4.54,
  6: 4.90,
  7: 5.38,
  9: 5.99,
};

// Multiplicadores por tipo de carga
const CARGO_MULTIPLIERS: Record<string, number> = {
  geral: 1.0,
  granel: 1.0,
  frigorificada: 1.3,
  perigosa: 1.3,
  neogranel: 1.0,
  conteiner: 1.15,
};

const CARGO_TYPES = [
  { value: "geral", label: "Carga Geral" },
  { value: "granel", label: "Granel Sólido" },
  { value: "frigorificada", label: "Frigorificada" },
  { value: "perigosa", label: "Perigosa" },
  { value: "neogranel", label: "Neogranel" },
  { value: "conteiner", label: "Contêiner" },
];

const AXLE_OPTIONS = [2, 3, 4, 5, 6, 7, 9];

// Média estimada de pedágio por km por eixo (R$/km) — dados aproximados rodovias BR
const TOLL_PER_KM_PER_AXLE: Record<number, number> = {
  2: 0.12,
  3: 0.18,
  4: 0.24,
  5: 0.30,
  6: 0.36,
  7: 0.42,
  9: 0.54,
};

function estimateToll(distanceKm: number, axles: number): number {
  const rate = TOLL_PER_KM_PER_AXLE[axles] ?? TOLL_PER_KM_PER_AXLE[3];
  return Math.round(distanceKm * rate * 100) / 100;
}

function calcAnttFloor(distanceKm: number, axles: number, cargoType: string): number {
  const coef = ANTT_COEF_PER_KM[axles] ?? ANTT_COEF_PER_KM[3];
  const mult = CARGO_MULTIPLIERS[cargoType] ?? 1.0;
  return distanceKm * coef * mult;
}

type FreightQuality = "bad" | "medium" | "good" | "great";

function getFreightQuality(offeredValue: number, anttFloor: number, netProfit: number): FreightQuality {
  const margin = offeredValue > 0 ? (netProfit / offeredValue) * 100 : -100;
  if (netProfit < 0 || margin < 5) return "bad";
  if (margin >= 25 || offeredValue >= anttFloor) return "great";
  if (margin >= 15) return "good";
  return "medium";
}

const QUALITY_CONFIG: Record<FreightQuality, { bg: string; border: string; icon: typeof AlertTriangle; label: string; desc: string }> = {
  bad: {
    bg: "bg-destructive/15",
    border: "border-destructive/30",
    icon: AlertTriangle,
    label: "FRETE RUIM",
    desc: "Risco de Prejuízo",
  },
  medium: {
    bg: "bg-warning/15",
    border: "border-warning/30",
    icon: Gauge,
    label: "FRETE MÉDIO",
    desc: "Cobre Custos (Retorno)",
  },
  good: {
    bg: "bg-info/15",
    border: "border-info/30",
    icon: CheckCircle,
    label: "FRETE BOM",
    desc: "Margem Segura",
  },
  great: {
    bg: "bg-profit/15",
    border: "border-profit/30",
    icon: TrendingUp,
    label: "FRETE QUALIFICADO",
    desc: "Excelente Rentabilidade",
  },
};

const FreightAnalysisPage = () => {
  const navigate = useNavigate();

  // Form state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [offeredValue, setOfferedValue] = useState<number>(0);
  const [commissionPercent, setCommissionPercent] = useState<number>(17);
  const [dieselPrice, setDieselPrice] = useState<number>(6.29);
  const [avgKmPerLiter, setAvgKmPerLiter] = useState<number>(2.5);
  const [cargoType, setCargoType] = useState("geral");
  const [axles, setAxles] = useState<number>(3);
  const [tollCost, setTollCost] = useState<number>(0);
  const [tollManuallyEdited, setTollManuallyEdited] = useState(false);
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-calculate distance when both cities are selected (contain " - ")
  const calcRoute = useCallback(async (o: string, d: string) => {
    if (!o.includes(" - ") || !d.includes(" - ")) return;
    setLoadingRoute(true);
    const km = await getRouteDistance(o, d);
    if (km) setDistanceKm(km);
    setLoadingRoute(false);
  }, []);

  useEffect(() => {
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    routeTimerRef.current = setTimeout(() => calcRoute(origin, destination), 600);
    return () => { if (routeTimerRef.current) clearTimeout(routeTimerRef.current); };
  }, [origin, destination, calcRoute]);

  // Auto-estimate toll when distance or axles change (unless manually edited)
  useEffect(() => {
    if (!tollManuallyEdited && distanceKm > 0) {
      setTollCost(estimateToll(distanceKm, axles));
    }
  }, [distanceKm, axles, tollManuallyEdited]);

  // Calculations
  const results = useMemo(() => {
    if (distanceKm <= 0 || offeredValue <= 0) return null;

    const fuelCost = (distanceKm / (avgKmPerLiter || 1)) * dieselPrice;
    const commissionValue = (offeredValue * commissionPercent) / 100;
    const totalExpenses = fuelCost + tollCost + commissionValue;
    const netProfit = offeredValue - totalExpenses;
    const anttFloor = calcAnttFloor(distanceKm, axles, cargoType);
    const quality = getFreightQuality(offeredValue, anttFloor, netProfit);
    const profitPerKm = distanceKm > 0 ? netProfit / distanceKm : 0;
    const profitMargin = offeredValue > 0 ? (netProfit / offeredValue) * 100 : 0;

    return { fuelCost, commissionValue, totalExpenses, netProfit, anttFloor, quality, profitPerKm, profitMargin };
  }, [distanceKm, offeredValue, commissionPercent, dieselPrice, avgKmPerLiter, cargoType, axles, tollCost]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5 text-secondary-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Análise de Frete
            </h1>
            <p className="text-xs text-muted-foreground">Calculadora ANTT</p>
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4">
        {/* Origem / Destino */}
        <Card className="gradient-card border-border">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Rota
            </h2>
            <div className="space-y-2">
              <CityAutocomplete value={origin} onChange={setOrigin} placeholder="Origem" className="input-field" />
              <CityAutocomplete value={destination} onChange={setDestination} placeholder="Destino" className="input-field" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Distância (KM) {loadingRoute && <span className="text-primary animate-pulse ml-1">calculando rota...</span>}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={distanceKm || ""}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  placeholder="Automático ou manual"
                  className="input-field"
                />
                <Route className={`w-4 h-4 shrink-0 ${loadingRoute ? "text-primary animate-spin" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valores */}
        <Card className="gradient-card border-border">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Valores
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Valor do Frete (R$)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={offeredValue || ""}
                  onChange={(e) => setOfferedValue(Number(e.target.value))}
                  placeholder="0,00"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Comissão (%)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={commissionPercent || ""}
                  onChange={(e) => setCommissionPercent(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  Pedágio (R$)
                  {!tollManuallyEdited && distanceKm > 0 && (
                    <span className="text-[10px] text-primary font-medium">(estimado)</span>
                  )}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={tollCost || ""}
                  onChange={(e) => {
                    setTollManuallyEdited(true);
                    setTollCost(Number(e.target.value));
                  }}
                  placeholder="0,00"
                  className="input-field"
                />
                {tollManuallyEdited && (
                  <button
                    type="button"
                    onClick={() => {
                      setTollManuallyEdited(false);
                      if (distanceKm > 0) setTollCost(estimateToll(distanceKm, axles));
                    }}
                    className="text-[10px] text-primary underline mt-0.5"
                  >
                    Voltar ao estimado
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Caminhão */}
        <Card className="gradient-card border-border">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" /> Caminhão
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Diesel (R$/L)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={dieselPrice || ""}
                  onChange={(e) => setDieselPrice(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Média (KM/L)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={avgKmPerLiter || ""}
                  onChange={(e) => setAvgKmPerLiter(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tipo de Carga</label>
                <select value={cargoType} onChange={(e) => setCargoType(e.target.value)} className="input-field">
                  {CARGO_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nº de Eixos</label>
                <select value={axles} onChange={(e) => setAxles(Number(e.target.value))} className="input-field">
                  {AXLE_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a} eixos</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultado */}
        {results && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Quality Badge */}
            {(() => {
              const cfg = QUALITY_CONFIG[results.quality];
              const Icon = cfg.icon;
              return (
                <div className={`rounded-xl p-4 ${cfg.bg} border ${cfg.border} flex items-center gap-3`}>
                  <Icon className="w-8 h-8 shrink-0" />
                  <div>
                    <p className="font-black text-lg tracking-tight">{cfg.label}</p>
                    <p className="text-xs text-muted-foreground">{cfg.desc}</p>
                    <p className="text-xs font-semibold mt-0.5">Margem: {results.profitMargin.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })()}

            {/* Summary */}
            <Card className="gradient-card border-border">
              <CardContent className="p-4 space-y-4">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Termômetro do Frete
                </h2>

                {/* Main metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricBox label="Distância" value={`${formatNumber(distanceKm)} km`} />
                  <MetricBox label="Piso ANTT" value={formatCurrency(results.anttFloor)} highlight="info" />
                  <MetricBox label="Combustível" value={formatCurrency(results.fuelCost)} />
                  <MetricBox label="Pedágio" value={formatCurrency(tollCost)} />
                  <MetricBox label="Comissão" value={formatCurrency(results.commissionValue)} />
                  <MetricBox label="Total Despesas" value={formatCurrency(results.totalExpenses)} highlight="expense" />
                </div>

                {/* Separator */}
                <div className="border-t border-border" />

                {/* Net profit */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Lucro Líquido Projetado</p>
                    <p className={`text-2xl font-black text-mono ${results.netProfit >= 0 ? "text-profit" : "text-expense"}`}>
                      {formatCurrency(results.netProfit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">R$/km</p>
                    <p className={`text-lg font-bold text-mono ${results.profitPerKm >= 0 ? "text-profit" : "text-expense"}`}>
                      {formatCurrency(results.profitPerKm)}
                    </p>
                  </div>
                </div>

                {/* ANTT comparison bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Valor Oferecido</span>
                    <span>Piso ANTT</span>
                  </div>
                  <div className="h-3 rounded-full bg-secondary overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        results.quality === "bad" ? "bg-destructive" : results.quality === "good" ? "bg-warning" : "bg-profit"
                      }`}
                      style={{ width: `${Math.min((offeredValue / (results.anttFloor || 1)) * 100, 100)}%` }}
                    />
                    {/* ANTT line marker */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-info" style={{ left: `${Math.min(100, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-foreground font-medium">{formatCurrency(offeredValue)}</span>
                    <span className="text-info font-medium">{formatCurrency(results.anttFloor)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!results && (
          <div className="text-center py-12">
            <Gauge className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Preencha a distância e o valor do frete para ver a análise</p>
          </div>
        )}
      </div>
    </div>
  );
};

function MetricBox({ label, value, highlight }: { label: string; value: string; highlight?: "profit" | "expense" | "info" }) {
  const colorClass = highlight === "profit" ? "text-profit" : highlight === "expense" ? "text-expense" : highlight === "info" ? "text-info" : "text-foreground";
  return (
    <div className="bg-secondary/50 rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold text-mono ${colorClass}`}>{value}</p>
    </div>
  );
}

export default FreightAnalysisPage;

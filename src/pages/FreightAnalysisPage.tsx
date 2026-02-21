import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { getRouteInfo } from "@/lib/routeApi";
import { calculateToll } from "@/lib/tollApi";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Fuel, MapPin, DollarSign, Gauge, Truck, AlertTriangle, TrendingUp, Calculator, Route, Scale } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/calculations";

// Tabela ANTT - Resolução Nº 6.076/2026
const tabelaANTT2026: Record<string, Record<number, { ccd: number; cc: number }>> = {
  'Carga Geral': {
    2: { ccd: 3.71, cc: 444.84 },
    3: { ccd: 4.18, cc: 500.84 },
    4: { ccd: 4.65, cc: 556.84 },
    5: { ccd: 5.11, cc: 612.84 },
    6: { ccd: 5.58, cc: 668.84 },
    7: { ccd: 6.05, cc: 724.84 },
    9: { ccd: 8.53, cc: 877.83 },
  },
  'Granel Sólido': {
    2: { ccd: 3.92, cc: 460.50 },
    3: { ccd: 4.45, cc: 518.50 },
    4: { ccd: 4.95, cc: 575.00 },
    5: { ccd: 5.48, cc: 633.20 },
    6: { ccd: 5.98, cc: 690.80 },
    7: { ccd: 6.49, cc: 750.10 },
    9: { ccd: 9.15, cc: 905.00 },
  },
  'Frigorificada': {
    2: { ccd: 4.35, cc: 510.00 },
    3: { ccd: 4.98, cc: 575.40 },
    4: { ccd: 5.62, cc: 641.00 },
    5: { ccd: 6.25, cc: 708.50 },
    6: { ccd: 6.89, cc: 775.20 },
    7: { ccd: 7.52, cc: 840.90 },
    9: { ccd: 10.45, cc: 1015.50 },
  },
  'Neogranel': {
    2: { ccd: 3.55, cc: 420.00 },
    3: { ccd: 4.02, cc: 475.20 },
    4: { ccd: 4.48, cc: 530.50 },
    5: { ccd: 4.95, cc: 585.80 },
    6: { ccd: 5.41, cc: 641.10 },
    7: { ccd: 5.88, cc: 696.40 },
    9: { ccd: 8.25, cc: 845.00 },
  },
  'Carga Perigosa': {
    2: { ccd: 4.58, cc: 545.00 },
    3: { ccd: 5.25, cc: 615.50 },
    4: { ccd: 5.92, cc: 686.00 },
    5: { ccd: 6.58, cc: 756.50 },
    6: { ccd: 7.25, cc: 827.00 },
    7: { ccd: 7.91, cc: 897.50 },
    9: { ccd: 11.05, cc: 1085.00 },
  },
};

// Mapeamento dos values do select para as chaves da tabela ANTT
const CARGO_TO_ANTT_KEY: Record<string, string> = {
  geral: 'Carga Geral',
  granel: 'Granel Sólido',
  frigorificada: 'Frigorificada',
  neogranel: 'Neogranel',
  perigosa: 'Carga Perigosa',
};

const CARGO_TYPES = [
  { value: "geral", label: "Carga Geral" },
  { value: "granel", label: "Granel Sólido" },
  { value: "frigorificada", label: "Frigorificada" },
  { value: "perigosa", label: "Carga Perigosa" },
  { value: "neogranel", label: "Neogranel" },
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

function calcAnttFloor(distanceKm: number, axles: number, cargoType: string, incluiCargaDescarga: boolean): number {
  const anttKey = CARGO_TO_ANTT_KEY[cargoType] || 'Carga Geral';
  const dados = tabelaANTT2026[anttKey]?.[axles] ?? tabelaANTT2026['Carga Geral'][3];
  return (distanceKm * dados.ccd) + (incluiCargaDescarga ? dados.cc : 0);
}

type FreightQuality = "bad" | "medium" | "great";

function getFreightQuality(offeredValue: number, anttFloor: number, netProfit: number): FreightQuality {
  const margin = offeredValue > 0 ? (netProfit / offeredValue) * 100 : -100;
  if (netProfit < 0 || margin < 10) return "bad";
  if (margin >= 30 || offeredValue >= anttFloor) return "great";
  return "medium";
}

const QUALITY_CONFIG: Record<FreightQuality, { bg: string; border: string; icon: typeof AlertTriangle; label: string; desc: string }> = {
  bad: {
    bg: "bg-destructive/15",
    border: "border-destructive/30",
    icon: AlertTriangle,
    label: "FRETE RUIM",
    desc: "Margem Baixa ou Prejuízo",
  },
  medium: {
    bg: "bg-warning/15",
    border: "border-warning/30",
    icon: Scale,
    label: "FRETE MAIS OU MENOS",
    desc: "Cobre Custos / Retorno",
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
  const [dieselPrice, setDieselPrice] = useState<number>(0);
  const [avgKmPerLiter, setAvgKmPerLiter] = useState<number>(0);
  const [cargoType, setCargoType] = useState("geral");
  const [axles, setAxles] = useState<number>(3);
  const [tollCost, setTollCost] = useState<number>(0);
  const [tollManuallyEdited, setTollManuallyEdited] = useState(false);
  const [loadingToll, setLoadingToll] = useState(false);
  const [tollSource, setTollSource] = useState<"api" | "estimate" | "manual">("estimate");
  const [incluiCargaDescarga, setIncluiCargaDescarga] = useState(true);
  const [valePedagio, setValePedagio] = useState(false);
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coordsRef = useRef<{ originLat: number; originLng: number; destLat: number; destLng: number } | null>(null);

  // Auto-calculate distance when both cities are selected (contain " - ")
  const calcRoute = useCallback(async (o: string, d: string) => {
    if (!o.includes(" - ") || !d.includes(" - ")) return;
    setLoadingRoute(true);
    const result = await getRouteInfo(o, d);
    if (result) {
      setDistanceKm(result.distanceKm);
      coordsRef.current = {
        originLat: result.originCoords.lat,
        originLng: result.originCoords.lon,
        destLat: result.destCoords.lat,
        destLng: result.destCoords.lon,
      };
    }
    setLoadingRoute(false);
  }, []);

  useEffect(() => {
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    routeTimerRef.current = setTimeout(() => calcRoute(origin, destination), 600);
    return () => { if (routeTimerRef.current) clearTimeout(routeTimerRef.current); };
  }, [origin, destination, calcRoute]);

  // Auto-fetch toll via TollGuru when route + axles change (unless manually edited)
  useEffect(() => {
    if (tollManuallyEdited) return;
    if (!coordsRef.current || distanceKm <= 0) return;

    const coords = coordsRef.current;
    let cancelled = false;

    const fetchToll = async () => {
      setLoadingToll(true);
      const apiToll = await calculateToll(
        coords.originLat, coords.originLng,
        coords.destLat, coords.destLng,
        axles
      );
      if (cancelled) return;

      if (apiToll !== null && apiToll > 0) {
        setTollCost(apiToll);
        setTollSource("api");
      } else {
        // Fallback to estimate
        setTollCost(estimateToll(distanceKm, axles));
        setTollSource("estimate");
      }
      setLoadingToll(false);
    };

    fetchToll();
    return () => { cancelled = true; };
  }, [distanceKm, axles, tollManuallyEdited]);

  // Calculations
  const results = useMemo(() => {
    if (distanceKm <= 0 || offeredValue <= 0) return null;

    const fuelCost = (avgKmPerLiter > 0 && dieselPrice > 0) ? (distanceKm / avgKmPerLiter) * dieselPrice : 0;
    const commissionValue = (offeredValue * commissionPercent) / 100;
    const custoPedagioEfetivo = valePedagio ? 0 : tollCost;
    const totalExpenses = fuelCost + custoPedagioEfetivo + commissionValue;
    const netProfit = offeredValue - totalExpenses;
    const anttFloor = calcAnttFloor(distanceKm, axles, cargoType, incluiCargaDescarga);
    const quality = getFreightQuality(offeredValue, anttFloor, netProfit);
    const profitPerKm = distanceKm > 0 ? netProfit / distanceKm : 0;
    const profitMargin = offeredValue > 0 ? (netProfit / offeredValue) * 100 : 0;

    return { fuelCost, commissionValue, totalExpenses, netProfit, anttFloor, quality, profitPerKm, profitMargin, custoPedagioEfetivo };
  }, [distanceKm, offeredValue, commissionPercent, dieselPrice, avgKmPerLiter, cargoType, axles, tollCost, incluiCargaDescarga, valePedagio]);

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
                  {loadingToll && <span className="text-[10px] text-primary font-medium animate-pulse">consultando...</span>}
                  {!loadingToll && !tollManuallyEdited && distanceKm > 0 && (
                    <span className="text-[10px] text-primary font-medium">
                      ({tollSource === "api" ? "TollGuru" : "estimado"})
                    </span>
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
                      setTollSource("estimate");
                      // Will re-trigger the useEffect to fetch from API
                    }}
                    className="text-[10px] text-primary underline mt-0.5"
                  >
                    Recalcular automático
                  </button>
                )}
                </div>
                <div className="col-span-2 flex items-center justify-between pt-1">
                  <div>
                    <label className="text-xs text-foreground">Transportadora paga o Pedágio? (Vale Pedágio)</label>
                  </div>
                  <Switch checked={valePedagio} onCheckedChange={setValePedagio} />
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
                  className="input-field" placeholder="Ex: 5,55"
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
                  className="input-field" placeholder="Ex: 3,5"
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
            <div className="flex items-center justify-between pt-1">
              <label className="text-xs text-muted-foreground">Inclui Carga/Descarga?</label>
              <Switch checked={incluiCargaDescarga} onCheckedChange={setIncluiCargaDescarga} />
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
                  <MetricBox label={valePedagio ? "Pedágio (Isento)" : "Pedágio"} value={valePedagio ? "R$ 0,00" : formatCurrency(tollCost)} highlight={valePedagio ? "profit" : undefined} />
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
                        results.quality === "bad" ? "bg-destructive" : results.quality === "medium" ? "bg-warning" : "bg-profit"
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

import { ReactNode, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/context/app-context";
import {
  getTripGrossRevenue,
  getTripGrossRevenueToDate,
  getTripNetRevenue,
  getTripNetRevenueToDate,
  getTripAverageConsumption,
  getTripCostPerKm,
  getTripCostPerKmToDate,
  getTripProfitPerKm,
  getTripProfitPerKmToDate,
  getEffectiveKm,
  getTripTotalCommissions,
  getTripTotalCommissionsToDate,
  getTripTotalExpenses,
  getTripTotalPersonalExpenses,
  formatCurrency,
  formatNumber,
} from "@/lib/calculations";
import {
  ArrowLeft,
  Fuel,
  MapPin,
  Receipt,
  Gauge,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trash2,
  CheckCircle,
  CircleCheck,
  Clock3,
  FileDown,
  Route,
  Sparkles,
  Wallet,
  Loader2,
} from "lucide-react";
import { exportSingleTripPdf } from "@/lib/exportPdf";
import { FinishTripModal } from "@/components/FinishTripModal";
import { TripHeroCard } from "@/components/TripHeroCard";
import { FreightTab } from "@/components/trip/FreightTab";
import { FuelTab } from "@/components/trip/FuelTab";
import { ExpenseTab } from "@/components/trip/ExpenseTab";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trip } from "@/types";
import { getCurrentFreight } from "@/lib/freightStatus";

type Tab = "freights" | "fuel" | "expenses";
type InfoState = "LANÇADO" | "ATUAL" | "PREVISTO";

interface MetricDetail {
  title: string;
  value: string;
  description: string;
  lines?: Array<{ label: string; value: string }>;
}

const STATUS_STYLES: Record<InfoState, string> = {
  "LANÇADO": "bg-profit/10 text-profit border-profit/30",
  "ATUAL": "bg-warning/10 text-warning border-warning/30",
  "PREVISTO": "bg-info/10 text-info border-info/30",
};

const STATUS_META: Record<InfoState, { label: string; hint: string; icon: typeof CircleCheck }> = {
  "LANÇADO": {
    label: "Lançado",
    hint: "Conta feita com dados já registrados na viagem.",
    icon: CircleCheck,
  },
  "ATUAL": {
    label: "Atual",
    hint: "Valor correto neste momento, mas ainda pode mudar.",
    icon: Clock3,
  },
  "PREVISTO": {
    label: "Previsto",
    hint: "Conta feita com base na rota estimada.",
    icon: Sparkles,
  },
};

function computeSmartBanner(trip: Trip, hasRealKm: boolean, hasEstimatedKm: boolean) {
  const hasCoreData = trip.freights.length > 0 || trip.fuelings.length > 0 || trip.expenses.length > 0;

  if (!hasCoreData) {
    return {
      title: "Faltam dados da viagem",
      message: "Cadastre frete, gastos ou KM para o Copiloto mostrar contas mais completas.",
    };
  }

  if (hasRealKm) {
    return {
      title: "Viagem em andamento",
      message: "Os valores por KM abaixo já estão usando o trecho rodado de verdade.",
    };
  }

  if (hasEstimatedKm) {
    return {
      title: "Viagem em andamento",
      message: "Alguns valores abaixo ainda são previsão, porque o app está usando a rota cadastrada.",
    };
  }

  return {
    title: "Faltam dados da viagem",
    message: "Cadastre frete, gastos ou KM para o Copiloto mostrar contas mais completas.",
  };
}

const TripDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, finishTrip, deleteTrip, addFreight, updateFreight, deleteFreight, startFreight, completeFreight, addFueling, updateFueling, deleteFueling, addExpense, deleteExpense } = useApp();
  const trip = data.trips.find((t) => t.id === id);
  const [tab, setTab] = useState<Tab>("freights");
  const [showForm, setShowForm] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [activeDetail, setActiveDetail] = useState<MetricDetail | null>(null);
  const [isFinishingTrip, setIsFinishingTrip] = useState(false);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);

  const commissionsByFreight = useMemo(
    () => (trip?.freights ?? []).map((f) => ({ label: `${f.origin} → ${f.destination}`, value: formatCurrency(f.commissionValue) })),
    [trip?.freights],
  );

  if (!trip) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Viagem não encontrada.</div>;
  }

  const vehicle = data.vehicles.find((v) => v.id === trip.vehicleId);
  const isOpen = trip.status === "open";

  const grossTotal = getTripGrossRevenue(trip);
  const grossToDate = getTripGrossRevenueToDate(trip);
  const commissionsTotal = getTripTotalCommissions(trip);
  const commissionsToDate = getTripTotalCommissionsToDate(trip);
  const netTotal = getTripNetRevenue(trip);
  const netToDate = getTripNetRevenueToDate(trip);
  const avgConsumption = getTripAverageConsumption(trip);
  const totalOperationalCosts = getTripTotalExpenses(trip);
  const personalExpenses = getTripTotalPersonalExpenses(trip);
  const fuelingCost = trip.fuelings.reduce((sum, f) => sum + (f.allocatedValue ?? f.totalValue), 0);
  const otherExpenses = trip.expenses.reduce((sum, e) => sum + e.value, 0);

  const effectiveKm = getEffectiveKm(trip);
  const hasRealKm = !effectiveKm.isEstimate && effectiveKm.km > 0;
  const hasEstimatedKm = effectiveKm.isEstimate && effectiveKm.km > 0;
  const costKmTotal = effectiveKm.km > 0 ? getTripCostPerKm(trip) : 0;
  const costKmToDate = effectiveKm.km > 0 ? getTripCostPerKmToDate(trip) : 0;
  const profitKmTotal = effectiveKm.km > 0 ? getTripProfitPerKm(trip) : 0;
  const profitKmToDate = effectiveKm.km > 0 ? getTripProfitPerKmToDate(trip) : 0;

  const kmLabel = hasRealKm ? "KM rodado" : hasEstimatedKm ? "KM previsto" : "KM da viagem";
  const kmState: InfoState = hasRealKm ? "LANÇADO" : hasEstimatedKm ? "PREVISTO" : "ATUAL";
  const kmText = hasRealKm
    ? "Trecho rodado de verdade."
    : hasEstimatedKm
      ? "Distância da rota cadastrada."
      : "Aguardando dados da viagem.";

  const profitKmLabel = isOpen ? "Lucro/KM até agora" : hasRealKm ? "Lucro/KM real" : hasEstimatedKm ? "Lucro/KM previsto" : "Lucro/KM";
  const costKmLabel = isOpen ? "Custo/KM até agora" : hasRealKm ? "Custo/KM real" : hasEstimatedKm ? "Custo/KM previsto" : "Custo/KM";

  const smartBanner = computeSmartBanner(trip, hasRealKm, hasEstimatedKm);
  const activeFreight = getCurrentFreight(trip);

  const handleFinish = async (km: number) => {
    try {
      setIsFinishingTrip(true);
      await finishTrip(trip.id, km);
      setShowFinishModal(false);
      navigate("/");
    } finally {
      setIsFinishingTrip(false);
    }
  };


  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold whitespace-nowrap">Detalhes</h1>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => exportSingleTripPdf(trip, data.vehicles)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-accent transition-colors text-xs font-semibold min-h-[44px]"
            >
              <FileDown className="w-4 h-4 text-profit" /> <span className="text-profit">PDF</span>
            </button>
            {isOpen && (
              <>
                <button
                  onClick={() => setShowFinishModal(true)}
                  disabled={isFinishingTrip || isDeletingTrip}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-profit/10 hover:bg-profit/20 transition-colors text-xs font-semibold min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isFinishingTrip ? <Loader2 className="w-4 h-4 text-profit animate-spin" /> : <CheckCircle className="w-4 h-4 text-profit" />} <span className="text-profit">Finalizar</span>
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Excluir viagem?")) return;
                    try {
                      setIsDeletingTrip(true);
                      await deleteTrip(trip.id);
                      navigate("/");
                    } finally {
                      setIsDeletingTrip(false);
                    }
                  }}
                  disabled={isFinishingTrip || isDeletingTrip}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-expense/10 hover:bg-expense/20 transition-colors text-xs font-semibold min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDeletingTrip ? <Loader2 className="w-4 h-4 text-expense animate-spin" /> : <Trash2 className="w-4 h-4 text-expense" />} <span className="text-expense">Excluir</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4">
        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">Frete atual</h2>
            <p className="text-xs text-muted-foreground">Acompanhe o trecho que está rodando agora e o que falta para chegar.</p>
          </div>
          <TripHeroCard trip={trip} vehicle={vehicle} />
        </section>

        {isOpen && (
          <section className="gradient-card rounded-xl p-3.5 space-y-3 border border-border/70">
            <div className="space-y-1">
              <h3 className="text-sm font-bold">{smartBanner.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{smartBanner.message}</p>
            </div>
            <div className="pt-1 border-t border-border/50">
              <div className="flex flex-wrap gap-2">
                {(["LANÇADO", "ATUAL", "PREVISTO"] as const).map((state) => (
                  <StatusInfoPill key={state} state={state} />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Toque em um status para entender.</p>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">Viagem até agora</h2>
            <p className="text-xs text-muted-foreground">Aqui entram só os valores e lançamentos já feitos nesta viagem aberta.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label={isOpen ? "Bruto lançado" : "Bruto"}
            state="LANÇADO"
            value={formatCurrency(isOpen ? grossToDate : grossTotal)}
            icon={<DollarSign className="w-4 h-4" />}
            helperText={isOpen ? "Soma de fretes em andamento e concluídos." : "Valor total dos fretes cadastrados."}
            onClick={() => setActiveDetail({
              title: isOpen ? "Bruto lançado" : "Bruto",
              value: formatCurrency(isOpen ? grossToDate : grossTotal),
              description: isOpen
                ? "Mostra o bruto já lançado em fretes ativos/concluídos, sem incluir fretes apenas planejados."
                : "Esse é o valor total dos fretes lançados na viagem, antes dos descontos.",
              lines: isOpen
                ? [
                    { label: "Bruto lançado", value: formatCurrency(grossToDate) },
                    { label: "Bruto planejado total", value: formatCurrency(grossTotal) },
                  ]
                : [{ label: "Valor bruto total", value: formatCurrency(grossTotal) }],
            })}
          />

          <MetricCard
            label={isOpen ? "Comissão lançada" : "Comissão"}
            state="LANÇADO"
            value={formatCurrency(isOpen ? commissionsToDate : commissionsTotal)}
            icon={<Wallet className="w-4 h-4" />}
            helperText={isOpen ? "Comissão de fretes em andamento/concluídos." : "Valor da comissão do motorista."}
            onClick={() => setActiveDetail({
              title: isOpen ? "Comissão lançada" : "Comissão",
              value: formatCurrency(isOpen ? commissionsToDate : commissionsTotal),
              description: isOpen
                ? "Soma apenas comissão dos fretes já concluídos ou em andamento."
                : "Esse valor é a soma da comissão dos fretes cadastrados nesta viagem.",
              lines: isOpen
                ? [
                    { label: "Comissão lançada", value: formatCurrency(commissionsToDate) },
                    { label: "Comissão planejada total", value: formatCurrency(commissionsTotal) },
                  ]
                : commissionsByFreight.length > 1 ? commissionsByFreight : [{ label: "Comissão total", value: formatCurrency(commissionsTotal) }],
            })}
          />

          <MetricCard
            label={isOpen ? "Líquido até agora" : "Líquido"}
            state={isOpen ? "ATUAL" : "LANÇADO"}
            value={formatCurrency(isOpen ? netToDate : netTotal)}
            icon={<TrendingUp className="w-4 h-4" />}
            valueClass={(isOpen ? netToDate : netTotal) >= 0 ? "text-profit" : "text-expense"}
            helperText={isOpen ? "Esse valor ainda pode mudar." : "Resultado final da viagem."}
            onClick={() => setActiveDetail({
              title: isOpen ? "Líquido até agora" : "Líquido",
              value: formatCurrency(isOpen ? netToDate : netTotal),
              description: isOpen
                ? "Esse é o valor que sobra até agora. Ele pode mudar até o fim da viagem."
                : "Esse é o resultado final da viagem.",
              lines: [
                { label: "Bruto usado", value: formatCurrency(isOpen ? grossToDate : grossTotal) },
                { label: "- Comissão usada", value: formatCurrency(isOpen ? commissionsToDate : commissionsTotal) },
                { label: "- Abastecimentos", value: formatCurrency(fuelingCost) },
                { label: "- Despesas", value: formatCurrency(otherExpenses) },
                ...(personalExpenses > 0 ? [{ label: "- Gastos pessoais", value: formatCurrency(personalExpenses) }] : []),
              ],
            })}
          />

          <MetricCard
            label="Gastos da viagem"
            state="ATUAL"
            value={formatCurrency(totalOperationalCosts)}
            icon={<Receipt className="w-4 h-4" />}
            valueClass="text-expense"
            helperText="Soma dos gastos já lançados."
            onClick={() => setActiveDetail({
              title: "Gastos da viagem",
              value: formatCurrency(totalOperationalCosts),
              description: "Aqui entram os gastos já cadastrados na viagem até agora.",
              lines: [
                { label: "Abastecimentos", value: formatCurrency(fuelingCost) },
                { label: "Despesas", value: formatCurrency(otherExpenses) },
                { label: "Rateios", value: formatCurrency(trip.expenses.filter((e) => e.category === "combustivel_rateio").reduce((sum, e) => sum + e.value, 0)) },
              ],
            })}
          />

          <MetricCard
            label={kmLabel}
            state={kmState}
            value={effectiveKm.km > 0 ? `${formatNumber(effectiveKm.km)} km` : "—"}
            icon={<Route className="w-4 h-4" />}
            helperText={kmText}
            onClick={() => setActiveDetail({
              title: kmLabel,
              value: effectiveKm.km > 0 ? `${formatNumber(effectiveKm.km)} km` : "—",
              description: hasRealKm
                ? "Esse KM foi calculado com base no trecho já rodado."
                : hasEstimatedKm
                  ? "Esse KM foi calculado pela rota entre origem e destino."
                  : "Ainda não temos KM suficiente para mostrar essa conta.",
            })}
          />

          <MetricCard
            label="Média"
            state={avgConsumption > 0 ? "LANÇADO" : "ATUAL"}
            value={avgConsumption > 0 ? `${formatNumber(avgConsumption)} km/l` : "Aguardando"}
            icon={<Gauge className="w-4 h-4" />}
            valueClass={avgConsumption > 0 ? "text-profit" : "text-muted-foreground"}
            helperText={avgConsumption > 0 ? "Média calculada com dados reais." : "A média aparece com abastecimentos suficientes."}
            onClick={() => setActiveDetail({
              title: "Média",
              value: avgConsumption > 0 ? `${formatNumber(avgConsumption)} km/l` : "Aguardando",
              description: avgConsumption > 0
                ? "A média aparece com base nos abastecimentos completos já lançados."
                : "Média ainda não disponível. Ela aparece depois de abastecimentos suficientes.",
            })}
          />

          <MetricCard
            label={profitKmLabel}
            state={hasRealKm ? "LANÇADO" : hasEstimatedKm ? "PREVISTO" : "ATUAL"}
            value={effectiveKm.km > 0 ? `R$ ${formatNumber(isOpen ? profitKmToDate : profitKmTotal)}` : "—"}
            icon={<TrendingUp className="w-4 h-4" />}
            valueClass={effectiveKm.km > 0 ? "text-profit" : "text-muted-foreground"}
            helperText={hasRealKm ? "Conta feita com o trecho rodado." : hasEstimatedKm ? "Conta feita pela rota cadastrada." : "Aguardando KM da viagem."}
            onClick={() => setActiveDetail({
              title: profitKmLabel,
              value: effectiveKm.km > 0 ? `R$ ${formatNumber(isOpen ? profitKmToDate : profitKmTotal)}` : "—",
              description: effectiveKm.km > 0
                ? `${hasEstimatedKm ? "Esse valor ainda pode mudar durante a viagem. " : ""}Como o Copiloto chegou nesse valor.`
                : "Aguardando KM da viagem.",
              lines: effectiveKm.km > 0
                ? [
                    { label: "Líquido usado", value: formatCurrency(isOpen ? netToDate : netTotal) },
                    { label: "KM usado", value: `${formatNumber(effectiveKm.km)} km` },
                    { label: "Conta", value: `${formatCurrency(isOpen ? netToDate : netTotal)} ÷ ${formatNumber(effectiveKm.km)} km` },
                  ]
                : undefined,
            })}
          />

          <MetricCard
            label={costKmLabel}
            state={hasRealKm ? "LANÇADO" : hasEstimatedKm ? "PREVISTO" : "ATUAL"}
            value={effectiveKm.km > 0 ? `R$ ${formatNumber(isOpen ? costKmToDate : costKmTotal)}` : "—"}
            icon={<TrendingDown className="w-4 h-4" />}
            valueClass={effectiveKm.km > 0 ? "text-expense" : "text-muted-foreground"}
            helperText={hasRealKm ? "Conta feita com o trecho rodado." : hasEstimatedKm ? "Conta feita pela rota cadastrada." : "Aguardando KM da viagem."}
            onClick={() => setActiveDetail({
              title: costKmLabel,
              value: effectiveKm.km > 0 ? `R$ ${formatNumber(isOpen ? costKmToDate : costKmTotal)}` : "—",
              description: effectiveKm.km > 0
                ? `${hasEstimatedKm ? "Esse valor ainda pode mudar durante a viagem. " : ""}Aqui entram comissão, abastecimentos e despesas divididos pelo KM usado.`
                : "Aguardando KM da viagem.",
              lines: effectiveKm.km > 0
                ? [
                    { label: "Comissão usada", value: formatCurrency(isOpen ? commissionsToDate : commissionsTotal) },
                    { label: "Abastecimentos", value: formatCurrency(fuelingCost) },
                    { label: "Despesas", value: formatCurrency(otherExpenses) },
                    { label: "KM usado", value: `${formatNumber(effectiveKm.km)} km` },
                  ]
                : undefined,
            })}
          />
          </div>
        </section>

        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">Visão geral da viagem</h2>
            <p className="text-xs text-muted-foreground">Leitura rápida para separar o que é do frete atual do que já ficou consolidado na viagem.</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div className="gradient-card rounded-xl p-3 border border-border/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resumo rápido</p>
                  <h3 className="text-sm font-bold text-foreground">Frete atual x viagem até agora</h3>
                </div>
                <span className="text-[11px] text-muted-foreground">Sem mudar a lógica da viagem</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Frete atual</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{activeFreight ? `${activeFreight.origin} → ${activeFreight.destination}` : "Sem frete em andamento"}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{activeFreight ? "Esse bloco acompanha o trecho em andamento, ETA e status do momento." : "Quando um frete for iniciado, ele aparece aqui com progresso e previsão."}</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Viagem até agora</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(netToDate)}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Resultado parcial com bruto lançado, comissão, abastecimentos e despesas já registrados.</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total da viagem</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(netTotal)}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Inclui também o que já está planejado para a viagem inteira, mesmo antes de acontecer.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {([[
            "freights",
            "Fretes",
            MapPin,
          ], ["fuel", "Abastecimentos", Fuel], ["expenses", "Despesas", Receipt]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setShowForm(false);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                tab === key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === "freights" && <FreightTab trip={trip} vehicle={vehicle} isOpen={isOpen} showForm={showForm} setShowForm={setShowForm} addFreight={addFreight} updateFreight={updateFreight} deleteFreight={deleteFreight} startFreight={startFreight} completeFreight={completeFreight} onRequestOpenFreightForm={() => setShowForm(true)} />}
        {tab === "fuel" && <FuelTab trip={trip} isOpen={isOpen} addFueling={addFueling} updateFueling={updateFueling} deleteFueling={deleteFueling} />}
        {tab === "expenses" && <ExpenseTab trip={trip} isOpen={isOpen} showForm={showForm} setShowForm={setShowForm} addExpense={addExpense} deleteExpense={deleteExpense} />}
      </div>

      <MetricDetailDialog detail={activeDetail} onClose={() => setActiveDetail(null)} />

      <FinishTripModal
        open={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        minKm={vehicle?.currentKm || 0}
        activeFreight={activeFreight ? { origin: activeFreight.origin, destination: activeFreight.destination } : null}
        onConfirm={handleFinish}
        isSubmitting={isFinishingTrip}
      />
    </div>
  );
};

function StatusInfoPill({ state }: { state: InfoState }) {
  const meta = STATUS_META[state];
  const Icon = meta.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${STATUS_STYLES[state]} hover:opacity-90`}
        >
          <Icon className="w-3.5 h-3.5" />
          {meta.label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-[260px] rounded-xl border-border/70 p-3">
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border ${STATUS_STYLES[state]}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{meta.label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{meta.hint}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MetricCard({
  label,
  value,
  icon,
  state,
  helperText,
  valueClass = "text-foreground",
  onClick,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  state: InfoState;
  helperText: string;
  valueClass?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="gradient-card rounded-xl p-3 text-left min-h-[120px] border border-transparent hover:border-border/70 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          {icon}
          <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
        </div>
        <MetricStateDot state={state} />
      </div>
      <p className={`text-base font-bold font-mono ${valueClass}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{helperText}</p>
    </button>
  );
}

function MetricStateDot({ state }: { state: InfoState }) {
  const Icon = STATUS_META[state].icon;

  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${STATUS_STYLES[state]}`}
      aria-label={`Status ${STATUS_META[state].label}`}
      title={STATUS_META[state].label}
    >
      <Icon className="w-3.5 h-3.5" />
    </span>
  );
}

function MetricDetailDialog({ detail, onClose }: { detail: MetricDetail | null; onClose: () => void }) {
  return (
    <Dialog open={!!detail} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm rounded-xl">
        {detail && (
          <>
            <DialogHeader>
              <DialogTitle>{detail.title}</DialogTitle>
              <DialogDescription className="text-2xl font-mono font-black text-foreground pt-1">{detail.value}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{detail.description}</p>
              {detail.lines && detail.lines.length > 0 && (
                <div className="space-y-2 bg-secondary/60 rounded-lg p-3">
                  {detail.lines.map((line) => (
                    <div key={line.label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{line.label}</span>
                      <span className="font-semibold font-mono">{line.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TripDetailPage;

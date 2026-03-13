import { ReactNode, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/context/app-context";
import {
  getTripGrossRevenue,
  getTripNetRevenue,
  getTripAverageConsumption,
  getTripCostPerKm,
  getTripProfitPerKm,
  getEffectiveKm,
  getTripTotalCommissions,
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
  FileDown,
  Route,
  Wallet,
} from "lucide-react";
import { exportSingleTripPdf } from "@/lib/exportPdf";
import { FinishTripModal } from "@/components/FinishTripModal";
import { TripHeroCard } from "@/components/TripHeroCard";
import { FreightTab } from "@/components/trip/FreightTab";
import { FuelTab } from "@/components/trip/FuelTab";
import { ExpenseTab } from "@/components/trip/ExpenseTab";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trip } from "@/types";

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
  const { data, finishTrip, deleteTrip, addFreight, deleteFreight, addFueling, updateFueling, deleteFueling, addExpense, deleteExpense } = useApp();
  const trip = data.trips.find((t) => t.id === id);
  const [tab, setTab] = useState<Tab>("freights");
  const [showForm, setShowForm] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [activeDetail, setActiveDetail] = useState<MetricDetail | null>(null);

  const commissionsByFreight = useMemo(
    () => (trip?.freights ?? []).map((f) => ({ label: `${f.origin} → ${f.destination}`, value: formatCurrency(f.commissionValue) })),
    [trip?.freights],
  );

  if (!trip) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Viagem não encontrada.</div>;
  }

  const vehicle = data.vehicles.find((v) => v.id === trip.vehicleId);
  const isOpen = trip.status === "open";

  const gross = getTripGrossRevenue(trip);
  const commissions = getTripTotalCommissions(trip);
  const net = getTripNetRevenue(trip);
  const avgConsumption = getTripAverageConsumption(trip);
  const totalOperationalCosts = getTripTotalExpenses(trip);
  const personalExpenses = getTripTotalPersonalExpenses(trip);
  const fuelingCost = trip.fuelings.reduce((sum, f) => sum + (f.allocatedValue ?? f.totalValue), 0);
  const otherExpenses = trip.expenses.reduce((sum, e) => sum + e.value, 0);

  const effectiveKm = getEffectiveKm(trip);
  const hasRealKm = !effectiveKm.isEstimate && effectiveKm.km > 0;
  const hasEstimatedKm = effectiveKm.isEstimate && effectiveKm.km > 0;
  const costKm = effectiveKm.km > 0 ? getTripCostPerKm(trip) : 0;
  const profitKm = effectiveKm.km > 0 ? getTripProfitPerKm(trip) : 0;

  const kmLabel = hasRealKm ? "KM rodado" : hasEstimatedKm ? "KM previsto" : "KM da viagem";
  const kmState: InfoState = hasRealKm ? "LANÇADO" : hasEstimatedKm ? "PREVISTO" : "ATUAL";
  const kmText = hasRealKm
    ? "Trecho rodado de verdade."
    : hasEstimatedKm
      ? "Distância da rota cadastrada."
      : "Aguardando dados da viagem.";

  const profitKmLabel = hasRealKm ? "Lucro/KM real" : hasEstimatedKm ? "Lucro/KM previsto" : "Lucro/KM";
  const costKmLabel = hasRealKm ? "Custo/KM real" : hasEstimatedKm ? "Custo/KM previsto" : "Custo/KM";

  const smartBanner = computeSmartBanner(trip, hasRealKm, hasEstimatedKm);

  const handleFinish = async (km: number) => {
    await finishTrip(trip.id, km);
    setShowFinishModal(false);
    navigate("/");
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
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-profit/10 hover:bg-profit/20 transition-colors text-xs font-semibold min-h-[44px]"
                >
                  <CheckCircle className="w-4 h-4 text-profit" /> <span className="text-profit">Finalizar</span>
                </button>
                <button
                  onClick={async () => {
                    if (confirm("Excluir viagem?")) {
                      await deleteTrip(trip.id);
                      navigate("/");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-expense/10 hover:bg-expense/20 transition-colors text-xs font-semibold min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4 text-expense" /> <span className="text-expense">Excluir</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4">
        <TripHeroCard trip={trip} vehicle={vehicle} />

        {isOpen && (
          <section className="gradient-card rounded-xl p-3.5 space-y-3 border border-border/70">
            <div>
              <h3 className="text-sm font-bold">{smartBanner.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{smartBanner.message}</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <StatusLegendChip
                state="LANÇADO"
                text="conta feita com dados já lançados na viagem"
              />
              <StatusLegendChip
                state="ATUAL"
                text="valor certo neste momento, mas ainda pode mudar"
              />
              <StatusLegendChip
                state="PREVISTO"
                text="conta feita com base na rota cadastrada"
              />
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="Bruto"
            state="LANÇADO"
            value={formatCurrency(gross)}
            icon={<DollarSign className="w-4 h-4" />}
            helperText="Valor dos fretes cadastrados."
            onClick={() => setActiveDetail({
              title: "Bruto",
              value: formatCurrency(gross),
              description: "Esse é o valor total dos fretes lançados na viagem, antes dos descontos.",
              lines: [{ label: "Valor bruto total", value: formatCurrency(gross) }],
            })}
          />

          <MetricCard
            label="Comissão"
            state="LANÇADO"
            value={formatCurrency(commissions)}
            icon={<Wallet className="w-4 h-4" />}
            helperText="Valor da comissão do motorista."
            onClick={() => setActiveDetail({
              title: "Comissão",
              value: formatCurrency(commissions),
              description: "Esse valor é a soma da comissão dos fretes cadastrados nesta viagem.",
              lines: commissionsByFreight.length > 1 ? commissionsByFreight : [{ label: "Comissão total", value: formatCurrency(commissions) }],
            })}
          />

          <MetricCard
            label={isOpen ? "Líquido até agora" : "Líquido"}
            state={isOpen ? "ATUAL" : "LANÇADO"}
            value={formatCurrency(net)}
            icon={<TrendingUp className="w-4 h-4" />}
            valueClass={net >= 0 ? "text-profit" : "text-expense"}
            helperText={isOpen ? "Esse valor ainda pode mudar." : "Resultado final da viagem."}
            onClick={() => setActiveDetail({
              title: isOpen ? "Líquido até agora" : "Líquido",
              value: formatCurrency(net),
              description: isOpen
                ? "Esse é o valor que sobra até agora. Ele pode mudar até o fim da viagem."
                : "Esse é o resultado final da viagem.",
              lines: [
                { label: "Bruto", value: formatCurrency(gross) },
                { label: "- Comissão", value: formatCurrency(commissions) },
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
            value={effectiveKm.km > 0 ? `R$ ${formatNumber(profitKm)}` : "—"}
            icon={<TrendingUp className="w-4 h-4" />}
            valueClass={effectiveKm.km > 0 ? "text-profit" : "text-muted-foreground"}
            helperText={hasRealKm ? "Conta feita com o trecho rodado." : hasEstimatedKm ? "Conta feita pela rota cadastrada." : "Aguardando KM da viagem."}
            onClick={() => setActiveDetail({
              title: profitKmLabel,
              value: effectiveKm.km > 0 ? `R$ ${formatNumber(profitKm)}` : "—",
              description: effectiveKm.km > 0
                ? `${hasEstimatedKm ? "Esse valor ainda pode mudar durante a viagem. " : ""}Como o Copiloto chegou nesse valor.`
                : "Aguardando KM da viagem.",
              lines: effectiveKm.km > 0
                ? [
                    { label: "Líquido usado", value: formatCurrency(net) },
                    { label: "KM usado", value: `${formatNumber(effectiveKm.km)} km` },
                    { label: "Conta", value: `${formatCurrency(net)} ÷ ${formatNumber(effectiveKm.km)} km` },
                  ]
                : undefined,
            })}
          />

          <MetricCard
            label={costKmLabel}
            state={hasRealKm ? "LANÇADO" : hasEstimatedKm ? "PREVISTO" : "ATUAL"}
            value={effectiveKm.km > 0 ? `R$ ${formatNumber(costKm)}` : "—"}
            icon={<TrendingDown className="w-4 h-4" />}
            valueClass={effectiveKm.km > 0 ? "text-expense" : "text-muted-foreground"}
            helperText={hasRealKm ? "Conta feita com o trecho rodado." : hasEstimatedKm ? "Conta feita pela rota cadastrada." : "Aguardando KM da viagem."}
            onClick={() => setActiveDetail({
              title: costKmLabel,
              value: effectiveKm.km > 0 ? `R$ ${formatNumber(costKm)}` : "—",
              description: effectiveKm.km > 0
                ? `${hasEstimatedKm ? "Esse valor ainda pode mudar durante a viagem. " : ""}Aqui entram comissão, abastecimentos e despesas divididos pelo KM usado.`
                : "Aguardando KM da viagem.",
              lines: effectiveKm.km > 0
                ? [
                    { label: "Comissão", value: formatCurrency(commissions) },
                    { label: "Abastecimentos", value: formatCurrency(fuelingCost) },
                    { label: "Despesas", value: formatCurrency(otherExpenses) },
                    { label: "KM usado", value: `${formatNumber(effectiveKm.km)} km` },
                  ]
                : undefined,
            })}
          />
        </div>

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

        {tab === "freights" && <FreightTab trip={trip} vehicle={vehicle} isOpen={isOpen} showForm={showForm} setShowForm={setShowForm} addFreight={addFreight} deleteFreight={deleteFreight} />}
        {tab === "fuel" && <FuelTab trip={trip} isOpen={isOpen} addFueling={addFueling} updateFueling={updateFueling} deleteFueling={deleteFueling} />}
        {tab === "expenses" && <ExpenseTab trip={trip} isOpen={isOpen} showForm={showForm} setShowForm={setShowForm} addExpense={addExpense} deleteExpense={deleteExpense} />}
      </div>

      <MetricDetailDialog detail={activeDetail} onClose={() => setActiveDetail(null)} />

      <FinishTripModal
        open={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        minKm={vehicle?.currentKm || 0}
        onConfirm={handleFinish}
      />
    </div>
  );
};

function StatusLegendChip({ state, text }: { state: InfoState; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground min-h-6">
      <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none ${STATUS_STYLES[state]}`}>{state}</span>
      <span>{state} = {text}</span>
    </div>
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
        <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-bold leading-none ${STATUS_STYLES[state]}`}>{state}</span>
      </div>
      <p className={`text-base font-bold font-mono ${valueClass}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{helperText}</p>
    </button>
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

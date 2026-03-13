import { formatCurrency, formatNumber } from "@/lib/calculations";

export type FreightQualityLabel = "FRETE RUIM" | "FRETE MAIS OU MENOS" | "FRETE QUALIFICADO";

export interface EtaResult {
  durationHours: number;
  durationLabel: string;
  arrivalLabel: string;
}

export interface FreightSummaryData {
  origin: string;
  destination: string;
  distanceKm: number;
  avgSpeedKmH: number;
  etaDurationLabel: string;
  etaArrivalLabel: string;
  offeredValue: number;
  anttFloor: number;
  fuelCost: number;
  tollCost: number;
  valePedagio: boolean;
  dieselPrice: number;
  avgKmPerLiter: number;
  axles: number;
  cargoTypeLabel: string;
  commissionPercent: number;
  commissionValue: number;
  totalExpenses: number;
  netProfit: number;
  profitPerKm: number;
  profitMargin: number;
  freightQualityLabel: FreightQualityLabel;
  incluiCargaDescarga: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatHourMinute(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatArrival(date: Date, now: Date): string {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayDiff = Math.round((dateOnly - nowOnly) / DAY_MS);

  if (dayDiff === 0) return `hoje, ${formatHourMinute(date)}`;
  if (dayDiff === 1) return `amanhã, ${formatHourMinute(date)}`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function calculateEta(distanceKm: number, avgSpeedKmH: number, now = new Date()): EtaResult | null {
  if (distanceKm <= 0 || avgSpeedKmH <= 0) return null;

  const durationHours = distanceKm / avgSpeedKmH;
  const totalMinutes = Math.max(1, Math.round(durationHours * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const durationLabel = hours > 0 ? `${hours}h ${minutes.toString().padStart(2, "0")}min` : `${minutes}min`;

  const arrivalDate = new Date(now.getTime() + totalMinutes * 60 * 1000);

  return {
    durationHours,
    durationLabel,
    arrivalLabel: formatArrival(arrivalDate, now),
  };
}

function getPedagioLine(data: FreightSummaryData): string {
  if (data.valePedagio) return "Pedágio: pago pela transportadora (vale-pedágio)";
  return `Pedágio: ${formatCurrency(data.tollCost)}`;
}

export function buildShortFreightSummary(data: FreightSummaryData): string {
  return [
    "🚛 *Análise de Frete - Resumo Curto*",
    "",
    `📍 *Rota:* ${data.origin} → ${data.destination}`,
    `📏 Distância: ${formatNumber(data.distanceKm)} km`,
    `⏱️ Tempo estimado: ${data.etaDurationLabel}`,
    `🕒 Chegada prevista: ${data.etaArrivalLabel}`,
    "",
    "💰 *Resultado*",
    `Frete: ${formatCurrency(data.offeredValue)}`,
    `Lucro líquido: ${formatCurrency(data.netProfit)}`,
    `Lucro por km: ${formatCurrency(data.profitPerKm)}`,
    `Margem: ${data.profitMargin.toFixed(1)}%`,
    "",
    `🏁 *Classificação:* ${data.freightQualityLabel}`,
  ].join("\n");
}

export function buildCompleteFreightSummary(data: FreightSummaryData): string {
  return [
    "🚛 *Análise de Frete - Resumo Completo*",
    "",
    "📍 *ROTA*",
    `Origem: ${data.origin}`,
    `Destino: ${data.destination}`,
    `Distância: ${formatNumber(data.distanceKm)} km`,
    `Tempo estimado: ${data.etaDurationLabel}`,
    `Chegada prevista: ${data.etaArrivalLabel}`,
    "",
    "⚙️ *CONFIGURAÇÃO*",
    `Diesel: ${formatCurrency(data.dieselPrice)}/L`,
    `Média: ${formatNumber(data.avgKmPerLiter)} km/L`,
    `Eixos: ${data.axles}`,
    `Tipo de carga: ${data.cargoTypeLabel}`,
    `Comissão: ${data.commissionPercent}% (${formatCurrency(data.commissionValue)})`,
    `Vale-pedágio: ${data.valePedagio ? "Sim" : "Não"}`,
    `Carga/descarga incluída: ${data.incluiCargaDescarga ? "Sim" : "Não"}`,
    "",
    "💵 *RESULTADO FINANCEIRO*",
    `Valor do frete: ${formatCurrency(data.offeredValue)}`,
    `Piso ANTT: ${formatCurrency(data.anttFloor)}`,
    `Combustível: ${formatCurrency(data.fuelCost)}`,
    getPedagioLine(data),
    `Comissão (R$): ${formatCurrency(data.commissionValue)}`,
    `Total de despesas: ${formatCurrency(data.totalExpenses)}`,
    `Lucro líquido: ${formatCurrency(data.netProfit)}`,
    `Lucro por km: ${formatCurrency(data.profitPerKm)}`,
    `Margem: ${data.profitMargin.toFixed(1)}%`,
    `Classificação: ${data.freightQualityLabel}`,
  ].join("\n");
}

export function getWhatsAppLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

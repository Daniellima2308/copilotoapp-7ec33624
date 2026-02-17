import { Trip } from "@/types";

export function getTripGrossRevenue(trip: Trip): number {
  return trip.freights.reduce((sum, f) => sum + f.grossValue, 0);
}

export function getTripTotalCommissions(trip: Trip): number {
  return trip.freights.reduce((sum, f) => sum + f.commissionValue, 0);
}

export function getTripTotalExpenses(trip: Trip): number {
  return trip.expenses.reduce((sum, e) => sum + e.value, 0) +
    trip.fuelings.reduce((sum, f) => sum + f.totalValue, 0);
}

export function getTripNetRevenue(trip: Trip): number {
  return getTripGrossRevenue(trip) - getTripTotalCommissions(trip) - getTripTotalExpenses(trip);
}

export function getTripTotalKm(trip: Trip): number {
  if (trip.fuelings.length === 0) return 0;
  const firstKm = trip.freights[0]?.kmInitial ?? 0;
  const lastKm = trip.fuelings[trip.fuelings.length - 1]?.kmCurrent ?? 0;
  return lastKm - firstKm;
}

export function getTripAverageConsumption(trip: Trip): number {
  const totalLiters = trip.fuelings.reduce((sum, f) => sum + f.liters, 0);
  const totalKm = getTripTotalKm(trip);
  if (totalLiters === 0) return 0;
  return Math.round((totalKm / totalLiters) * 100) / 100;
}

export function getTripCostPerKm(trip: Trip): number {
  const km = getTripTotalKm(trip);
  if (km === 0) return 0;
  const totalCost = getTripTotalExpenses(trip) + getTripTotalCommissions(trip);
  return Math.round((totalCost / km) * 100) / 100;
}

export function getTripProfitPerKm(trip: Trip): number {
  const km = getTripTotalKm(trip);
  if (km === 0) return 0;
  return Math.round((getTripNetRevenue(trip) / km) * 100) / 100;
}

export function getLastDestination(trip: Trip): string {
  if (trip.freights.length === 0) return "—";
  return trip.freights[trip.freights.length - 1].destination;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("pt-BR");
}

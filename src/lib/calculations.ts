import { Trip } from "@/types";

export function getTripGrossRevenue(trip: Trip): number {
  return trip.freights.reduce((sum, f) => sum + f.grossValue, 0);
}

export function getTripTotalCommissions(trip: Trip): number {
  return trip.freights.reduce((sum, f) => sum + f.commissionValue, 0);
}

export function getTripTotalExpenses(trip: Trip): number {
  return trip.expenses.reduce((sum, e) => sum + e.value, 0) +
    trip.fuelings.reduce((sum, f) => sum + (f.allocatedValue ?? f.totalValue), 0);
}

export function getTripTotalPersonalExpenses(trip: Trip): number {
  return (trip.personalExpenses || []).reduce((sum, e) => sum + e.value, 0);
}

export function getTripNetRevenue(trip: Trip): number {
  return getTripGrossRevenue(trip) - getTripTotalCommissions(trip) - getTripTotalExpenses(trip) - getTripTotalPersonalExpenses(trip);
}

export function getTripTotalKm(trip: Trip): number {
  const checkpoints = [
    ...trip.fuelings.map((f) => f.kmCurrent),
    ...trip.freights.map((f) => f.kmInitial),
  ].filter((km) => km > 0);

  if (checkpoints.length < 2) return 0;

  const startKm = Math.min(...checkpoints);
  const endKm = Math.max(...checkpoints);
  const total = endKm - startKm;
  return total > 0 ? total : 0;
}

export function getTripAverageConsumption(trip: Trip): number {
  // Only consider fuelings with fullTank that have a calculated average
  const fullTankFuelings = trip.fuelings.filter((f) => (f.fullTank ?? true) && f.average > 0);
  if (fullTankFuelings.length === 0) return 0;
  const avgSum = fullTankFuelings.reduce((sum, f) => sum + f.average, 0);
  return Math.round((avgSum / fullTankFuelings.length) * 100) / 100;
}

export function getEffectiveKm(trip: Trip): { km: number; isEstimate: boolean } {
  const actual = getTripTotalKm(trip);
  if (actual > 0) return { km: actual, isEstimate: false };
  if (trip.estimatedDistance > 0) return { km: trip.estimatedDistance, isEstimate: true };
  return { km: 0, isEstimate: false };
}

export function getTripCostPerKm(trip: Trip): number {
  const { km } = getEffectiveKm(trip);
  if (km === 0) return 0;
  const totalCost = getTripTotalExpenses(trip) + getTripTotalCommissions(trip);
  return Math.round((totalCost / km) * 100) / 100;
}

export function getTripProfitPerKm(trip: Trip): number {
  const { km } = getEffectiveKm(trip);
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

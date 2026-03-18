import { Freight, Trip } from "@/types";

export function getOperationalFreights(trip: Trip): Freight[] {
  return trip.freights.filter((freight) => freight.status === "in_progress" || freight.status === "completed");
}

export function getPlannedFreights(trip: Trip): Freight[] {
  return trip.freights.filter((freight) => freight.status === "planned");
}

export function getTripGrossRevenue(trip: Trip): number {
  return trip.freights.reduce((sum, f) => sum + f.grossValue, 0);
}

export function getTripGrossRevenueToDate(trip: Trip): number {
  return getOperationalFreights(trip).reduce((sum, f) => sum + f.grossValue, 0);
}

export function getTripTotalCommissions(trip: Trip): number {
  return trip.freights.reduce((sum, f) => sum + f.commissionValue, 0);
}

export function getTripTotalCommissionsToDate(trip: Trip): number {
  return getOperationalFreights(trip).reduce((sum, f) => sum + f.commissionValue, 0);
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

export function getTripNetRevenueToDate(trip: Trip): number {
  return getTripGrossRevenueToDate(trip) - getTripTotalCommissionsToDate(trip) - getTripTotalExpenses(trip) - getTripTotalPersonalExpenses(trip);
}

function getKmFromCheckpoints(checkpoints: number[]): number {
  const validCheckpoints = checkpoints.filter((km) => km > 0);
  if (validCheckpoints.length < 2) return 0;

  const startKm = Math.min(...validCheckpoints);
  const endKm = Math.max(...validCheckpoints);
  const total = endKm - startKm;
  return total > 0 ? total : 0;
}

export function getTripActualKmToDate(trip: Trip): number {
  const checkpoints = [
    ...trip.fuelings.map((f) => f.kmCurrent),
    ...getOperationalFreights(trip).map((f) => f.kmInitial),
  ];

  return getKmFromCheckpoints(checkpoints);
}

export function getTripTotalKm(trip: Trip): number {
  return getTripActualKmToDate(trip);
}

export function getTripActualKmTotal(trip: Trip): number {
  return getTripActualKmToDate(trip);
}

export function getTripLatestCheckpointKm(trip: Trip): number {
  const checkpoints = [
    ...trip.fuelings.map((f) => f.kmCurrent),
    ...getOperationalFreights(trip).map((f) => f.kmInitial),
  ].filter((km) => km > 0);

  if (checkpoints.length === 0) return 0;
  return Math.max(...checkpoints);
}

export function getTripAverageConsumption(trip: Trip): number {
  // Only consider fuelings with fullTank that have a calculated average
  const fullTankFuelings = trip.fuelings.filter((f) => (f.fullTank ?? true) && f.average > 0);
  if (fullTankFuelings.length === 0) return 0;
  const avgSum = fullTankFuelings.reduce((sum, f) => sum + f.average, 0);
  return Math.round((avgSum / fullTankFuelings.length) * 100) / 100;
}

export function getTripEstimatedKmToDate(trip: Trip): number {
  return getOperationalFreights(trip).reduce(
    (sum, freight) => sum + (freight.estimatedDistance > 0 ? freight.estimatedDistance : 0),
    0,
  );
}

export function getTripKmBasisToDate(trip: Trip): { km: number; source: "actual" | "estimated" | "none" } {
  const actual = getTripActualKmToDate(trip);
  if (actual > 0) return { km: actual, source: "actual" };

  const estimated = getTripEstimatedKmToDate(trip);
  if (estimated > 0) return { km: estimated, source: "estimated" };

  return { km: 0, source: "none" };
}

export function getTripEstimatedKmTotal(trip: Trip): number {
  const freightEstimatedTotal = trip.freights.reduce(
    (sum, freight) => sum + (freight.estimatedDistance > 0 ? freight.estimatedDistance : 0),
    0,
  );

  if (trip.estimatedDistance > 0) {
    return trip.estimatedDistance;
  }

  return freightEstimatedTotal;
}

export function getTripKmBasisTotal(trip: Trip): { km: number; source: "actual" | "estimated" | "none" } {
  const actual = getTripActualKmTotal(trip);
  if (trip.status === "finished" && actual > 0) return { km: actual, source: "actual" };

  const estimated = getTripEstimatedKmTotal(trip);
  if (estimated > 0) return { km: estimated, source: "estimated" };

  if (actual > 0) return { km: actual, source: "actual" };

  return { km: 0, source: "none" };
}

export function getEffectiveKm(trip: Trip): { km: number; isEstimate: boolean } {
  const basis = trip.status === "open" ? getTripKmBasisToDate(trip) : getTripKmBasisTotal(trip);
  return { km: basis.km, isEstimate: basis.source === "estimated" };
}

export function getTripCostPerKm(trip: Trip): number {
  const { km } = getTripKmBasisTotal(trip);
  if (km === 0) return 0;
  const totalCost = getTripTotalExpenses(trip) + getTripTotalCommissions(trip);
  return Math.round((totalCost / km) * 100) / 100;
}

export function getTripCostPerKmToDate(trip: Trip): number {
  const { km } = getTripKmBasisToDate(trip);
  if (km === 0) return 0;
  const totalCost = getTripTotalExpenses(trip) + getTripTotalCommissionsToDate(trip);
  return Math.round((totalCost / km) * 100) / 100;
}

export function getTripProfitPerKm(trip: Trip): number {
  const { km } = getTripKmBasisTotal(trip);
  if (km === 0) return 0;
  return Math.round((getTripNetRevenue(trip) / km) * 100) / 100;
}

export function getTripProfitPerKmToDate(trip: Trip): number {
  const { km } = getTripKmBasisToDate(trip);
  if (km === 0) return 0;
  return Math.round((getTripNetRevenueToDate(trip) / km) * 100) / 100;
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

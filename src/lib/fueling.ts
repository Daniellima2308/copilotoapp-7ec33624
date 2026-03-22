import { Trip } from "@/types";

export interface FuelingPersistenceRecord {
  id: string;
  tripId: string;
  stationName: string;
  totalValue: number;
  liters: number;
  kmCurrent: number;
  fullTank: boolean;
  date: string;
  receiptUrl?: string | null;
  originalTotalValue?: number | null;
}

export interface FuelingRateioExpense {
  tripId: string;
  value: number;
  date: string;
  description: string;
  sourceFuelingId: string;
}

export interface FuelingComputedState {
  id: string;
  effectiveTripValue: number;
  originalTotalValue: number | null;
  allocatedValue: number | null;
  average: number;
  pricePerLiter: number;
  rateioExpenses: FuelingRateioExpense[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function sortFuelingsByTimeline<T extends { id?: string; kmCurrent: number; date?: string }>(fuelings: T[]): T[] {
  return [...fuelings].sort((a, b) => {
    if (a.kmCurrent !== b.kmCurrent) return a.kmCurrent - b.kmCurrent;
    const dateCompare = (a.date || "").localeCompare(b.date || "");
    if (dateCompare !== 0) return dateCompare;
    return (a.id || "").localeCompare(b.id || "");
  });
}

export function getFuelingOriginalTotalValue(fueling: {
  totalValue: number;
  originalTotalValue?: number | null;
}) {
  return round2(fueling.originalTotalValue ?? fueling.totalValue);
}

export function calculateFuelingPricePerLiter(totalValue: number, liters: number) {
  if (!Number.isFinite(totalValue) || !Number.isFinite(liters) || liters <= 0) {
    return 0;
  }

  return round2(totalValue / liters);
}

function getTripStartKmFromTrip(trip: Pick<Trip, "fuelings" | "freights">) {
  const checkpoints = [
    ...trip.fuelings.map((fueling) => fueling.kmCurrent),
    ...trip.freights
      .filter((freight) => freight.status === "in_progress" || freight.status === "completed")
      .map((freight) => freight.kmInitial),
  ].filter((km): km is number => Number.isFinite(km) && km >= 0);

  if (checkpoints.length === 0) return null;
  return Math.min(...checkpoints);
}

export function buildTripStartKmMap(trips: Trip[]) {
  const entries = trips
    .map((trip) => ({ tripId: trip.id, startKm: getTripStartKmFromTrip(trip) }))
    .filter((entry): entry is { tripId: string; startKm: number } => entry.startKm != null);

  return new Map(entries.map((entry) => [entry.tripId, entry.startKm]));
}

function allocateAcrossTrips(params: {
  fueling: FuelingPersistenceRecord;
  previousFullTank: FuelingPersistenceRecord;
  tripStartKmMap: Map<string, number>;
}) {
  const totalInvoiceValue = getFuelingOriginalTotalValue(params.fueling);
  const distanceTotal = params.fueling.kmCurrent - params.previousFullTank.kmCurrent;

  const defaultAllocation = {
    effectiveTripValue: totalInvoiceValue,
    allocatedValue: null,
    originalTotalValue: null,
    rateioExpenses: [] as FuelingRateioExpense[],
  };

  if (
    !params.fueling.fullTank ||
    params.fueling.liters <= 0 ||
    totalInvoiceValue <= 0 ||
    distanceTotal <= 0
  ) {
    return defaultAllocation;
  }

  const currentTripStartKm =
    params.tripStartKmMap.get(params.fueling.tripId) ?? params.fueling.kmCurrent;

  if (
    params.previousFullTank.tripId === params.fueling.tripId ||
    params.previousFullTank.kmCurrent >= currentTripStartKm
  ) {
    return defaultAllocation;
  }

  const checkpointEntries = Array.from(params.tripStartKmMap.entries())
    .map(([tripId, startKm]) => ({ tripId, startKm }))
    .filter((entry) => entry.startKm <= params.fueling.kmCurrent);

  if (!checkpointEntries.some((entry) => entry.tripId === params.fueling.tripId)) {
    checkpointEntries.push({ tripId: params.fueling.tripId, startKm: currentTripStartKm });
  }

  if (!checkpointEntries.some((entry) => entry.tripId === params.previousFullTank.tripId)) {
    checkpointEntries.push({ tripId: params.previousFullTank.tripId, startKm: params.previousFullTank.kmCurrent });
  }

  const checkpoints = checkpointEntries
    .sort((a, b) => a.startKm - b.startKm || a.tripId.localeCompare(b.tripId))
    .filter((entry, index, list) => index === list.findIndex((candidate) => candidate.tripId === entry.tripId));

  const kmByTrip = new Map<string, number>();
  const segmentStartKm = params.previousFullTank.kmCurrent;
  const segmentEndKm = params.fueling.kmCurrent;

  for (let index = 0; index < checkpoints.length; index += 1) {
    const checkpoint = checkpoints[index];
    const nextStartKm = checkpoints[index + 1]?.startKm ?? segmentEndKm;
    const intervalStart = Math.max(segmentStartKm, checkpoint.startKm);
    const intervalEnd = Math.min(segmentEndKm, nextStartKm);

    if (intervalEnd <= intervalStart) continue;

    kmByTrip.set(
      checkpoint.tripId,
      round2((kmByTrip.get(checkpoint.tripId) || 0) + (intervalEnd - intervalStart)),
    );
  }

  if ((kmByTrip.get(params.fueling.tripId) || 0) === 0) {
    kmByTrip.set(
      params.fueling.tripId,
      round2((kmByTrip.get(params.fueling.tripId) || 0) + Math.max(segmentEndKm - currentTripStartKm, 0)),
    );
  }

  const totalKm = Array.from(kmByTrip.values()).reduce((sum, value) => sum + value, 0);
  if (totalKm <= 0) return defaultAllocation;

  const allocations = Array.from(kmByTrip.entries())
    .filter(([, km]) => km > 0)
    .map(([tripId, km]) => ({ tripId, km, value: round2((km / totalKm) * totalInvoiceValue) }));

  const allocatedSum = allocations.reduce((sum, item) => sum + item.value, 0);
  const roundingDelta = round2(totalInvoiceValue - allocatedSum);
  if (roundingDelta !== 0) {
    const currentTripAllocation = allocations.find((item) => item.tripId === params.fueling.tripId);
    if (currentTripAllocation) {
      currentTripAllocation.value = round2(currentTripAllocation.value + roundingDelta);
    } else if (allocations.length > 0) {
      allocations[allocations.length - 1].value = round2(allocations[allocations.length - 1].value + roundingDelta);
    }
  }

  const currentTripAllocation = allocations.find((item) => item.tripId === params.fueling.tripId);
  const rateioExpenses = allocations
    .filter((item) => item.tripId !== params.fueling.tripId && item.value > 0)
    .map((item) => ({
      tripId: item.tripId,
      value: item.value,
      date: params.fueling.date,
      description: `Parte do combustível deste abastecimento foi usada na viagem anterior.`,
      sourceFuelingId: params.fueling.id,
    }));

  const hasCrossTripRateio = rateioExpenses.length > 0;

  if (!hasCrossTripRateio) {
    return defaultAllocation;
  }

  return {
    effectiveTripValue: round2(currentTripAllocation?.value ?? totalInvoiceValue),
    allocatedValue: round2(currentTripAllocation?.value ?? totalInvoiceValue),
    originalTotalValue: totalInvoiceValue,
    rateioExpenses,
  };
}

export function buildFuelingFinancialPlan(params: {
  fuelings: FuelingPersistenceRecord[];
  tripStartKmMap: Map<string, number>;
}): FuelingComputedState[] {
  const orderedFuelings = sortFuelingsByTimeline(params.fuelings).map((fueling) => ({
    ...fueling,
    totalValue: getFuelingOriginalTotalValue(fueling),
  }));

  let previousFullTank: FuelingPersistenceRecord | null = null;

  return orderedFuelings.map((fueling) => {
    const totalInvoiceValue = getFuelingOriginalTotalValue(fueling);
    const pricePerLiter = calculateFuelingPricePerLiter(totalInvoiceValue, fueling.liters);
    const average =
      fueling.fullTank &&
      previousFullTank &&
      fueling.liters > 0 &&
      fueling.kmCurrent > previousFullTank.kmCurrent
        ? round2((fueling.kmCurrent - previousFullTank.kmCurrent) / fueling.liters)
        : 0;

    const allocation = previousFullTank
      ? allocateAcrossTrips({
          fueling: {
            ...fueling,
            totalValue: totalInvoiceValue,
          },
          previousFullTank,
          tripStartKmMap: params.tripStartKmMap,
        })
      : {
          effectiveTripValue: totalInvoiceValue,
          allocatedValue: null,
          originalTotalValue: null,
          rateioExpenses: [] as FuelingRateioExpense[],
        };

    const computed: FuelingComputedState = {
      id: fueling.id,
      effectiveTripValue: allocation.effectiveTripValue,
      allocatedValue: allocation.allocatedValue,
      originalTotalValue: allocation.originalTotalValue,
      average,
      pricePerLiter,
      rateioExpenses: allocation.rateioExpenses,
    };

    if (fueling.fullTank) {
      previousFullTank = {
        ...fueling,
        totalValue: totalInvoiceValue,
      };
    }

    return computed;
  });
}

export function getWeightedTripAverageConsumption(
  fuelings: Array<Pick<FuelingPersistenceRecord, "liters" | "fullTank"> & { average: number }>,
) {
  const validFuelings = fuelings.filter((fueling) => fueling.fullTank && fueling.average > 0 && fueling.liters > 0);
  if (validFuelings.length === 0) return 0;

  const totalLiters = validFuelings.reduce((sum, fueling) => sum + fueling.liters, 0);
  if (totalLiters <= 0) return 0;

  const totalKm = validFuelings.reduce((sum, fueling) => sum + (fueling.average * fueling.liters), 0);
  return round2(totalKm / totalLiters);
}

import { Freight, FreightStatus, Trip } from "@/types";

const FREIGHT_STATUS_SORT_ORDER: Record<FreightStatus, number> = {
  in_progress: 0,
  planned: 1,
  completed: 2,
};

export function normalizeTripFreights(freights: Freight[]): Freight[] {
  if (freights.length <= 1) return freights;

  const inProgressFreights = freights.filter((freight) => freight.status === "in_progress");
  if (inProgressFreights.length <= 1) return freights;

  const activeFreightId = [...inProgressFreights]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0].id;

  return freights.map((freight) => {
    if (freight.id === activeFreightId) return freight;
    if (freight.status === "in_progress") return { ...freight, status: "planned" };
    return freight;
  });
}

export function getCurrentFreight(trip: Trip): Freight | null {
  return trip.freights.find((freight) => freight.status === "in_progress") ?? null;
}

export function getFreightStatusForInsert(existingFreights: Freight[]): FreightStatus {
  const hasInProgressFreight = existingFreights.some(
    (freight) => freight.status === "in_progress",
  );
  if (hasInProgressFreight) return "planned";

  const hasPlannedFreight = existingFreights.some(
    (freight) => freight.status === "planned",
  );
  if (hasPlannedFreight) return "planned";

  return "in_progress";
}

export function sortFreightsByOperationalPriority(freights: Freight[]): Freight[] {
  return [...freights].sort((a, b) => {
    const statusDiff =
      FREIGHT_STATUS_SORT_ORDER[a.status] - FREIGHT_STATUS_SORT_ORDER[b.status];

    if (statusDiff !== 0) return statusDiff;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

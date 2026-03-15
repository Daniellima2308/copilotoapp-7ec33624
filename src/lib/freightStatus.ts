import { Freight, FreightStatus, Trip } from "@/types";

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
  return existingFreights.length === 0 ? "in_progress" : "planned";
}

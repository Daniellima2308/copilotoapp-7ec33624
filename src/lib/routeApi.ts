import { invokeEdgeFunction } from "./supabaseClient";

interface Coordinates {
  lat: number;
  lon: number;
}

export interface RouteResult {
  distanceKm: number;
  originCoords: Coordinates;
  destCoords: Coordinates;
}

export interface RouteDistanceDiagnostic {
  distanceKm: number | null;
  reason: string | null;
  originQueryUsed?: string;
  destinationQueryUsed?: string;
}

interface RouteFunctionResponse {
  distanceKm: number | null;
  originCoords: Coordinates | null;
  destCoords: Coordinates | null;
  reason: string | null;
  originQueryUsed?: string;
  destinationQueryUsed?: string;
}

interface RouteResolution {
  result: RouteResult | null;
  reason: string | null;
  originQueryUsed?: string;
  destinationQueryUsed?: string;
}

async function resolveRoute(origin: string, destination: string): Promise<RouteResolution> {
  try {
    const response = await invokeEdgeFunction<RouteFunctionResponse>("calculate-route", {
      origin,
      destination,
    });

    if (
      typeof response?.distanceKm === "number" &&
      response.originCoords &&
      response.destCoords
    ) {
      return {
        result: {
          distanceKm: response.distanceKm,
          originCoords: response.originCoords,
          destCoords: response.destCoords,
        },
        reason: null,
        originQueryUsed: response.originQueryUsed,
        destinationQueryUsed: response.destinationQueryUsed,
      };
    }

    return {
      result: null,
      reason: response?.reason || "Não foi possível calcular a rota.",
      originQueryUsed: response?.originQueryUsed,
      destinationQueryUsed: response?.destinationQueryUsed,
    };
  } catch (error) {
    return {
      result: null,
      reason: `Erro ao chamar função de rota: ${error instanceof Error ? error.message : "erro desconhecido"}.`,
    };
  }
}

export async function getRouteDistance(origin: string, destination: string): Promise<number | null> {
  const resolved = await resolveRoute(origin, destination);
  return resolved.result ? resolved.result.distanceKm : null;
}

export async function getRouteDistanceDiagnostic(origin: string, destination: string): Promise<RouteDistanceDiagnostic> {
  const resolved = await resolveRoute(origin, destination);
  return {
    distanceKm: resolved.result?.distanceKm ?? null,
    reason: resolved.reason,
    originQueryUsed: resolved.originQueryUsed,
    destinationQueryUsed: resolved.destinationQueryUsed,
  };
}

export async function getRouteInfo(origin: string, destination: string): Promise<RouteResult | null> {
  const resolved = await resolveRoute(origin, destination);
  return resolved.result;
}

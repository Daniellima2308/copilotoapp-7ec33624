import { supabase } from "@/integrations/supabase/client";
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
  source?: "cache" | "provider";
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

const ROUTE_PROVIDER = "tomtom";

export function normalizeRouteLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*[–—-]\s*/g, ", ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,+/g, ",")
    .replace(/,\s*/g, ", ")
    .trim();
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
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

    console.error("[routeApi] Falha ao chamar calculate-route", {
      origin,
      destination,
      error,
    });

    return {
      result: null,
      reason: `Erro ao chamar função de rota: ${errorMessage || "erro desconhecido"}.`,
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
    source: "provider",
  };
}

export async function getRouteDistanceDiagnosticWithCache(
  params: { origin: string; destination: string; userId: string },
): Promise<RouteDistanceDiagnostic> {
  const originNormalized = normalizeRouteLabel(params.origin);
  const destinationNormalized = normalizeRouteLabel(params.destination);

  const { data: cachedRoute, error: cacheLookupError } = await supabase
    .from("route_cache")
    .select("id, distance_km, hit_count")
    .eq("user_id", params.userId)
    .eq("origin_normalized", originNormalized)
    .eq("destination_normalized", destinationNormalized)
    .maybeSingle();

  if (cacheLookupError) {
    console.error("[routeApi] Falha no lookup do route_cache", {
      origin: params.origin,
      destination: params.destination,
      originNormalized,
      destinationNormalized,
      error: cacheLookupError,
    });
  }

  if (cachedRoute && typeof cachedRoute.distance_km === "number" && cachedRoute.distance_km > 0) {
    const nowIso = new Date().toISOString();
    const { error: cacheHitError } = await supabase
      .from("route_cache")
      .update({
        hit_count: (cachedRoute.hit_count || 0) + 1,
        last_used_at: nowIso,
      })
      .eq("id", cachedRoute.id);

    if (cacheHitError) {
      console.error("[routeApi] Falha ao atualizar hit_count do route_cache", {
        routeCacheId: cachedRoute.id,
        error: cacheHitError,
      });
    }

    return {
      distanceKm: cachedRoute.distance_km,
      reason: null,
      source: "cache",
    };
  }

  const resolved = await resolveRoute(params.origin, params.destination);

  if (resolved.result) {
    const nowIso = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("route_cache")
      .upsert(
        {
          user_id: params.userId,
          origin_label: params.origin,
          destination_label: params.destination,
          origin_normalized: originNormalized,
          destination_normalized: destinationNormalized,
          distance_km: resolved.result.distanceKm,
          origin_lat: resolved.result.originCoords.lat,
          origin_lon: resolved.result.originCoords.lon,
          destination_lat: resolved.result.destCoords.lat,
          destination_lon: resolved.result.destCoords.lon,
          provider: ROUTE_PROVIDER,
          hit_count: 0,
          last_verified_at: nowIso,
          last_used_at: nowIso,
        },
        { onConflict: "user_id,origin_normalized,destination_normalized" },
      );

    if (upsertError) {
      console.error("[routeApi] Falha ao persistir route_cache", {
        origin: params.origin,
        destination: params.destination,
        error: upsertError,
      });
    }
  }

  return {
    distanceKm: resolved.result?.distanceKm ?? null,
    reason: resolved.reason,
    originQueryUsed: resolved.originQueryUsed,
    destinationQueryUsed: resolved.destinationQueryUsed,
    source: "provider",
  };
}

export async function getRouteInfo(origin: string, destination: string): Promise<RouteResult | null> {
  const resolved = await resolveRoute(origin, destination);
  return resolved.result;
}

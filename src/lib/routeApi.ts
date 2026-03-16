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
const CACHE_HIT_WRITE_MIN_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6h

function shouldUpdateCacheHitTelemetry(lastUsedAt: string | null): boolean {
  if (!lastUsedAt) return true;
  const lastUsedMs = Date.parse(lastUsedAt);
  if (Number.isNaN(lastUsedMs)) return true;
  return Date.now() - lastUsedMs >= CACHE_HIT_WRITE_MIN_INTERVAL_MS;
}

function stripCountrySuffix(value: string): string {
  return value
    .replace(/\b(brazil|brasil)\b/gi, "")
    .replace(/,{2,}/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeRouteLabel(value: string): string {
  return stripCountrySuffix(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[/|]/g, ",")
    .replace(/[–—-]+/g, ",")
    .replace(/[.;]+/g, ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,+/g, ",")
    .replace(/,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^,\s*|,\s*$/g, "")
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

async function saveRouteInCache(params: {
  userId: string;
  origin: string;
  destination: string;
  originNormalized: string;
  destinationNormalized: string;
  resolved: RouteResult;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from("route_cache")
    .upsert(
      {
        user_id: params.userId,
        origin_label: params.origin,
        destination_label: params.destination,
        origin_normalized: params.originNormalized,
        destination_normalized: params.destinationNormalized,
        distance_km: params.resolved.distanceKm,
        origin_lat: params.resolved.originCoords.lat,
        origin_lon: params.resolved.originCoords.lon,
        destination_lat: params.resolved.destCoords.lat,
        destination_lon: params.resolved.destCoords.lon,
        provider: ROUTE_PROVIDER,
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

export async function refreshRouteCacheEntry(params: { origin: string; destination: string; userId: string }): Promise<RouteDistanceDiagnostic> {
  const originNormalized = normalizeRouteLabel(params.origin);
  const destinationNormalized = normalizeRouteLabel(params.destination);
  const resolved = await resolveRoute(params.origin, params.destination);

  if (resolved.result) {
    await saveRouteInCache({
      userId: params.userId,
      origin: params.origin,
      destination: params.destination,
      originNormalized,
      destinationNormalized,
      resolved: resolved.result,
    });
  }

  return {
    distanceKm: resolved.result?.distanceKm ?? null,
    reason: resolved.reason,
    originQueryUsed: resolved.originQueryUsed,
    destinationQueryUsed: resolved.destinationQueryUsed,
    source: "provider",
  };
}

export async function getRouteDistanceDiagnosticWithCache(
  params: { origin: string; destination: string; userId: string; forceProvider?: boolean },
): Promise<RouteDistanceDiagnostic> {
  const originNormalized = normalizeRouteLabel(params.origin);
  const destinationNormalized = normalizeRouteLabel(params.destination);

  if (!params.forceProvider) {
    const { data: cachedRoute, error: cacheLookupError } = await supabase
      .from("route_cache")
      .select("id, distance_km, hit_count, last_used_at")
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
      if (shouldUpdateCacheHitTelemetry(cachedRoute.last_used_at)) {
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
      }

      return {
        distanceKm: cachedRoute.distance_km,
        reason: null,
        source: "cache",
      };
    }
  }

  const resolved = await resolveRoute(params.origin, params.destination);

  if (resolved.result) {
    await saveRouteInCache({
      userId: params.userId,
      origin: params.origin,
      destination: params.destination,
      originNormalized,
      destinationNormalized,
      resolved: resolved.result,
    });
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

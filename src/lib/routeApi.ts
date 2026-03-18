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
  reasonCode?: string | null;
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
const CACHE_HIT_WRITE_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
const COUNTRY_TOKENS = new Set(["brazil", "brasil", "br"]);

function mapRouteInvokeErrorToUserReason(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes("tomtom_api_key") || normalized.includes("api key")) {
    return "Serviço de rota indisponível no momento. Você pode seguir lançando a viagem normalmente e tentar novamente mais tarde.";
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("fetch")
  ) {
    return "Não deu para liberar a previsão da rota agora. Confira sua conexão e tente novamente em instantes.";
  }

  return "Não deu para liberar a previsão da rota agora. Você pode seguir lançando a viagem normalmente e tentar novamente depois.";
}

function logRouteDebug(event: string, details: Record<string, unknown>) {
  console.info(`[routeApi] ${event}`, details);
}

export function normalizeRouteLabel(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[/|]+/g, ",")
    .replace(/\s*[–—-]\s*/g, ",")
    .replace(/\s*;\s*/g, ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,+/g, ",")
    .replace(/,\s*/g, ", ")
    .trim();

  const tokens = normalized
    .split(",")
    .map((token) => token.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  while (tokens.length > 2 && COUNTRY_TOKENS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(", ");
}

function shouldUpdateCacheHitMetadata(lastUsedAt: string | null): boolean {
  if (!lastUsedAt) return true;

  const lastUsedMs = Date.parse(lastUsedAt);
  if (Number.isNaN(lastUsedMs)) return true;

  return Date.now() - lastUsedMs >= CACHE_HIT_WRITE_MIN_INTERVAL_MS;
}

async function resolveRoute(
  origin: string,
  destination: string,
): Promise<RouteResolution> {
  try {
    logRouteDebug("provider_request", {
      origin,
      destination,
      provider: ROUTE_PROVIDER,
    });

    const response = await invokeEdgeFunction<RouteFunctionResponse>(
      "calculate-route",
      {
        origin,
        destination,
      },
    );

    if (
      typeof response?.distanceKm === "number" &&
      response.originCoords &&
      response.destCoords
    ) {
      logRouteDebug("provider_success", {
        origin,
        destination,
        provider: ROUTE_PROVIDER,
        distanceKm: response.distanceKm,
      });

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

    logRouteDebug("provider_empty", {
      origin,
      destination,
      provider: ROUTE_PROVIDER,
      reason: response?.reason || "Não foi possível calcular a rota.",
    });

    return {
      result: null,
      reason: response?.reason || "Não foi possível calcular a rota.",
      originQueryUsed: response?.originQueryUsed,
      destinationQueryUsed: response?.destinationQueryUsed,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
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
      reason: mapRouteInvokeErrorToUserReason(
        errorMessage || "erro desconhecido",
      ),
    };
  }
}

export async function getRouteDistance(
  origin: string,
  destination: string,
): Promise<number | null> {
  const resolved = await resolveRoute(origin, destination);
  return resolved.result ? resolved.result.distanceKm : null;
}

export async function getRouteDistanceDiagnostic(
  origin: string,
  destination: string,
): Promise<RouteDistanceDiagnostic> {
  const resolved = await resolveRoute(origin, destination);
  return {
    distanceKm: resolved.result?.distanceKm ?? null,
    reason: resolved.reason,
    originQueryUsed: resolved.originQueryUsed,
    destinationQueryUsed: resolved.destinationQueryUsed,
    source: "provider",
  };
}

// O cache de rota é permanente por enquanto para privilegiar economia de chamadas e consistência offline.
// `forceRefresh` existe para revalidar manualmente uma rota específica sem reabrir a estratégia global.
// A telemetria de hit é limitada por intervalo para evitar writes excessivos a cada consulta repetida.
export async function getRouteDistanceDiagnosticWithCache(params: {
  origin: string;
  destination: string;
  userId: string;
  forceRefresh?: boolean;
}): Promise<RouteDistanceDiagnostic> {
  const originNormalized = normalizeRouteLabel(params.origin);
  const destinationNormalized = normalizeRouteLabel(params.destination);

  let cachedRoute: {
    id: string;
    distance_km: number | null;
    hit_count: number | null;
    last_used_at: string | null;
  } | null = null;

  if (!params.forceRefresh) {
    const { data, error: cacheLookupError } = await supabase
      .from("route_cache")
      .select("id, distance_km, hit_count, last_used_at")
      .eq("user_id", params.userId)
      .eq("origin_normalized", originNormalized)
      .eq("destination_normalized", destinationNormalized)
      .maybeSingle();

    cachedRoute = data;

    if (cacheLookupError) {
      console.error("[routeApi] Falha no lookup do route_cache", {
        origin: params.origin,
        destination: params.destination,
        originNormalized,
        destinationNormalized,
        error: cacheLookupError,
      });
    }
  }

  if (
    cachedRoute &&
    typeof cachedRoute.distance_km === "number" &&
    cachedRoute.distance_km > 0
  ) {
    logRouteDebug("cache_hit", {
      origin: params.origin,
      destination: params.destination,
      originNormalized,
      destinationNormalized,
      distanceKm: cachedRoute.distance_km,
    });

    if (shouldUpdateCacheHitMetadata(cachedRoute.last_used_at)) {
      const nowIso = new Date().toISOString();
      const { error: cacheHitError } = await supabase
        .from("route_cache")
        .update({
          hit_count: (cachedRoute.hit_count || 0) + 1,
          last_used_at: nowIso,
        })
        .eq("id", cachedRoute.id);

      if (cacheHitError) {
        console.error(
          "[routeApi] Falha ao atualizar hit_count do route_cache",
          {
            routeCacheId: cachedRoute.id,
            error: cacheHitError,
          },
        );
      }
    }

    return {
      distanceKm: cachedRoute.distance_km,
      reason: null,
      source: "cache",
    };
  }

  logRouteDebug("cache_miss", {
    origin: params.origin,
    destination: params.destination,
    originNormalized,
    destinationNormalized,
    forceRefresh: Boolean(params.forceRefresh),
  });

  const resolved = await resolveRoute(params.origin, params.destination);

  if (resolved.result) {
    const nowIso = new Date().toISOString();
    const { error: upsertError } = await supabase.from("route_cache").upsert(
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
        last_verified_at: nowIso,
        last_used_at: nowIso,
      },
      { onConflict: "user_id,origin_normalized,destination_normalized" },
    );

    if (upsertError) {
      console.error("[routeApi] Falha ao persistir route_cache", {
        origin: params.origin,
        destination: params.destination,
        forceRefresh: Boolean(params.forceRefresh),
        error: upsertError,
      });
    } else {
      logRouteDebug("cache_persisted", {
        origin: params.origin,
        destination: params.destination,
        originNormalized,
        destinationNormalized,
        distanceKm: resolved.result.distanceKm,
        provider: ROUTE_PROVIDER,
        forceRefresh: Boolean(params.forceRefresh),
      });
    }
  } else if (resolved.reason) {
    logRouteDebug("provider_failed_without_cache", {
      origin: params.origin,
      destination: params.destination,
      originNormalized,
      destinationNormalized,
      reason: resolved.reason,
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

export async function refreshRouteDistanceCache(params: {
  origin: string;
  destination: string;
  userId: string;
}): Promise<RouteDistanceDiagnostic> {
  return getRouteDistanceDiagnosticWithCache({
    ...params,
    forceRefresh: true,
  });
}

export async function getRouteInfo(
  origin: string,
  destination: string,
): Promise<RouteResult | null> {
  const resolved = await resolveRoute(origin, destination);
  return resolved.result;
}

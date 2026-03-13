const TOMTOM_SEARCH_URL = "https://api.tomtom.com/search/2/geocode";
const TOMTOM_ROUTING_URL = "https://api.tomtom.com/routing/1/calculateRoute";

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

interface GeocodeDiagnostic {
  coords: Coordinates | null;
  reason: string | null;
  queryUsed?: string;
}

interface RouteResolution {
  result: RouteResult | null;
  reason: string | null;
  originQueryUsed?: string;
  destinationQueryUsed?: string;
}

function normalizeLocation(value: string): string {
  const normalized = value
    .trim()
    .replace(/\s+-\s+/g, ", ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,+$/g, "");

  if (!normalized) return "";
  if (/\b(brasil|brazil)\b/i.test(normalized)) return normalized;

  return `${normalized}, Brazil`;
}

function buildLocationCandidates(raw: string): string[] {
  const normalized = normalizeLocation(raw);
  const [city = "", uf = ""] = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  const candidates = [
    normalized,
    city && uf ? `${city}, ${uf}` : "",
    city,
    raw.trim(),
  ].filter(Boolean);

  return [...new Set(candidates)];
}

async function geocodeCityDetailed(cityName: string): Promise<GeocodeDiagnostic> {
  const apiKey = import.meta.env.VITE_TOMTOM_API_KEY?.trim();
  if (!apiKey) {
    return {
      coords: null,
      reason: "Chave da API TomTom ausente. Configure VITE_TOMTOM_API_KEY.",
    };
  }

  const candidates = buildLocationCandidates(cityName);
  let lastReason = "Localização não encontrada na geocodificação.";

  for (const candidate of candidates) {
    const query = normalizeLocation(candidate);

    try {
      const res = await fetch(
        `${TOMTOM_SEARCH_URL}/${encodeURIComponent(query)}.json?key=${encodeURIComponent(apiKey)}&limit=1&countrySet=BR&language=pt-BR`,
      );

      if (!res.ok) {
        lastReason = `Geocodificação falhou para "${query}" (HTTP ${res.status}).`;
        continue;
      }

      const data = await res.json();
      const position = data?.results?.[0]?.position;

      if (position && typeof position.lat === "number" && typeof position.lon === "number") {
        return {
          coords: { lat: position.lat, lon: position.lon },
          reason: null,
          queryUsed: query,
        };
      }

      lastReason = `Sem resultado para "${query}".`;
    } catch (error) {
      lastReason = `Erro de rede na geocodificação de "${query}": ${error instanceof Error ? error.message : "erro desconhecido"}.`;
    }
  }

  return { coords: null, reason: lastReason };
}

async function resolveRoute(origin: string, destination: string): Promise<RouteResolution> {
  const apiKey = import.meta.env.VITE_TOMTOM_API_KEY?.trim();
  if (!apiKey) {
    return {
      result: null,
      reason: "Chave da API TomTom ausente. Configure VITE_TOMTOM_API_KEY.",
    };
  }

  const [originGeo, destinationGeo] = await Promise.all([
    geocodeCityDetailed(origin),
    geocodeCityDetailed(destination),
  ]);

  if (!originGeo.coords || !destinationGeo.coords) {
    return {
      result: null,
      reason: originGeo.reason || destinationGeo.reason || "Não foi possível geocodificar origem/destino.",
      originQueryUsed: originGeo.queryUsed,
      destinationQueryUsed: destinationGeo.queryUsed,
    };
  }

  try {
    const res = await fetch(
      `${TOMTOM_ROUTING_URL}/${originGeo.coords.lat},${originGeo.coords.lon}:${destinationGeo.coords.lat},${destinationGeo.coords.lon}/json?key=${encodeURIComponent(apiKey)}&routeType=fastest&traffic=false`,
    );

    if (!res.ok) {
      return {
        result: null,
        reason: `Roteamento falhou (HTTP ${res.status}).`,
        originQueryUsed: originGeo.queryUsed,
        destinationQueryUsed: destinationGeo.queryUsed,
      };
    }

    const data = await res.json();
    const routeLengthMeters = data?.routes?.[0]?.summary?.lengthInMeters;

    if (typeof routeLengthMeters !== "number") {
      return {
        result: null,
        reason: `Roteamento sem rota válida (${data?.error?.description || "sem rota"}).`,
        originQueryUsed: originGeo.queryUsed,
        destinationQueryUsed: destinationGeo.queryUsed,
      };
    }

    return {
      result: {
        distanceKm: Math.round(routeLengthMeters / 1000),
        originCoords: originGeo.coords,
        destCoords: destinationGeo.coords,
      },
      reason: null,
      originQueryUsed: originGeo.queryUsed,
      destinationQueryUsed: destinationGeo.queryUsed,
    };
  } catch (error) {
    return {
      result: null,
      reason: `Erro de rede no roteamento: ${error instanceof Error ? error.message : "erro desconhecido"}.`,
      originQueryUsed: originGeo.queryUsed,
      destinationQueryUsed: destinationGeo.queryUsed,
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

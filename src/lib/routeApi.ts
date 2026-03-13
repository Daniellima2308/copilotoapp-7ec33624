const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

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
  return value
    .trim()
    .replace(/\s+-\s+/g, ", ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,+$/g, "");
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
  const candidates = buildLocationCandidates(cityName);
  let lastReason = "Localização não encontrada na geocodificação.";

  for (const candidate of candidates) {
    for (const countrySuffix of [", Brasil", ", Brazil"]) {
      const query = `${candidate}${countrySuffix}`;

      try {
        const res = await fetch(
          `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`,
          { headers: { "Accept-Language": "pt-BR" } },
        );

        if (!res.ok) {
          lastReason = `Geocodificação falhou para "${query}" (HTTP ${res.status}).`;
          continue;
        }

        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return {
            coords: { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) },
            reason: null,
            queryUsed: query,
          };
        }

        lastReason = `Sem resultado para "${query}".`;
      } catch (error) {
        lastReason = `Erro de rede na geocodificação de "${query}": ${error instanceof Error ? error.message : "erro desconhecido"}.`;
      }
    }
  }

  return { coords: null, reason: lastReason };
}

async function resolveRoute(origin: string, destination: string): Promise<RouteResolution> {
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
      `${OSRM_URL}/${originGeo.coords.lon},${originGeo.coords.lat};${destinationGeo.coords.lon},${destinationGeo.coords.lat}?overview=false`,
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
    if (data.code !== "Ok" || !data.routes?.length) {
      return {
        result: null,
        reason: `Roteamento sem rota válida (${data.code || "sem código"}).`,
        originQueryUsed: originGeo.queryUsed,
        destinationQueryUsed: destinationGeo.queryUsed,
      };
    }

    return {
      result: {
        distanceKm: Math.round(data.routes[0].distance / 1000),
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TOMTOM_SEARCH_URL = "https://api.tomtom.com/search/2/geocode";
const TOMTOM_ROUTING_URL = "https://api.tomtom.com/routing/1/calculateRoute";

interface Coordinates {
  lat: number;
  lon: number;
}

interface GeocodeDiagnostic {
  coords: Coordinates | null;
  reason: string | null;
  queryUsed?: string;
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

async function geocodeLocation(cityName: string, apiKey: string): Promise<GeocodeDiagnostic> {
  const candidates = buildLocationCandidates(cityName);
  let lastReason = "Localização não encontrada na geocodificação.";

  for (const candidate of candidates) {
    const query = normalizeLocation(candidate);

    try {
      const response = await fetch(
        `${TOMTOM_SEARCH_URL}/${encodeURIComponent(query)}.json?key=${encodeURIComponent(apiKey)}&limit=1&countrySet=BR&language=pt-BR`,
      );

      if (!response.ok) {
        lastReason = `Geocodificação falhou para "${query}" (HTTP ${response.status}).`;
        continue;
      }

      const data = await response.json();
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({
      distanceKm: null,
      originCoords: null,
      destCoords: null,
      reason: `Método não permitido: ${req.method}. Use POST.`,
    }, 405);
  }

  try {
    const TOMTOM_API_KEY = Deno.env.get("TOMTOM_API_KEY");
    if (!TOMTOM_API_KEY) {
      return jsonResponse({
          distanceKm: null,
          originCoords: null,
          destCoords: null,
          reason: "TOMTOM_API_KEY is not configured",
        }, 500);
    }

    const { origin, destination } = await req.json();

    if (!origin || !destination || typeof origin !== "string" || typeof destination !== "string") {
      return jsonResponse({
          distanceKm: null,
          originCoords: null,
          destCoords: null,
          reason: "Missing origin or destination",
        }, 400);
    }

    const [originGeo, destinationGeo] = await Promise.all([
      geocodeLocation(origin, TOMTOM_API_KEY),
      geocodeLocation(destination, TOMTOM_API_KEY),
    ]);

    if (!originGeo.coords || !destinationGeo.coords) {
      return jsonResponse({
          distanceKm: null,
          originCoords: originGeo.coords,
          destCoords: destinationGeo.coords,
          reason: originGeo.reason || destinationGeo.reason || "Não foi possível geocodificar origem/destino.",
          originQueryUsed: originGeo.queryUsed,
          destinationQueryUsed: destinationGeo.queryUsed,
        }, 200);
    }

    const routeResponse = await fetch(
      `${TOMTOM_ROUTING_URL}/${originGeo.coords.lat},${originGeo.coords.lon}:${destinationGeo.coords.lat},${destinationGeo.coords.lon}/json?key=${encodeURIComponent(TOMTOM_API_KEY)}&routeType=fastest&traffic=false`,
    );

    if (!routeResponse.ok) {
      return jsonResponse({
          distanceKm: null,
          originCoords: originGeo.coords,
          destCoords: destinationGeo.coords,
          reason: `Roteamento falhou (HTTP ${routeResponse.status}).`,
          originQueryUsed: originGeo.queryUsed,
          destinationQueryUsed: destinationGeo.queryUsed,
        }, 200);
    }

    const routeData = await routeResponse.json();
    const routeLengthMeters = routeData?.routes?.[0]?.summary?.lengthInMeters;

    if (typeof routeLengthMeters !== "number") {
      return jsonResponse({
          distanceKm: null,
          originCoords: originGeo.coords,
          destCoords: destinationGeo.coords,
          reason: `Roteamento sem rota válida (${routeData?.error?.description || "sem rota"}).`,
          originQueryUsed: originGeo.queryUsed,
          destinationQueryUsed: destinationGeo.queryUsed,
        }, 200);
    }

    return jsonResponse({
        distanceKm: Math.round(routeLengthMeters / 1000),
        originCoords: originGeo.coords,
        destCoords: destinationGeo.coords,
        reason: null,
        originQueryUsed: originGeo.queryUsed,
        destinationQueryUsed: destinationGeo.queryUsed,
      }, 200);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({
        distanceKm: null,
        originCoords: null,
        destCoords: null,
        reason: `Erro inesperado na função de rota: ${errorMessage}`,
      }, 500);
  }
});

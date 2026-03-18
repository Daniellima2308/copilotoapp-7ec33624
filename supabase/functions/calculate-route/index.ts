import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
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
  reasonCode?: string;
  queryUsed?: string;
}

interface RouteFunctionPayload {
  distanceKm: number | null;
  originCoords: Coordinates | null;
  destCoords: Coordinates | null;
  reason: string | null;
  reasonCode?: string | null;
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
  const [city = "", uf = ""] = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const candidates = [
    normalized,
    city && uf ? `${city}, ${uf}` : "",
    city,
    raw.trim(),
  ].filter(Boolean);

  return [...new Set(candidates)];
}

async function geocodeLocation(
  cityName: string,
  apiKey: string,
): Promise<GeocodeDiagnostic> {
  const candidates = buildLocationCandidates(cityName);
  let lastReason = "Localização não encontrada na geocodificação.";

  for (const candidate of candidates) {
    const query = normalizeLocation(candidate);

    try {
      const response = await fetch(
        `${TOMTOM_SEARCH_URL}/${encodeURIComponent(query)}.json?key=${encodeURIComponent(apiKey)}&limit=1&countrySet=BR&language=pt-BR`,
      );

      if (!response.ok) {
        console.error("[calculate-route] geocode_http_error", {
          query,
          status: response.status,
        });
        lastReason = "Origem ou destino não foram reconhecidos com clareza.";
        continue;
      }

      const data = await response.json();
      const position = data?.results?.[0]?.position;

      if (
        position &&
        typeof position.lat === "number" &&
        typeof position.lon === "number"
      ) {
        return {
          coords: { lat: position.lat, lon: position.lon },
          reason: null,
          queryUsed: query,
        };
      }

      lastReason = "Origem ou destino não foram reconhecidos com clareza.";
    } catch (error) {
      console.error("[calculate-route] geocode_fetch_error", { query, error });
      lastReason = "Não deu para consultar a rota agora.";
    }
  }

  return { coords: null, reason: lastReason };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        distanceKm: null,
        originCoords: null,
        destCoords: null,
        reason: "Método não permitido para cálculo de rota.",
        reasonCode: "method_not_allowed",
      },
      405,
    );
  }

  const TOMTOM_API_KEY = Deno.env.get("TOMTOM_API_KEY");
  if (!TOMTOM_API_KEY) {
    console.error("[calculate-route] missing_tomtom_api_key");
    return jsonResponse(
      {
        distanceKm: null,
        originCoords: null,
        destCoords: null,
        reason: "Serviço de rota indisponível no momento.",
        reasonCode: "missing_api_key",
      } satisfies RouteFunctionPayload,
      200,
    );
  }

  let payload: { origin?: unknown; destination?: unknown } = {};

  try {
    payload = await req.json();
  } catch (error) {
    console.error("[calculate-route] invalid_json_body", { error });
    return jsonResponse(
      {
        distanceKm: null,
        originCoords: null,
        destCoords: null,
        reason: "Origem e destino não foram enviados corretamente.",
        reasonCode: "invalid_json_body",
      } satisfies RouteFunctionPayload,
      200,
    );
  }

  const origin =
    typeof payload.origin === "string" ? payload.origin.trim() : "";
  const destination =
    typeof payload.destination === "string" ? payload.destination.trim() : "";

  if (!origin || !destination) {
    console.error("[calculate-route] invalid_route_payload", { payload });
    return jsonResponse(
      {
        distanceKm: null,
        originCoords: null,
        destCoords: null,
        reason:
          "Origem e destino precisam ser informados para calcular a rota.",
        reasonCode: "invalid_payload",
      } satisfies RouteFunctionPayload,
      200,
    );
  }

  try {
    const originGeo = await geocodeLocation(origin, TOMTOM_API_KEY);
    await new Promise((r) => setTimeout(r, 250));
    const destinationGeo = await geocodeLocation(destination, TOMTOM_API_KEY);

    if (!originGeo.coords || !destinationGeo.coords) {
      return jsonResponse(
        {
          distanceKm: null,
          originCoords: originGeo.coords,
          destCoords: destinationGeo.coords,
          reason:
            originGeo.reason ||
            destinationGeo.reason ||
            "Origem ou destino não foram reconhecidos com clareza.",
          reasonCode:
            originGeo.reasonCode ||
            destinationGeo.reasonCode ||
            "geocode_not_found",
          originQueryUsed: originGeo.queryUsed,
          destinationQueryUsed: destinationGeo.queryUsed,
        } satisfies RouteFunctionPayload,
        200,
      );
    }

    const routeResponse = await fetch(
      `${TOMTOM_ROUTING_URL}/${originGeo.coords.lat},${originGeo.coords.lon}:${destinationGeo.coords.lat},${destinationGeo.coords.lon}/json?key=${encodeURIComponent(TOMTOM_API_KEY)}&routeType=fastest&traffic=false`,
    );

    if (!routeResponse.ok) {
      console.error("[calculate-route] routing_http_error", {
        status: routeResponse.status,
        origin,
        destination,
        originQueryUsed: originGeo.queryUsed,
        destinationQueryUsed: destinationGeo.queryUsed,
      });

      return jsonResponse(
        {
          distanceKm: null,
          originCoords: originGeo.coords,
          destCoords: destinationGeo.coords,
          reason: "Não deu para calcular a rota deste trecho agora.",
          reasonCode: "routing_http_error",
          originQueryUsed: originGeo.queryUsed,
          destinationQueryUsed: destinationGeo.queryUsed,
        } satisfies RouteFunctionPayload,
        200,
      );
    }

    const routeData = await routeResponse.json();
    const routeLengthMeters = routeData?.routes?.[0]?.summary?.lengthInMeters;

    if (typeof routeLengthMeters !== "number") {
      console.error("[calculate-route] routing_without_valid_route", {
        origin,
        destination,
        routeData,
      });

      return jsonResponse(
        {
          distanceKm: null,
          originCoords: originGeo.coords,
          destCoords: destinationGeo.coords,
          reason: "Ainda não conseguimos estimar a distância deste trecho.",
          reasonCode: "routing_without_valid_route",
          originQueryUsed: originGeo.queryUsed,
          destinationQueryUsed: destinationGeo.queryUsed,
        } satisfies RouteFunctionPayload,
        200,
      );
    }

    return jsonResponse(
      {
        distanceKm: Math.round(routeLengthMeters / 1000),
        originCoords: originGeo.coords,
        destCoords: destinationGeo.coords,
        reason: null,
        reasonCode: null,
        originQueryUsed: originGeo.queryUsed,
        destinationQueryUsed: destinationGeo.queryUsed,
      } satisfies RouteFunctionPayload,
      200,
    );
  } catch (error: unknown) {
    console.error("[calculate-route] unexpected_error", {
      origin,
      destination,
      error,
    });

    return jsonResponse(
      {
        distanceKm: null,
        originCoords: null,
        destCoords: null,
        reason: "Não deu para calcular a rota agora.",
        reasonCode: "unexpected_error",
      } satisfies RouteFunctionPayload,
      200,
    );
  }
});

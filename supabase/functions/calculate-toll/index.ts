import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOLLGURU_API_URL = "https://apis.tollguru.com/toll/v2/origin-destination-waypoints";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TOLLGURU_API_KEY = Deno.env.get("TOLLGURU_API_KEY");
    if (!TOLLGURU_API_KEY) {
      throw new Error("TOLLGURU_API_KEY is not configured");
    }

    const { originLat, originLng, destLat, destLng, axles } = await req.json();

    if (!originLat || !originLng || !destLat || !destLng) {
      return new Response(
        JSON.stringify({ error: "Missing coordinates" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map axle count to TollGuru vehicle type
    const vehicleType = getVehicleType(axles || 3);

    const payload = {
      from: { lat: originLat, lng: originLng },
      to: { lat: destLat, lng: destLng },
      vehicleType,
      departure_time: new Date().toISOString(),
    };

    const response = await fetch(TOLLGURU_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": TOLLGURU_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`TollGuru API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    // Extract toll cost from cheapest route
    const routes = data?.routes || data?.route || [];
    const routeList = Array.isArray(routes) ? routes : [routes];
    
    let tollCost = 0;
    if (routeList.length > 0) {
      const route = routeList[0];
      // TollGuru returns costs in summary.hasTolls and costs.tag/cash/etc
      const costs = route?.costs || route?.summary?.costs || {};
      // Prefer cash price, then tag, then minimumTollCost
      tollCost = costs.cash ?? costs.tag ?? costs.minimumTollCost ?? route?.summary?.hasTolls?.minimumTollCost ?? 0;
      
      // If toll info is in a different structure
      if (tollCost === 0 && route?.tolls) {
        tollCost = route.tolls.reduce((sum: number, t: { cashCost?: number; tagCost?: number }) => sum + (t.cashCost ?? t.tagCost ?? 0), 0);
      }
    }

    return new Response(
      JSON.stringify({ tollCost: Math.round(tollCost * 100) / 100 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error calculating toll:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getVehicleType(axles: number): string {
  // TollGuru vehicle types for trucks
  switch (axles) {
    case 2: return "2AxlesTruck";
    case 3: return "3AxlesTruck";
    case 4: return "4AxlesTruck";
    case 5: return "5AxlesTruck";
    case 6: return "6AxlesTruck";
    case 7: return "7AxlesTruck";
    case 9: return "9AxlesTruck";
    default: return "3AxlesTruck";
  }
}

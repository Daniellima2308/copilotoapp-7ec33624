import { invokeEdgeFunction } from "./supabaseClient";

interface TollResult {
  tollCost: number;
}

export async function calculateToll(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  axles: number
): Promise<number | null> {
  try {
    const result = await invokeEdgeFunction<TollResult>("calculate-toll", {
      originLat,
      originLng: originLng,
      destLat,
      destLng: destLng,
      axles,
    });
    return result.tollCost ?? null;
  } catch (error) {
    console.error("TollGuru API error:", error);
    return null;
  }
}

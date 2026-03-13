import { afterEach, describe, expect, it, vi } from "vitest";
import { getRouteDistanceDiagnostic } from "@/lib/routeApi";
import { invokeEdgeFunction } from "@/lib/supabaseClient";

vi.mock("@/lib/supabaseClient", () => ({
  invokeEdgeFunction: vi.fn(),
}));

describe("routeApi diagnostics", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retorna rota quando edge function responde com sucesso", async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      distanceKm: 1110,
      originCoords: { lat: -29.918, lon: -51.179 },
      destCoords: { lat: -23.55, lon: -46.633 },
      reason: null,
      originQueryUsed: "Canoas, RS, Brazil",
      destinationQueryUsed: "São Paulo, SP, Brazil",
    });

    const result = await getRouteDistanceDiagnostic("Canoas - RS", "São Paulo - SP");

    expect(result.distanceKm).toBe(1110);
    expect(result.reason).toBeNull();
    expect(result.originQueryUsed).toBe("Canoas, RS, Brazil");
    expect(result.destinationQueryUsed).toBe("São Paulo, SP, Brazil");
    expect(invokeEdgeFunction).toHaveBeenCalledWith("calculate-route", {
      origin: "Canoas - RS",
      destination: "São Paulo - SP",
    });
  });

  it("retorna motivo quando edge function retorna falha de geocodificação", async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      distanceKm: null,
      originCoords: null,
      destCoords: null,
      reason: 'Sem resultado para "Origem inválida, Brazil".',
    });

    const result = await getRouteDistanceDiagnostic("Origem inválida", "Destino inválido");

    expect(result.distanceKm).toBeNull();
    expect(result.reason).toContain("Sem resultado");
  });

  it("retorna motivo quando chamada da edge function falha", async () => {
    vi.mocked(invokeEdgeFunction).mockRejectedValue(new Error("Edge function error [500]: TOMTOM_API_KEY is not configured"));

    const result = await getRouteDistanceDiagnostic("Canoas - RS", "São Paulo - SP");

    expect(result.distanceKm).toBeNull();
    expect(result.reason).toContain("TOMTOM_API_KEY");
  });
});

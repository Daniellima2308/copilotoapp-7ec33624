import { afterEach, describe, expect, it, vi } from "vitest";
import { getRouteDistanceDiagnostic } from "@/lib/routeApi";

describe("routeApi diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("normaliza cidade com hífen e calcula rota", async () => {
    vi.stubEnv("VITE_TOMTOM_API_KEY", "test-key");

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ position: { lat: -29.918, lon: -51.179 } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ position: { lat: -23.55, lon: -46.633 } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ routes: [{ summary: { lengthInMeters: 1110000 } }] }), { status: 200 }));

    const result = await getRouteDistanceDiagnostic("Canoas - RS", "São Paulo - SP");

    expect(result.distanceKm).toBe(1110);
    expect(result.reason).toBeNull();
    expect(result.originQueryUsed).toBe("Canoas, RS, Brazil");
    expect(result.destinationQueryUsed).toBe("São Paulo, SP, Brazil");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retorna motivo quando geocodificação falha", async () => {
    vi.stubEnv("VITE_TOMTOM_API_KEY", "test-key");
    vi.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));

    const result = await getRouteDistanceDiagnostic("Origem inválida", "Destino inválido");

    expect(result.distanceKm).toBeNull();
    expect(result.reason).toContain("Sem resultado");
  });

  it("retorna motivo quando chave da API está ausente", async () => {
    vi.stubEnv("VITE_TOMTOM_API_KEY", "");

    const result = await getRouteDistanceDiagnostic("Canoas - RS", "São Paulo - SP");

    expect(result.distanceKm).toBeNull();
    expect(result.reason).toContain("VITE_TOMTOM_API_KEY");
  });
});

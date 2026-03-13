import { afterEach, describe, expect, it, vi } from "vitest";
import { getRouteDistanceDiagnostic } from "@/lib/routeApi";

describe("routeApi diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normaliza cidade com hífen e calcula rota", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ lat: "-29.918", lon: "-51.179" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ lat: "-23.550", lon: "-46.633" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 1110000 }] }), { status: 200 }));

    const result = await getRouteDistanceDiagnostic("Canoas - RS", "São Paulo - SP");

    expect(result.distanceKm).toBe(1110);
    expect(result.reason).toBeNull();
    expect(result.originQueryUsed).toContain("Canoas, RS");
    expect(result.destinationQueryUsed).toContain("São Paulo, SP");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retorna motivo quando geocodificação falha", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }));

    const result = await getRouteDistanceDiagnostic("Origem inválida", "Destino inválido");

    expect(result.distanceKm).toBeNull();
    expect(result.reason).toContain("Sem resultado");
  });
});

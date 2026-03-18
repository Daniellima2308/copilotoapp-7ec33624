import { afterEach, describe, expect, it, vi } from "vitest";

const {
  maybeSingleMock,
  selectMock,
  eqMock,
  updateEqMock,
  updateMock,
  upsertMock,
  fromMock,
  invokeEdgeFunctionMock,
} = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const eqMock = vi.fn((column: string) => {
    if (column === "destination_normalized") {
      return { maybeSingle: maybeSingleMock };
    }
    return { eq: eqMock };
  });
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const updateEqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn(() => ({ eq: updateEqMock }));
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn(() => ({
    select: selectMock,
    update: updateMock,
    upsert: upsertMock,
  }));
  const invokeEdgeFunctionMock = vi.fn();

  return {
    maybeSingleMock,
    selectMock,
    eqMock,
    updateEqMock,
    updateMock,
    upsertMock,
    fromMock,
    invokeEdgeFunctionMock,
  };
});

vi.mock("@/lib/supabaseClient", () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  getRouteDistanceDiagnostic,
  getRouteDistanceDiagnosticWithCache,
  normalizeRouteLabel,
} from "@/lib/routeApi";
import { invokeEdgeFunction } from "@/lib/supabaseClient";
import { supabase } from "@/integrations/supabase/client";

describe("routeApi diagnostics", () => {
  afterEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockReset();
    updateEqMock.mockResolvedValue({ error: null });
    upsertMock.mockResolvedValue({ error: null });
  });

  it("normaliza rota removendo acentos e padronizando separadores", () => {
    expect(normalizeRouteLabel("  São   Paulo - SP ")).toBe("sao paulo, sp");
    expect(normalizeRouteLabel("Canoas,RS")).toBe("canoas, rs");
    expect(normalizeRouteLabel("São Paulo/SP/Brazil")).toBe("sao paulo, sp");
    expect(normalizeRouteLabel("Campinas - SP - Brasil")).toBe("campinas, sp");
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

    const result = await getRouteDistanceDiagnostic(
      "Canoas - RS",
      "São Paulo - SP",
    );

    expect(result.distanceKm).toBe(1110);
    expect(result.reason).toBeNull();
    expect(result.source).toBe("provider");
  });

  it("usa cache quando rota já existe", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "cache-1", distance_km: 450, hit_count: 3 },
      error: null,
    });

    const result = await getRouteDistanceDiagnosticWithCache({
      origin: "Canoas - RS",
      destination: "São Paulo - SP",
      userId: "user-1",
    });

    expect(result.distanceKm).toBe(450);
    expect(result.source).toBe("cache");
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalled();
  });

  it("retorna motivo quando edge function retorna falha de geocodificação", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      distanceKm: null,
      originCoords: null,
      destCoords: null,
      reason: 'Sem resultado para "Origem inválida, Brazil".',
    });

    const result = await getRouteDistanceDiagnosticWithCache({
      origin: "Origem inválida",
      destination: "Destino inválido",
      userId: "user-1",
    });

    expect(result.distanceKm).toBeNull();
    expect(result.reason).toContain("Sem resultado");
    expect(result.source).toBe("provider");
  });

  it("sanitiza falha técnica da edge function para mensagem humana", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    vi.mocked(invokeEdgeFunction).mockRejectedValue(
      new Error(
        "Falha ao acessar calculate-route: Edge Function returned a non-2xx status code",
      ),
    );

    const result = await getRouteDistanceDiagnosticWithCache({
      origin: "Canoas - RS",
      destination: "São Paulo - SP",
      userId: "user-1",
    });

    expect(result.distanceKm).toBeNull();
    expect(result.reason).toContain(
      "Não deu para liberar a previsão da rota agora",
    );
    expect(result.reason).not.toContain("Edge Function");
    expect(result.reason).not.toContain("non-2xx");
  });

  it("não atualiza telemetria em cache hit recente", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "cache-1",
        distance_km: 450,
        hit_count: 3,
        last_used_at: new Date().toISOString(),
      },
      error: null,
    });

    const result = await getRouteDistanceDiagnosticWithCache({
      origin: "Canoas - RS",
      destination: "São Paulo - SP",
      userId: "user-1",
    });

    expect(result.distanceKm).toBe(450);
    expect(result.source).toBe("cache");
    expect(updateMock).not.toHaveBeenCalled();
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it("força refresh manual ignorando lookup em cache", async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      distanceKm: 1110,
      originCoords: { lat: -29.918, lon: -51.179 },
      destCoords: { lat: -23.55, lon: -46.633 },
      reason: null,
    });

    const result = await getRouteDistanceDiagnosticWithCache({
      origin: "Canoas - RS",
      destination: "São Paulo - SP",
      userId: "user-1",
      forceRefresh: true,
    });

    expect(result.distanceKm).toBe(1110);
    expect(result.source).toBe("provider");
    expect(selectMock).not.toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("faz upsert no cache quando calcula rota no provider", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      distanceKm: 1110,
      originCoords: { lat: -29.918, lon: -51.179 },
      destCoords: { lat: -23.55, lon: -46.633 },
      reason: null,
    });

    await getRouteDistanceDiagnosticWithCache({
      origin: "Canoas - RS",
      destination: "São Paulo - SP",
      userId: "user-1",
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith("route_cache");
  });
});

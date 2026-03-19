import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { useApp } from "@/context/app-context";

const offlineState = vi.hoisted(() => ({
  queue: [] as Array<{
    id: string;
    type: string;
    payload: Record<string, unknown>;
  }>,
  online: true,
}));

const sharedMocks = vi.hoisted(() => ({
  toastMock: vi.fn(),
  getRouteDistanceDiagnosticWithCacheMock: vi.fn(),
  refreshRouteDistanceCacheMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: sharedMocks.toastMock,
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    session: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/routeApi", () => ({
  getRouteDistanceDiagnosticWithCache:
    sharedMocks.getRouteDistanceDiagnosticWithCacheMock,
  refreshRouteDistanceCache: sharedMocks.refreshRouteDistanceCacheMock,
}));

vi.mock("@/lib/maintenance", () => ({
  getMaintenanceAlerts: vi.fn().mockReturnValue([]),
  checkAndNotifyMaintenance: vi.fn(),
}));

vi.mock("@/lib/fieldValidation", () => ({
  getKmBounds: vi.fn().mockReturnValue([]),
  getNumericWarnings: vi.fn().mockReturnValue([]),
  validateKmByContext: vi.fn().mockReturnValue({ isValid: true, warnings: [] }),
  validatePercent: vi.fn().mockReturnValue({ isValid: true }),
  validatePositiveNumber: vi.fn().mockReturnValue({ isValid: true }),
}));

vi.mock("@/lib/vehicleOperation", () => ({
  isDriverBond: vi.fn().mockReturnValue(false),
  isVehicleOperationProfile: vi.fn().mockReturnValue(false),
  normalizeVehicleProfileForPersistence: vi.fn((value) => value),
  normalizeVehicleProfileUpdateForPersistence: vi.fn((value) => value),
}));

vi.mock("@/lib/freightStatus", () => ({
  getFreightStatusForInsert: vi.fn().mockReturnValue("planned"),
  normalizeTripFreights: vi.fn((freights) => freights),
}));

vi.mock("@/lib/offlineQueue", () => ({
  isOnline: () => offlineState.online,
  getOfflineQueue: () => offlineState.queue,
  addToOfflineQueue: (action: {
    type: string;
    payload: Record<string, unknown>;
  }) => {
    offlineState.queue.push({
      ...action,
      id: `queued-${offlineState.queue.length + 1}`,
    });
  },
  removeFromQueue: (id: string) => {
    offlineState.queue = offlineState.queue.filter(
      (action) => action.id !== id,
    );
  },
  getCachedData: vi.fn().mockReturnValue(null),
  setCachedData: vi.fn(),
}));

type Row = Record<string, unknown>;
type TableName = keyof typeof dbState;

const now = "2026-03-18T12:00:00.000Z";

const dbState = {
  vehicles: [] as Row[],
  trips: [] as Row[],
  freights: [] as Row[],
  fuelings: [] as Row[],
  expenses: [] as Row[],
  maintenance_services: [] as Row[],
  personal_expenses: [] as Row[],
  profiles: [] as Row[],
};

const operations = {
  inserts: [] as Array<{ table: string; values: Row | Row[] }>,
  updates: [] as Array<{
    table: string;
    values: Row;
    filters: Array<{ column: string; value: unknown; type: "eq" | "in" }>;
  }>,
};

function seedDb() {
  dbState.vehicles = [];
  dbState.trips = [
    {
      id: "trip-1",
      user_id: "user-1",
      vehicle_id: "vehicle-1",
      status: "open",
      created_at: now,
      finished_at: null,
      estimated_distance: 0,
    },
  ];
  dbState.freights = [
    {
      id: "freight-1",
      user_id: "user-1",
      trip_id: "trip-1",
      origin: "Origem antiga",
      destination: "Destino antigo",
      km_initial: 100,
      gross_value: 1500,
      commission_percent: 10,
      commission_value: 150,
      status: "planned",
      estimated_distance: 500,
      created_at: now,
    },
  ];
  dbState.fuelings = [];
  dbState.expenses = [];
  dbState.maintenance_services = [];
  dbState.personal_expenses = [];
  dbState.profiles = [{ user_id: "user-1", personal_expenses_enabled: false }];
  operations.inserts = [];
  operations.updates = [];
}

function applyFilters(
  rows: Row[],
  filters: Array<{ column: string; value: unknown; type: "eq" | "in" }>,
) {
  return rows.filter((row) =>
    filters.every((filter) => {
      if (filter.type === "eq") return row[filter.column] === filter.value;
      return (
        Array.isArray(filter.value) && filter.value.includes(row[filter.column])
      );
    }),
  );
}

function makeBuilder(table: TableName) {
  const state = {
    filters: [] as Array<{ column: string; value: unknown; type: "eq" | "in" }>,
    order: null as null | { column: string; ascending: boolean },
    limit: null as number | null,
    mode: "select" as "select" | "update" | "delete",
    updateValues: null as Row | null,
  };

  const executeSelect = async () => {
    let rows = applyFilters(dbState[table], state.filters);

    if (state.order) {
      const { column, ascending } = state.order;
      rows = [...rows].sort((a, b) => {
        const aValue = a[column];
        const bValue = b[column];
        if (aValue === bValue) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        return ascending
          ? String(aValue).localeCompare(String(bValue), "pt-BR", {
              numeric: true,
            })
          : String(bValue).localeCompare(String(aValue), "pt-BR", {
              numeric: true,
            });
      });
    }

    if (typeof state.limit === "number") {
      rows = rows.slice(0, state.limit);
    }

    return { data: rows, error: null };
  };

  const executeMutation = async () => {
    const rows = applyFilters(dbState[table], state.filters);

    if (state.mode === "update" && state.updateValues) {
      rows.forEach((row) => Object.assign(row, state.updateValues));
      operations.updates.push({
        table,
        values: state.updateValues,
        filters: [...state.filters],
      });
    }

    if (state.mode === "delete") {
      dbState[table] = dbState[table].filter((row) => !rows.includes(row));
    }

    return { data: rows, error: null };
  };

  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(async (values: Row | Row[]) => {
      const rows = (Array.isArray(values) ? values : [values]).map(
        (value, index) => ({
          id:
            (value.id as string | undefined) ??
            `${table}-${dbState[table].length + index + 1}`,
          created_at: (value.created_at as string | undefined) ?? now,
          ...value,
        }),
      );
      dbState[table].push(...rows);
      operations.inserts.push({ table, values });
      return { data: rows, error: null };
    }),
    update: vi.fn((values: Row) => {
      state.mode = "update";
      state.updateValues = values;
      return builder;
    }),
    delete: vi.fn(() => {
      state.mode = "delete";
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      state.filters.push({ column, value, type: "eq" });
      return builder;
    }),
    in: vi.fn((column: string, value: unknown[]) => {
      state.filters.push({ column, value, type: "in" });
      return builder;
    }),
    order: vi.fn(
      (column: string, { ascending = true }: { ascending?: boolean } = {}) => {
        state.order = { column, ascending };
        return builder;
      },
    ),
    limit: vi.fn((value: number) => {
      state.limit = value;
      return builder;
    }),
    maybeSingle: vi.fn(async () => {
      const result = await executeSelect();
      return { data: result.data[0] ?? null, error: null };
    }),
    single: vi.fn(async () => {
      const result = await executeSelect();
      return result.data[0]
        ? { data: result.data[0], error: null }
        : { data: null, error: { message: "Not found" } };
    }),
    then: (
      resolve: (value: { data: Row[]; error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      const promise =
        state.mode === "select" ? executeSelect() : executeMutation();
      return promise.then(resolve, reject);
    },
  };

  return builder;
}

sharedMocks.fromMock.mockImplementation((table: TableName) =>
  makeBuilder(table),
);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: sharedMocks.fromMock,
  },
}));

function AppHarness({
  onReady,
}: {
  onReady: (ctx: ReturnType<typeof useApp>) => void;
}) {
  const ctx = useApp();
  React.useEffect(() => {
    if (!ctx.loading) onReady(ctx);
  }, [ctx, onReady]);
  return null;
}

async function renderApp() {
  let captured: ReturnType<typeof useApp> | null = null;
  const rendered = render(
    <AppProvider>
      <AppHarness
        onReady={(ctx) => {
          captured = ctx;
        }}
      />
    </AppProvider>,
  );

  await waitFor(() => expect(captured?.loading).toBe(false));
  return { app: captured!, unmount: rendered.unmount };
}

describe("AppContext route cache flows", () => {
  beforeEach(() => {
    seedDb();
    offlineState.queue = [];
    offlineState.online = true;
    sharedMocks.getRouteDistanceDiagnosticWithCacheMock.mockReset();
    sharedMocks.refreshRouteDistanceCacheMock.mockReset();
    sharedMocks.fromMock.mockClear();
    sharedMocks.toastMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("força nova tentativa de rota na revisão mesmo sem mudar origem e destino", async () => {
    sharedMocks.refreshRouteDistanceCacheMock.mockResolvedValue({
      distanceKm: 640,
      reason: null,
      source: "provider",
    });

    const { app, unmount } = await renderApp();

    await app.updateFreight(
      "trip-1",
      "freight-1",
      {
        origin: "Origem antiga",
        destination: "Destino antigo",
        kmInitial: 150,
        grossValue: 2000,
        commissionPercent: 12,
      },
      { forceRouteRefresh: true },
    );

    expect(sharedMocks.refreshRouteDistanceCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "Origem antiga",
        destination: "Destino antigo",
      }),
    );
    expect(dbState.freights[0]).toMatchObject({
      origin: "Origem antiga",
      destination: "Destino antigo",
      estimated_distance: 640,
    });
    unmount();
  }, 15000);

  it("bloqueia edição de frete quando a nova rota falha, preserva dados antigos e mostra feedback claro", async () => {
    sharedMocks.refreshRouteDistanceCacheMock.mockResolvedValue({
      distanceKm: null,
      reason: "Geocodificação falhou",
      originQueryUsed: "Nova origem",
      destinationQueryUsed: "Novo destino",
      source: "provider",
    });

    const { app, unmount } = await renderApp();

    await app.updateFreight("trip-1", "freight-1", {
      origin: "Nova origem",
      destination: "Novo destino",
      kmInitial: 150,
      grossValue: 2000,
      commissionPercent: 12,
      createdAt: new Date().toISOString(),
    });

    expect(dbState.freights[0]).toMatchObject({
      origin: "Origem antiga",
      destination: "Destino antigo",
      estimated_distance: 500,
    });
    expect(
      operations.updates.find((entry) => entry.table === "freights"),
    ).toBeUndefined();
    expect(sharedMocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Previsão ainda em ajuste",
        description: expect.stringContaining(
          "Rota salva, mas a previsão ainda não foi liberada",
        ),
        variant: "notice",
      }),
    );
    unmount();
  }, 15000);

  it("sincroniza frete criado offline, resolve distância e atualiza a viagem pela soma", async () => {
    sharedMocks.getRouteDistanceDiagnosticWithCacheMock.mockResolvedValue({
      distanceKm: 320,
      reason: null,
      source: "provider",
    });

    offlineState.online = false;
    const { app, unmount } = await renderApp();

    await app.addFreight("trip-1", {
      origin: "Curitiba",
      destination: "Joinville",
      kmInitial: 100,
      grossValue: 2400,
      commissionPercent: 10,
      createdAt: new Date().toISOString(),
    });

    expect(offlineState.queue).toHaveLength(1);
    expect(
      operations.inserts.find((entry) => entry.table === "freights"),
    ).toBeUndefined();

    offlineState.online = true;
    window.dispatchEvent(new Event("online"));

    await waitFor(() => {
      expect(dbState.freights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            origin: "Curitiba",
            destination: "Joinville",
            estimated_distance: 320,
          }),
        ]),
      );
    });

    expect(operations.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "trips",
          values: expect.objectContaining({ estimated_distance: 820 }),
        }),
      ]),
    );
    expect(offlineState.queue).toHaveLength(0);
    unmount();
  }, 15000);

  it("cria frete com rota repetida usando o resultado vindo do cache sem refresh desnecessário", async () => {
    sharedMocks.getRouteDistanceDiagnosticWithCacheMock.mockResolvedValue({
      distanceKm: 500,
      reason: null,
      source: "cache",
    });

    const { app, unmount } = await renderApp();

    await app.addFreight("trip-1", {
      origin: "Origem antiga",
      destination: "Destino antigo",
      kmInitial: 200,
      grossValue: 1800,
      commissionPercent: 10,
      createdAt: new Date().toISOString(),
    });

    expect(
      sharedMocks.getRouteDistanceDiagnosticWithCacheMock,
    ).toHaveBeenCalledWith({
      origin: "Origem antiga",
      destination: "Destino antigo",
      userId: "user-1",
    });
    expect(sharedMocks.refreshRouteDistanceCacheMock).not.toHaveBeenCalled();
    expect(dbState.freights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          origin: "Origem antiga",
          destination: "Destino antigo",
          estimated_distance: 500,
        }),
      ]),
    );
    unmount();
  }, 15000);

  it("cria frete com rota inédita via provider e atualiza a viagem corretamente", async () => {
    sharedMocks.getRouteDistanceDiagnosticWithCacheMock.mockResolvedValue({
      distanceKm: 275,
      reason: null,
      source: "provider",
    });

    const { app, unmount } = await renderApp();

    await app.addFreight("trip-1", {
      origin: "Londrina",
      destination: "Maringá",
      kmInitial: 220,
      grossValue: 1700,
      commissionPercent: 10,
      createdAt: new Date().toISOString(),
    });

    expect(dbState.freights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          origin: "Londrina",
          destination: "Maringá",
          estimated_distance: 275,
        }),
      ]),
    );
    expect(operations.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "trips",
          values: expect.objectContaining({ estimated_distance: 775 }),
        }),
      ]),
    );
    unmount();
  }, 15000);

  it("resume múltiplas falhas de rota no sync offline, sincroniza os fretes e mantém distância zero quando necessário", async () => {
    sharedMocks.getRouteDistanceDiagnosticWithCacheMock
      .mockResolvedValueOnce({
        distanceKm: null,
        reason: "Sem resultado para A",
        originQueryUsed: "A",
        destinationQueryUsed: "B",
        source: "provider",
      })
      .mockResolvedValueOnce({
        distanceKm: null,
        reason: "Sem resultado para C",
        originQueryUsed: "C",
        destinationQueryUsed: "D",
        source: "provider",
      });

    offlineState.queue = [
      {
        id: "queued-1",
        type: "addFreight",
        payload: {
          trip_id: "trip-1",
          origin: "A",
          destination: "B",
          km_initial: 150,
          km_final: 0,
          gross_value: 1000,
          commission_percent: 10,
          commission_value: 100,
          status: "planned",
          estimated_distance: 0,
        },
      },
      {
        id: "queued-2",
        type: "addFreight",
        payload: {
          trip_id: "trip-1",
          origin: "C",
          destination: "D",
          km_initial: 180,
          km_final: 0,
          gross_value: 1100,
          commission_percent: 10,
          commission_value: 110,
          status: "planned",
          estimated_distance: 0,
        },
      },
    ];

    const { app, unmount } = await renderApp();
    expect(app).toBeTruthy();

    window.dispatchEvent(new Event("online"));

    await waitFor(() => {
      expect(dbState.freights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            origin: "A",
            destination: "B",
            estimated_distance: 0,
          }),
          expect.objectContaining({
            origin: "C",
            destination: "D",
            estimated_distance: 0,
          }),
        ]),
      );
    });

    expect(sharedMocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sincronização parcial",
        description: expect.stringContaining(
          "2 fretes foram salvos e ainda têm rota em ajuste",
        ),
        variant: "notice",
      }),
    );
    expect(sharedMocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Dados sincronizados",
      }),
    );
    expect(offlineState.queue).toHaveLength(0);
    unmount();
  }, 15000);
});

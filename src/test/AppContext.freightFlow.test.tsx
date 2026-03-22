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
  getKmBounds: vi.fn((kms) => kms),
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
    offlineState.queue = offlineState.queue.filter((action) => action.id !== id);
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
  dbState.vehicles = [
    {
      id: "vehicle-1",
      user_id: "user-1",
      brand: "Volvo",
      model: "FH",
      year: 2022,
      plate: "ABC1234",
      operation_profile: "driver_owner",
      current_km: 1000,
      created_at: now,
    },
  ];
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
  dbState.freights = [];
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
      return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
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
          ? String(aValue).localeCompare(String(bValue), "pt-BR", { numeric: true })
          : String(bValue).localeCompare(String(aValue), "pt-BR", { numeric: true });
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
      const rows = (Array.isArray(values) ? values : [values]).map((value, index) => ({
        id:
          (value.id as string | undefined) ??
          `${table}-${dbState[table].length + index + 1}`,
        created_at: (value.created_at as string | undefined) ?? now,
        ...value,
      }));
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
    order: vi.fn((column: string, { ascending = true }: { ascending?: boolean } = {}) => {
      state.order = { column, ascending };
      return builder;
    }),
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
      const promise = state.mode === "select" ? executeSelect() : executeMutation();
      return promise.then(resolve, reject);
    },
  };

  return builder;
}

sharedMocks.fromMock.mockImplementation((table: TableName) => makeBuilder(table));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: sharedMocks.fromMock,
  },
}));

function AppHarness({ onReady }: { onReady: (ctx: ReturnType<typeof useApp>) => void }) {
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

describe("AppContext freight flow", () => {
  beforeEach(() => {
    seedDb();
    offlineState.queue = [];
    offlineState.online = true;
    sharedMocks.toastMock.mockReset();
    sharedMocks.getRouteDistanceDiagnosticWithCacheMock.mockReset();
    sharedMocks.refreshRouteDistanceCacheMock.mockReset();
    sharedMocks.fromMock.mockClear();
    sharedMocks.getRouteDistanceDiagnosticWithCacheMock.mockResolvedValue({
      distanceKm: 320,
      reason: null,
      source: "provider",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("cria frete como in_progress quando não há ativo nem planned", async () => {
    const { app, unmount } = await renderApp();

    await app.addFreight("trip-1", {
      origin: "SP",
      destination: "RJ",
      kmInitial: 120,
      grossValue: 2400,
      commissionPercent: 10,
      createdAt: now,
    });

    expect(dbState.freights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "in_progress" }),
      ]),
    );
    expect(sharedMocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Frete iniciado" }),
    );
    unmount();
  });

  it("cria frete como planned quando já existe frete in_progress", async () => {
    dbState.freights = [
      {
        id: "freight-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "A",
        destination: "B",
        km_initial: 100,
        gross_value: 1000,
        commission_percent: 10,
        commission_value: 100,
        status: "in_progress",
        estimated_distance: 200,
        created_at: now,
      },
    ];

    const { app, unmount } = await renderApp();

    await app.addFreight("trip-1", {
      origin: "Curitiba",
      destination: "Joinville",
      kmInitial: 180,
      grossValue: 2100,
      commissionPercent: 10,
      createdAt: now,
    });

    expect(dbState.freights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ origin: "Curitiba", status: "planned" }),
      ]),
    );
    expect(sharedMocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Próximo frete adicionado", variant: "notice" }),
    );
    unmount();
  });

  it("cria frete como planned quando há fila planejada sem frete ativo", async () => {
    dbState.freights = [
      {
        id: "freight-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "A",
        destination: "B",
        km_initial: 100,
        gross_value: 1000,
        commission_percent: 10,
        commission_value: 100,
        status: "planned",
        estimated_distance: 200,
        created_at: now,
      },
    ];

    const { app, unmount } = await renderApp();

    await app.addFreight("trip-1", {
      origin: "Maringá",
      destination: "Londrina",
      kmInitial: 190,
      grossValue: 2100,
      commissionPercent: 10,
      createdAt: now,
    });

    expect(dbState.freights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ origin: "Maringá", status: "planned" }),
      ]),
    );
    unmount();
  });

  it("não troca silenciosamente um frete em andamento por outro planejado", async () => {
    dbState.freights = [
      {
        id: "freight-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "A",
        destination: "B",
        km_initial: 100,
        gross_value: 1000,
        commission_percent: 10,
        commission_value: 100,
        status: "in_progress",
        estimated_distance: 200,
        created_at: now,
      },
      {
        id: "freight-2",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "C",
        destination: "D",
        km_initial: 200,
        gross_value: 1300,
        commission_percent: 10,
        commission_value: 130,
        status: "planned",
        estimated_distance: 200,
        created_at: "2026-03-18T12:05:00.000Z",
      },
    ];

    const { app, unmount } = await renderApp();

    const result = await app.startFreight("trip-1", "freight-2");

    expect(result).toEqual({ status: "blocked_active_freight", activeFreightId: "freight-1" });
    expect(dbState.freights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "freight-1", status: "in_progress" }),
        expect.objectContaining({ id: "freight-2", status: "planned" }),
      ]),
    );
    unmount();
  });

  it("inicia normalmente quando não existe frete ativo", async () => {
    dbState.freights = [
      {
        id: "freight-2",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "C",
        destination: "D",
        km_initial: 200,
        gross_value: 1300,
        commission_percent: 10,
        commission_value: 130,
        status: "planned",
        estimated_distance: 200,
        created_at: now,
      },
    ];

    const { app, unmount } = await renderApp();

    const result = await app.startFreight("trip-1", "freight-2");

    expect(result).toEqual({ status: "started" });
    expect(dbState.freights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "freight-2", status: "in_progress" }),
      ]),
    );
    unmount();
  });

  it("bloqueia edição de KM inicial em frete concluído no domínio", async () => {
    dbState.freights = [
      {
        id: "freight-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "A",
        destination: "B",
        km_initial: 100,
        gross_value: 1000,
        commission_percent: 10,
        commission_value: 100,
        status: "completed",
        estimated_distance: 200,
        created_at: now,
      },
    ];

    const { app, unmount } = await renderApp();

    const result = await app.updateFreight("trip-1", "freight-1", {
      origin: "A",
      destination: "B",
      kmInitial: 150,
      grossValue: 1000,
      commissionPercent: 10,
      createdAt: now,
    });

    expect(result).toEqual({
      status: "blocked",
      userMessage: "Frete concluído não pode ter o KM inicial alterado no fluxo normal.",
    });
    expect(dbState.freights[0]).toMatchObject({ km_initial: 100 });
    unmount();
  });

  it("excluir frete planned não contamina o KM atual do veículo", async () => {
    dbState.vehicles[0].current_km = 0;
    dbState.freights = [
      {
        id: "planned-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "A",
        destination: "B",
        km_initial: 900,
        gross_value: 1000,
        commission_percent: 10,
        commission_value: 100,
        status: "planned",
        estimated_distance: 200,
        created_at: now,
      },
    ];
    dbState.fuelings = [
      {
        id: "fuel-1",
        user_id: "user-1",
        trip_id: "trip-1",
        station_name: "Posto",
        total_value: 500,
        liters: 100,
        km_current: 450,
        price_per_liter: 5,
        average: 4.5,
        full_tank: false,
        date: now,
      },
    ];

    const { app, unmount } = await renderApp();

    await app.deleteFreight("trip-1", "planned-1");

    expect(dbState.vehicles[0]).toMatchObject({ current_km: 450 });
    unmount();
  });

  it("excluir frete em andamento recalcula o odômetro corretamente", async () => {
    dbState.vehicles[0].current_km = 0;
    dbState.freights = [
      {
        id: "active-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "A",
        destination: "B",
        km_initial: 300,
        gross_value: 1000,
        commission_percent: 10,
        commission_value: 100,
        status: "in_progress",
        estimated_distance: 200,
        created_at: now,
      },
      {
        id: "done-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "B",
        destination: "C",
        km_initial: 220,
        gross_value: 1200,
        commission_percent: 10,
        commission_value: 120,
        status: "completed",
        estimated_distance: 200,
        created_at: "2026-03-18T10:00:00.000Z",
      },
    ];

    const { app, unmount } = await renderApp();

    await app.deleteFreight("trip-1", "active-1");

    expect(dbState.vehicles[0]).toMatchObject({ current_km: 220 });
    unmount();
  });

  it("excluir frete concluído mantém odômetro coerente quando existe abastecimento maior", async () => {
    dbState.vehicles[0].current_km = 0;
    dbState.freights = [
      {
        id: "done-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "A",
        destination: "B",
        km_initial: 500,
        gross_value: 1000,
        commission_percent: 10,
        commission_value: 100,
        status: "completed",
        estimated_distance: 200,
        created_at: now,
      },
    ];
    dbState.fuelings = [
      {
        id: "fuel-1",
        user_id: "user-1",
        trip_id: "trip-1",
        station_name: "Posto",
        total_value: 500,
        liters: 100,
        km_current: 680,
        price_per_liter: 5,
        average: 4.5,
        full_tank: false,
        date: now,
      },
    ];

    const { app, unmount } = await renderApp();

    await app.deleteFreight("trip-1", "done-1");

    expect(dbState.vehicles[0]).toMatchObject({ current_km: 680 });
    unmount();
  });

  it("finaliza viagem concluindo frete em andamento e tirando planned do consolidado final", async () => {
    dbState.trips[0].estimated_distance = 4177;
    dbState.freights = [
      {
        id: "active-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "Campinas",
        destination: "Curitiba",
        km_initial: 1000,
        gross_value: 2000,
        commission_percent: 10,
        commission_value: 200,
        status: "in_progress",
        estimated_distance: 1138,
        created_at: now,
      },
      {
        id: "planned-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "Curitiba",
        destination: "Porto Alegre",
        km_initial: 0,
        gross_value: 5000,
        commission_percent: 10,
        commission_value: 500,
        status: "planned",
        estimated_distance: 3039,
        created_at: "2026-03-18T13:00:00.000Z",
      },
    ];
    dbState.fuelings = [
      {
        id: "fuel-1",
        user_id: "user-1",
        trip_id: "trip-1",
        station_name: "Posto",
        total_value: 500,
        liters: 100,
        km_current: 1800,
        price_per_liter: 5,
        average: 4.5,
        full_tank: false,
        date: now,
      },
    ];

    const { app, unmount } = await renderApp();

    const resultWithoutConfirmation = await app.finishTrip("trip-1", {
      arrivalKm: 2400,
    });

    expect(resultWithoutConfirmation).toEqual({
      autoCompletedFreightId: "active-1",
      pendingPlannedFreights: 1,
    });
    expect(dbState.trips[0]).toMatchObject({ status: "open" });

    const result = await app.finishTrip("trip-1", {
      arrivalKm: 2400,
      allowPendingPlanned: true,
    });

    expect(result).toEqual({
      autoCompletedFreightId: "active-1",
      pendingPlannedFreights: 1,
    });
    expect(dbState.freights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "active-1", status: "completed" }),
        expect.objectContaining({ id: "planned-1", status: "planned" }),
      ]),
    );
    expect(dbState.trips[0]).toMatchObject({
      status: "finished",
      estimated_distance: 1400,
    });
    expect(dbState.vehicles[0]).toMatchObject({ current_km: 2400 });
    expect(sharedMocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Viagem finalizada",
        description:
          "Frete em andamento concluído. Trechos não iniciados ficaram fora do consolidado final da viagem.",
      }),
    );
    unmount();
  });


  it("calcula o snapshot final com KM inicial zero sem tratar zero como ausência de checkpoint", async () => {
    dbState.freights = [
      {
        id: "active-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "A",
        destination: "B",
        km_initial: 0,
        gross_value: 1000,
        commission_percent: 10,
        commission_value: 100,
        status: "in_progress",
        estimated_distance: 200,
        created_at: now,
      },
    ];

    const { app, unmount } = await renderApp();

    await app.finishTrip("trip-1", {
      arrivalKm: 1200,
      allowPendingPlanned: true,
    });

    expect(dbState.trips[0]).toMatchObject({
      status: "finished",
      estimated_distance: 1200,
    });
    unmount();
  });

  it("bloqueia finalização com KM de chegada abaixo do maior KM real da operação", async () => {
    dbState.freights = [
      {
        id: "active-1",
        user_id: "user-1",
        trip_id: "trip-1",
        origin: "A",
        destination: "B",
        km_initial: 1000,
        gross_value: 1000,
        commission_percent: 10,
        commission_value: 100,
        status: "in_progress",
        estimated_distance: 200,
        created_at: now,
      },
    ];
    dbState.fuelings = [
      {
        id: "fuel-1",
        user_id: "user-1",
        trip_id: "trip-1",
        station_name: "Posto",
        total_value: 500,
        liters: 100,
        km_current: 1650,
        price_per_liter: 5,
        average: 4.5,
        full_tank: false,
        date: now,
      },
    ];

    const { app, unmount } = await renderApp();

    const result = await app.finishTrip("trip-1", {
      arrivalKm: 1500,
      allowPendingPlanned: true,
    });

    expect(result).toEqual({
      autoCompletedFreightId: "active-1",
      pendingPlannedFreights: 0,
    });
    expect(dbState.trips[0]).toMatchObject({ status: "open", finished_at: null });
    expect(sharedMocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Não foi possível finalizar a viagem",
        description:
          "O KM de chegada não pode ficar abaixo de 1.650 km, que é o maior KM real já lançado nesta operação.",
        variant: "destructive",
      }),
    );
    unmount();
  });
});

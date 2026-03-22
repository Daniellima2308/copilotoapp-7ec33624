import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { useApp } from "@/context/app-context";
import {
  getTripNetRevenue,
  getTripTotalExpenses,
  getTripCostPerKm,
  getTripAverageConsumption,
} from "@/lib/calculations";

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
  getRouteDistanceDiagnosticWithCache: vi.fn(),
  refreshRouteDistanceCache: vi.fn(),
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
  addToOfflineQueue: (action: { type: string; payload: Record<string, unknown> }) => {
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

const now = "2026-03-22T10:00:00.000Z";

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
      current_km: 100,
      created_at: now,
    },
  ];
  dbState.trips = [
    {
      id: "trip-1",
      user_id: "user-1",
      vehicle_id: "vehicle-1",
      status: "finished",
      created_at: "2026-03-18T08:00:00.000Z",
      finished_at: "2026-03-18T18:00:00.000Z",
      estimated_distance: 400,
    },
    {
      id: "trip-2",
      user_id: "user-1",
      vehicle_id: "vehicle-1",
      status: "finished",
      created_at: "2026-03-19T08:00:00.000Z",
      finished_at: "2026-03-19T18:00:00.000Z",
      estimated_distance: 300,
    },
    {
      id: "trip-3",
      user_id: "user-1",
      vehicle_id: "vehicle-1",
      status: "open",
      created_at: "2026-03-20T08:00:00.000Z",
      finished_at: null,
      estimated_distance: 300,
    },
  ];
  dbState.freights = [
    {
      id: "freight-1",
      user_id: "user-1",
      trip_id: "trip-1",
      origin: "A",
      destination: "B",
      km_initial: 100,
      gross_value: 1500,
      commission_percent: 10,
      commission_value: 150,
      status: "completed",
      estimated_distance: 400,
      created_at: "2026-03-18T08:00:00.000Z",
    },
    {
      id: "freight-2",
      user_id: "user-1",
      trip_id: "trip-2",
      origin: "B",
      destination: "C",
      km_initial: 500,
      gross_value: 1500,
      commission_percent: 10,
      commission_value: 150,
      status: "completed",
      estimated_distance: 300,
      created_at: "2026-03-19T08:00:00.000Z",
    },
    {
      id: "freight-3",
      user_id: "user-1",
      trip_id: "trip-3",
      origin: "C",
      destination: "D",
      km_initial: 800,
      gross_value: 1800,
      commission_percent: 10,
      commission_value: 180,
      status: "in_progress",
      estimated_distance: 300,
      created_at: "2026-03-20T08:00:00.000Z",
    },
  ];
  dbState.fuelings = [];
  dbState.expenses = [];
  dbState.maintenance_services = [];
  dbState.personal_expenses = [];
  dbState.profiles = [{ user_id: "user-1", personal_expenses_enabled: false }];
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
        id: value.id ?? `${table}-${dbState[table].length + index + 1}`,
        created_at: value.created_at ?? now,
        ...value,
      }));
      dbState[table].push(...rows);
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

describe("AppContext fueling flow", () => {
  beforeEach(() => {
    seedDb();
    offlineState.queue = [];
    offlineState.online = true;
    sharedMocks.toastMock.mockReset();
    sharedMocks.fromMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("salva abastecimento simples, calcula preço por litro e atualiza odômetro", async () => {
    const { app, unmount } = await renderApp();

    await app.addFueling("trip-1", {
      stationName: "Posto Inicial",
      totalValue: 1000,
      liters: 187.3,
      kmCurrent: 420,
      date: "2026-03-18",
      fullTank: false,
    });

    expect(dbState.fuelings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trip_id: "trip-1",
          total_value: 1000,
          price_per_liter: 5.34,
          average: 0,
          allocated_value: null,
          original_total_value: null,
        }),
      ]),
    );
    expect(dbState.vehicles[0]).toMatchObject({ current_km: 800 });
    unmount();
  });

  it("usa a mesma regra no offline e sincroniza com reprocessamento quando o sinal volta", async () => {
    offlineState.online = false;
    const { app, unmount } = await renderApp();

    await app.addFueling("trip-1", {
      stationName: "Posto Offline",
      totalValue: 600,
      liters: 100,
      kmCurrent: 450,
      date: "2026-03-18",
      fullTank: true,
    });

    expect(dbState.fuelings).toHaveLength(0);
    expect(offlineState.queue).toHaveLength(1);

    offlineState.online = true;
    window.dispatchEvent(new Event("online"));

    await waitFor(() => {
      expect(offlineState.queue).toHaveLength(0);
      expect(dbState.fuelings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            station: "Posto Offline",
            total_value: 600,
            price_per_liter: 6,
          }),
        ]),
      );
    });

    unmount();
  });

  it("rateia abastecimento completo entre múltiplas viagens sem duplicar custo", async () => {
    dbState.fuelings = [
      {
        id: "fuel-base",
        user_id: "user-1",
        trip_id: "trip-1",
        station: "Posto Base",
        total_value: 900,
        liters: 150,
        km_current: 300,
        price_per_liter: 6,
        average: 0,
        full_tank: true,
        date: "2026-03-18",
        receipt_url: null,
        allocated_value: null,
        original_total_value: null,
      },
    ];

    const { app, unmount } = await renderApp();

    await app.addFueling("trip-3", {
      stationName: "Posto Final",
      totalValue: 1000,
      liters: 100,
      kmCurrent: 1000,
      date: "2026-03-22",
      fullTank: true,
    });

    const fueling = dbState.fuelings.find((item) => item.trip_id === "trip-3");
    expect(fueling).toMatchObject({
      total_value: 285.72,
      allocated_value: 285.72,
      original_total_value: 1000,
      average: 7,
      price_per_liter: 10,
    });
    expect(
      dbState.expenses.filter((expense) => expense.source_fueling_id === fueling?.id),
    ).toEqual([
      expect.objectContaining({ trip_id: "trip-1", value: 285.71, category: "combustivel_rateio" }),
      expect.objectContaining({ trip_id: "trip-2", value: 428.57, category: "combustivel_rateio" }),
    ]);
    const allocatedTotal =
      fueling!.total_value +
      dbState.expenses
        .filter((expense) => expense.source_fueling_id === fueling!.id)
        .reduce((sum, expense) => sum + expense.value, 0);
    expect(allocatedTotal).toBe(1000);
    unmount();
  });

  it("edita abastecimento rateado limpando resíduos e recriando rateio", async () => {
    dbState.fuelings = [
      {
        id: "fuel-base",
        user_id: "user-1",
        trip_id: "trip-1",
        station: "Posto Base",
        total_value: 900,
        liters: 150,
        km_current: 300,
        price_per_liter: 6,
        average: 0,
        full_tank: true,
        date: "2026-03-18",
        receipt_url: null,
        allocated_value: null,
        original_total_value: null,
      },
      {
        id: "fuel-rateado",
        user_id: "user-1",
        trip_id: "trip-3",
        station: "Posto Final",
        total_value: 285.72,
        liters: 100,
        km_current: 1000,
        price_per_liter: 10,
        average: 7,
        full_tank: true,
        date: "2026-03-22",
        receipt_url: null,
        allocated_value: 285.72,
        original_total_value: 1000,
      },
    ];
    dbState.expenses = [
      {
        id: "expense-1",
        user_id: "user-1",
        trip_id: "trip-1",
        category: "combustivel_rateio",
        description: "Parte do combustível deste abastecimento foi usada na viagem anterior.",
        value: 285.71,
        date: "2026-03-22",
        source_fueling_id: "fuel-rateado",
      },
      {
        id: "expense-2",
        user_id: "user-1",
        trip_id: "trip-2",
        category: "combustivel_rateio",
        description: "Parte do combustível deste abastecimento foi usada na viagem anterior.",
        value: 428.57,
        date: "2026-03-22",
        source_fueling_id: "fuel-rateado",
      },
    ];

    const { app, unmount } = await renderApp();

    await app.updateFueling("trip-3", "fuel-rateado", {
      stationName: "Posto Final Ajustado",
      totalValue: 1200,
      liters: 120,
      kmCurrent: 1000,
      date: "2026-03-22",
      fullTank: true,
    });

    const fueling = dbState.fuelings.find((item) => item.id === "fuel-rateado");
    expect(fueling).toMatchObject({
      station: "Posto Final Ajustado",
      total_value: 342.85,
      allocated_value: 342.85,
      original_total_value: 1200,
      average: 5.83,
    });
    const rateios = dbState.expenses.filter((expense) => expense.source_fueling_id === "fuel-rateado");
    expect(rateios).toHaveLength(2);
    expect(rateios).toEqual([
      expect.objectContaining({ trip_id: "trip-1", value: 342.86 }),
      expect.objectContaining({ trip_id: "trip-2", value: 514.29 }),
    ]);
    unmount();
  });

  it("exclui abastecimento rateado, limpa despesas ligadas e recalcula odômetro", async () => {
    dbState.fuelings = [
      {
        id: "fuel-base",
        user_id: "user-1",
        trip_id: "trip-1",
        station: "Posto Base",
        total_value: 900,
        liters: 150,
        km_current: 300,
        price_per_liter: 6,
        average: 0,
        full_tank: true,
        date: "2026-03-18",
        receipt_url: null,
        allocated_value: null,
        original_total_value: null,
      },
      {
        id: "fuel-rateado",
        user_id: "user-1",
        trip_id: "trip-3",
        station: "Posto Final",
        total_value: 285.72,
        liters: 100,
        km_current: 1000,
        price_per_liter: 10,
        average: 7,
        full_tank: true,
        date: "2026-03-22",
        receipt_url: null,
        allocated_value: 285.72,
        original_total_value: 1000,
      },
    ];
    dbState.expenses = [
      {
        id: "expense-1",
        user_id: "user-1",
        trip_id: "trip-1",
        category: "combustivel_rateio",
        description: "Parte do combustível deste abastecimento foi usada na viagem anterior.",
        value: 285.71,
        date: "2026-03-22",
        source_fueling_id: "fuel-rateado",
      },
      {
        id: "expense-2",
        user_id: "user-1",
        trip_id: "trip-2",
        category: "combustivel_rateio",
        description: "Parte do combustível deste abastecimento foi usada na viagem anterior.",
        value: 428.57,
        date: "2026-03-22",
        source_fueling_id: "fuel-rateado",
      },
    ];

    const { app, unmount } = await renderApp();

    await app.deleteFueling("trip-3", "fuel-rateado");

    expect(dbState.fuelings.find((item) => item.id === "fuel-rateado")).toBeUndefined();
    expect(dbState.expenses.find((item) => item.source_fueling_id === "fuel-rateado")).toBeUndefined();
    expect(dbState.vehicles[0]).toMatchObject({ current_km: 800 });
    unmount();
  });

  it("mantém impacto financeiro coerente após editar um abastecimento rateado", async () => {
    dbState.fuelings = [
      {
        id: "fuel-base",
        user_id: "user-1",
        trip_id: "trip-1",
        station: "Posto Base",
        total_value: 900,
        liters: 150,
        km_current: 300,
        price_per_liter: 6,
        average: 0,
        full_tank: true,
        date: "2026-03-18",
        receipt_url: null,
        allocated_value: null,
        original_total_value: null,
      },
      {
        id: "fuel-rateado",
        user_id: "user-1",
        trip_id: "trip-3",
        station: "Posto Final",
        total_value: 285.72,
        liters: 100,
        km_current: 1000,
        price_per_liter: 10,
        average: 7,
        full_tank: true,
        date: "2026-03-22",
        receipt_url: null,
        allocated_value: 285.72,
        original_total_value: 1000,
      },
    ];
    dbState.expenses = [
      {
        id: "expense-1",
        user_id: "user-1",
        trip_id: "trip-1",
        category: "combustivel_rateio",
        description: "Parte do combustível deste abastecimento foi usada na viagem anterior.",
        value: 285.71,
        date: "2026-03-22",
        source_fueling_id: "fuel-rateado",
      },
      {
        id: "expense-2",
        user_id: "user-1",
        trip_id: "trip-2",
        category: "combustivel_rateio",
        description: "Parte do combustível deste abastecimento foi usada na viagem anterior.",
        value: 428.57,
        date: "2026-03-22",
        source_fueling_id: "fuel-rateado",
      },
    ];

    const { app, unmount } = await renderApp();

    await app.updateFueling("trip-3", "fuel-rateado", {
      stationName: "Posto Final Ajustado",
      totalValue: 1200,
      liters: 120,
      kmCurrent: 1000,
      date: "2026-03-22",
      fullTank: true,
    });

    unmount();

    const refreshed = await renderApp();
    const trip1 = refreshed.app.data.trips.find((trip) => trip.id === "trip-1")!;
    const trip3 = refreshed.app.data.trips.find((trip) => trip.id === "trip-3")!;

    expect(
      trip1.expenses.find((expense) => expense.category === "combustivel_rateio")?.value,
    ).toBe(342.86);
    expect(getTripTotalExpenses(trip1)).toBeCloseTo(1242.86, 2);
    expect(getTripNetRevenue(trip1)).toBeCloseTo(107.14, 2);
    expect(getTripTotalExpenses(trip3)).toBeCloseTo(342.85, 2);
    expect(getTripCostPerKm(trip3)).toBe(1.74);
    expect(getTripAverageConsumption(trip3)).toBe(5.83);
    refreshed.unmount();
  });
});

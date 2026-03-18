import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TripDetailPage from "@/pages/TripDetailPage";
import type { AppContextType } from "@/context/app-context";
import type { Trip, Vehicle } from "@/types";

const appContextMock = vi.hoisted(() => ({
  useApp: vi.fn(),
}));

vi.mock("@/context/app-context", () => ({
  useApp: appContextMock.useApp,
}));

vi.mock("@/lib/exportPdf", () => ({
  exportSingleTripPdf: vi.fn(),
}));

vi.mock("@/components/FinishTripModal", () => ({
  FinishTripModal: () => null,
}));

vi.mock("@/components/TripHeroCard", () => ({
  TripHeroCard: () => <div>Hero mock</div>,
}));

vi.mock("@/components/trip/FreightTab", () => ({
  FreightTab: () => <div>Freight tab mock</div>,
}));

vi.mock("@/components/trip/FuelTab", () => ({
  FuelTab: () => <div>Fuel tab mock</div>,
}));

vi.mock("@/components/trip/ExpenseTab", () => ({
  ExpenseTab: () => <div>Expense tab mock</div>,
}));

const vehicle: Vehicle = {
  id: "vehicle-1",
  brand: "Volvo",
  model: "FH",
  year: 2024,
  plate: "ABC1D23",
  operationProfile: "driver_owner",
  currentKm: 1000,
};

const trip: Trip = {
  id: "trip-1",
  vehicleId: "vehicle-1",
  status: "open",
  createdAt: "2026-03-18T00:00:00.000Z",
  estimatedDistance: 4177,
  fuelings: [],
  expenses: [
    {
      id: "expense-1",
      tripId: "trip-1",
      category: "pedagio",
      description: "Pedágio",
      value: 200,
      date: "2026-03-18",
    },
  ],
  personalExpenses: [],
  freights: [
    {
      id: "freight-1",
      tripId: "trip-1",
      origin: "São Paulo",
      destination: "Goiânia",
      kmInitial: 1000,
      grossValue: 2000,
      commissionPercent: 10,
      commissionValue: 200,
      status: "in_progress",
      estimatedDistance: 1138,
      createdAt: "2026-03-18T00:00:00.000Z",
    },
    {
      id: "freight-2",
      tripId: "trip-1",
      origin: "Goiânia",
      destination: "Belém",
      kmInitial: 0,
      grossValue: 5000,
      commissionPercent: 10,
      commissionValue: 500,
      status: "planned",
      estimatedDistance: 3039,
      createdAt: "2026-03-18T00:00:00.000Z",
    },
  ],
};

function buildContext(): AppContextType {
  return {
    data: { vehicles: [vehicle], trips: [trip], maintenanceServices: [] },
    loading: false,
    personalExpensesEnabled: true,
    setPersonalExpensesEnabled: vi.fn(),
    addVehicle: vi.fn(),
    updateVehicle: vi.fn(),
    deleteVehicle: vi.fn(),
    updateVehicleKm: vi.fn(),
    addTrip: vi.fn(),
    finishTrip: vi.fn(),
    deleteTrip: vi.fn(),
    getActiveTrips: vi.fn(() => [trip]),
    addFreight: vi.fn(),
    updateFreight: vi.fn(),
    deleteFreight: vi.fn(),
    startFreight: vi.fn(),
    completeFreight: vi.fn(),
    addFueling: vi.fn(),
    updateFueling: vi.fn(),
    deleteFueling: vi.fn(),
    addExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
    addPersonalExpense: vi.fn(),
    updatePersonalExpense: vi.fn(),
    deletePersonalExpense: vi.fn(),
    clearHistory: vi.fn(),
    refreshData: vi.fn(),
    addMaintenanceService: vi.fn(),
    deleteMaintenanceService: vi.fn(),
  };
}

describe("TripDetailPage KM basis", () => {
  it("mantém 'até agora' operacional e separa do total previsto no resumo", async () => {
    appContextMock.useApp.mockReturnValue(buildContext());

    render(
      <MemoryRouter initialEntries={["/trip/trip-1"]}>
        <Routes>
          <Route path="/trip/:id" element={<TripDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("KM considerado até agora")).toBeInTheDocument();
    expect(screen.getByText("1.138 km")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Conta feita com a rota dos trechos já em andamento/concluídos.",
      ).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /entender os números/i }));

    expect(
      await screen.findByText(/1\.138 km estimados só dos trechos em andamento\/concluídos/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/4\.177 km previstos da viagem inteira/i),
    ).toBeInTheDocument();
  });
});

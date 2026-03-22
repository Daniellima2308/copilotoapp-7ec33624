import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TripHistoryList } from "@/components/TripHistoryList";
import type { Trip, Vehicle } from "@/types";

const appContextMock = vi.hoisted(() => ({
  useApp: vi.fn(),
}));

vi.mock("@/context/app-context", () => ({
  useApp: appContextMock.useApp,
}));

const vehicle: Vehicle = {
  id: "vehicle-1",
  brand: "Volvo",
  model: "FH",
  year: 2024,
  plate: "ABC1D23",
  operationProfile: "driver_owner",
  currentKm: 2400,
};

const finishedTrip: Trip = {
  id: "trip-1",
  vehicleId: "vehicle-1",
  status: "finished",
  createdAt: "2026-03-18T00:00:00.000Z",
  finishedAt: "2026-03-20T00:00:00.000Z",
  estimatedDistance: 1400,
  fuelings: [
    {
      id: "fuel-1",
      tripId: "trip-1",
      stationName: "Posto",
      totalValue: 1100,
      liters: 200,
      kmCurrent: 2400,
      pricePerLiter: 5.5,
      average: 0,
      fullTank: true,
      date: "2026-03-19",
    },
  ],
  expenses: [
    {
      id: "expense-1",
      tripId: "trip-1",
      category: "pedagio",
      description: "Pedágio",
      value: 200,
      date: "2026-03-19",
    },
  ],
  personalExpenses: [],
  freights: [
    {
      id: "freight-1",
      tripId: "trip-1",
      origin: "Campinas",
      destination: "Curitiba",
      kmInitial: 1000,
      grossValue: 2000,
      commissionPercent: 10,
      commissionValue: 200,
      status: "completed",
      estimatedDistance: 1138,
      createdAt: "2026-03-18T00:00:00.000Z",
    },
    {
      id: "freight-2",
      tripId: "trip-1",
      origin: "Curitiba",
      destination: "Porto Alegre",
      kmInitial: 0,
      grossValue: 5000,
      commissionPercent: 10,
      commissionValue: 500,
      status: "planned",
      estimatedDistance: 3039,
      createdAt: "2026-03-18T01:00:00.000Z",
    },
  ],
};

describe("TripHistoryList", () => {
  it("mostra no histórico o consolidado final sem contaminar com frete planned", () => {
    appContextMock.useApp.mockReturnValue({
      data: { vehicles: [vehicle] },
    });

    render(
      <MemoryRouter>
        <TripHistoryList trips={[finishedTrip]} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/ABC1D23 • Volvo FH → Curitiba/),
    ).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("R$") && content.includes("500,00"))).toBeInTheDocument();
  });
});

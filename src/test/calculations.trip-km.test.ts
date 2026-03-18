import { describe, expect, it } from "vitest";
import {
  getTripCostPerKmToDate,
  getTripEstimatedKmTotal,
  getTripKmBasisToDate,
  getTripKmBasisTotal,
  getTripProfitPerKmToDate,
} from "@/lib/calculations";
import { Trip } from "@/types";

const tripBase: Trip = {
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
      origin: "Campinas",
      destination: "Curitiba",
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
      origin: "Curitiba",
      destination: "Porto Alegre",
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

describe("trip KM basis", () => {
  it("não inclui frete planejado no denominador do lucro/km até agora", () => {
    expect(getTripProfitPerKmToDate(tripBase)).toBe(1.41);
  });

  it("não inclui frete planejado no denominador do custo/km até agora", () => {
    expect(getTripCostPerKmToDate(tripBase)).toBe(0.35);
  });

  it("mantém o total previsto incluindo trechos planejados", () => {
    expect(getTripEstimatedKmTotal(tripBase)).toBe(4177);
    expect(getTripKmBasisTotal(tripBase)).toEqual({
      km: 4177,
      source: "estimated",
    });
  });

  it("usa apenas KM estimado operacional quando ainda não existe KM real suficiente", () => {
    expect(getTripKmBasisToDate(tripBase)).toEqual({
      km: 1138,
      source: "estimated",
    });
  });

  it("usa KM real até agora sem deixar frete planejado contaminar checkpoints", () => {
    const tripWithActualKm: Trip = {
      ...tripBase,
      fuelings: [
        {
          id: "fueling-1",
          tripId: "trip-1",
          stationName: "Posto 1",
          totalValue: 900,
          liters: 300,
          kmCurrent: 2138,
          pricePerLiter: 3,
          average: 0,
          fullTank: true,
          date: "2026-03-18",
        },
      ],
      freights: tripBase.freights.map((freight) =>
        freight.id === "freight-2"
          ? { ...freight, kmInitial: 999999 }
          : freight,
      ),
    };

    expect(getTripKmBasisToDate(tripWithActualKm)).toEqual({
      km: 1138,
      source: "actual",
    });
  });
});

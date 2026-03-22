import { describe, expect, it } from "vitest";
import {
  buildFuelingFinancialPlan,
  calculateFuelingPricePerLiter,
  getWeightedTripAverageConsumption,
} from "@/lib/fueling";

describe("fueling domain helpers", () => {
  it("calcula preço por litro com arredondamento de centavos", () => {
    expect(calculateFuelingPricePerLiter(100, 18.73)).toBe(5.34);
  });

  it("mantém média zerada quando não existe base anterior válida", () => {
    const plan = buildFuelingFinancialPlan({
      fuelings: [
        {
          id: "fuel-1",
          tripId: "trip-1",
          stationName: "Posto Base",
          totalValue: 500,
          liters: 100,
          kmCurrent: 1000,
          fullTank: true,
          date: "2026-03-20",
        },
      ],
      tripStartKmMap: new Map([["trip-1", 900]]),
    });

    expect(plan[0]).toMatchObject({ average: 0, allocatedValue: null, originalTotalValue: null });
  });

  it("calcula média em tanque cheio com base anterior válida", () => {
    const plan = buildFuelingFinancialPlan({
      fuelings: [
        {
          id: "fuel-1",
          tripId: "trip-1",
          stationName: "Posto A",
          totalValue: 600,
          liters: 100,
          kmCurrent: 1000,
          fullTank: true,
          date: "2026-03-20",
        },
        {
          id: "fuel-2",
          tripId: "trip-1",
          stationName: "Posto B",
          totalValue: 650,
          liters: 80,
          kmCurrent: 1480,
          fullTank: true,
          date: "2026-03-21",
        },
      ],
      tripStartKmMap: new Map([["trip-1", 900]]),
    });

    expect(plan[1]).toMatchObject({ average: 6, allocatedValue: null, originalTotalValue: null });
  });

  it("rateia combustível entre múltiplas viagens sem perder nem duplicar custo", () => {
    const plan = buildFuelingFinancialPlan({
      fuelings: [
        {
          id: "fuel-base",
          tripId: "trip-1",
          stationName: "Posto Base",
          totalValue: 900,
          liters: 150,
          kmCurrent: 300,
          fullTank: true,
          date: "2026-03-18",
        },
        {
          id: "fuel-rateio",
          tripId: "trip-3",
          stationName: "Posto Final",
          totalValue: 1000,
          liters: 100,
          kmCurrent: 1000,
          fullTank: true,
          date: "2026-03-22",
        },
      ],
      tripStartKmMap: new Map([
        ["trip-1", 100],
        ["trip-2", 500],
        ["trip-3", 800],
      ]),
    });

    expect(plan[1].allocatedValue).toBe(285.72);
    expect(plan[1].originalTotalValue).toBe(1000);
    expect(plan[1].rateioExpenses).toEqual([
      expect.objectContaining({ tripId: "trip-1", value: 285.71 }),
      expect.objectContaining({ tripId: "trip-2", value: 428.57 }),
    ]);
    const allocatedTotal =
      (plan[1].allocatedValue || 0) +
      plan[1].rateioExpenses.reduce((sum, expense) => sum + expense.value, 0);
    expect(allocatedTotal).toBe(1000);
  });

  it("calcula média consolidada ponderada por litros válidos", () => {
    expect(
      getWeightedTripAverageConsumption([
        { fullTank: true, average: 5, liters: 100 },
        { fullTank: true, average: 7, liters: 20 },
      ]),
    ).toBe(5.33);
  });
});

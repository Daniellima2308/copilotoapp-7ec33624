import { describe, expect, it } from "vitest";
import {
  getFreightStatusForInsert,
  sortFreightsByOperationalPriority,
} from "@/lib/freightStatus";
import type { Freight } from "@/types";

function makeFreight(
  id: string,
  status: Freight["status"],
  createdAt: string,
): Freight {
  return {
    id,
    tripId: "trip-1",
    origin: `Origem ${id}`,
    destination: `Destino ${id}`,
    kmInitial: 100,
    grossValue: 1000,
    commissionPercent: 10,
    commissionValue: 100,
    status,
    estimatedDistance: 200,
    createdAt,
  };
}

describe("freightStatus", () => {
  it("insere como in_progress quando não há ativo nem planned", () => {
    expect(
      getFreightStatusForInsert([
        makeFreight("completed-1", "completed", "2026-03-20T10:00:00.000Z"),
      ]),
    ).toBe("in_progress");
  });

  it("insere como planned quando já existe frete in_progress", () => {
    expect(
      getFreightStatusForInsert([
        makeFreight("active", "in_progress", "2026-03-20T10:00:00.000Z"),
      ]),
    ).toBe("planned");
  });

  it("insere como planned quando não há ativo, mas já existe planned", () => {
    expect(
      getFreightStatusForInsert([
        makeFreight("planned", "planned", "2026-03-20T10:00:00.000Z"),
      ]),
    ).toBe("planned");
  });

  it("ordena fretes por prioridade operacional: in_progress, planned, completed", () => {
    const result = sortFreightsByOperationalPriority([
      makeFreight("completed", "completed", "2026-03-20T12:00:00.000Z"),
      makeFreight("planned-2", "planned", "2026-03-20T13:00:00.000Z"),
      makeFreight("active", "in_progress", "2026-03-20T14:00:00.000Z"),
      makeFreight("planned-1", "planned", "2026-03-20T11:00:00.000Z"),
    ]);

    expect(result.map((freight) => freight.id)).toEqual([
      "active",
      "planned-1",
      "planned-2",
      "completed",
    ]);
  });
});

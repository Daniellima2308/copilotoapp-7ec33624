import { describe, expect, it } from "vitest";
import { normalizeVehicleProfileUpdateForPersistence } from "@/lib/vehicleOperation";

describe("normalizeVehicleProfileUpdateForPersistence", () => {
  it("preserva perfil commissioned_driver ao editar apenas percentual", () => {
    const result = normalizeVehicleProfileUpdateForPersistence({
      currentVehicle: {
        operationProfile: "commissioned_driver",
        driverBond: "clt",
        defaultCommissionPercent: 12,
      },
      defaultCommissionPercent: 15,
    });

    expect(result.operationProfile).toBe("commissioned_driver");
    expect(result.driverBond).toBe("clt");
    expect(result.defaultCommissionPercent).toBe(15);
  });

  it("preserva perfil owner_with_driver ao editar apenas percentual", () => {
    const result = normalizeVehicleProfileUpdateForPersistence({
      currentVehicle: {
        operationProfile: "owner_with_driver",
        driverBond: "autonomo",
        defaultCommissionPercent: 10,
      },
      defaultCommissionPercent: 8,
    });

    expect(result.operationProfile).toBe("owner_with_driver");
    expect(result.driverBond).toBe("autonomo");
    expect(result.defaultCommissionPercent).toBe(8);
  });
});

import { Vehicle, VehicleOperationProfile } from "@/types";

export const VEHICLE_OPERATION_PROFILE_LABELS: Record<VehicleOperationProfile, string> = {
  driver_owner: "Motorista dono do caminhão",
  commissioned_driver: "Motorista comissionado",
  owner_with_driver: "Dono do caminhão com motorista",
  custom: "Personalizado",
};

export function profileUsesFixedCommission(profile: VehicleOperationProfile) {
  return profile === "commissioned_driver" || profile === "owner_with_driver";
}

export function shouldShowCommissionToggle(profile: VehicleOperationProfile) {
  return profile === "custom";
}

export function shouldShowCommissionFieldByDefault(profile: VehicleOperationProfile) {
  return profileUsesFixedCommission(profile);
}

export function getDefaultCommissionPercentForVehicle(vehicle?: Vehicle) {
  if (!vehicle) return 0;

  if (vehicle.operationProfile === "driver_owner") return 0;
  if (profileUsesFixedCommission(vehicle.operationProfile)) {
    return vehicle.defaultCommissionPercent ?? 0;
  }

  return 0;
}

export function canEditCommissionPercentForFreight(vehicle?: Vehicle) {
  if (!vehicle) return true;
  return vehicle.operationProfile === "custom" || vehicle.operationProfile === "driver_owner";
}

export function getFleetOwnerStateByProfile(profile: VehicleOperationProfile) {
  if (profile === "owner_with_driver") return true;
  if (profile === "custom") return null;
  return false;
}

export function isDriverNameRequiredByProfile(profile: VehicleOperationProfile) {
  return profile === "owner_with_driver";
}

export function getVehicleOperatorDisplayName(vehicle: Vehicle) {
  const driverName = vehicle.driverName?.trim();
  if (driverName) return driverName;
  return VEHICLE_OPERATION_PROFILE_LABELS[vehicle.operationProfile];
}

export interface CommissionPercentFeedback {
  title: string;
  celebrate: boolean;
}

export function getCommissionPercentFeedback(profile: VehicleOperationProfile, oldPercent: number, newPercent: number): CommissionPercentFeedback {
  const up = newPercent > oldPercent;

  if (profile === "commissioned_driver") {
    if (up) return { celebrate: true, title: `Boa! Sua comissão subiu para ${newPercent}% 👏` };
    return { celebrate: false, title: `Sua comissão foi ajustada para ${newPercent}%.` };
  }

  if (profile === "owner_with_driver") {
    if (!up) {
      return {
        celebrate: true,
        title: `Percentual do motorista ajustado para ${newPercent}%. Mais margem para o caixa do caminhão. 📈`,
      };
    }
    return { celebrate: false, title: `Percentual do motorista atualizado para ${newPercent}%.` };
  }

  if (profile === "driver_owner") {
    if (up) return { celebrate: true, title: `Boa! Sua retirada subiu para ${newPercent}% 👏` };
    return { celebrate: false, title: `Sua retirada foi ajustada para ${newPercent}%.` };
  }

  return { celebrate: false, title: `Percentual padrão atualizado para ${newPercent}%.` };
}

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
  return vehicle.operationProfile === "custom";
}

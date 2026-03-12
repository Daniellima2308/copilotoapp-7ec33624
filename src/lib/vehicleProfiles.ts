export interface VehicleProfileTemplate {
  id: string;
  label: string;
  category: "leve" | "medio" | "pesado";
  suggestedAxles: number;
  tankCapacityLiters: number;
  baselineConsumptionKml: number;
  maintenancePlan: Array<{ serviceName: string; intervalKm: number }>;
}

const VEHICLE_PROFILE_KEY = "copiloto-vehicle-profile-map";

export const VEHICLE_PROFILE_TEMPLATES: VehicleProfileTemplate[] = [
  {
    id: "atego_2426",
    label: "Mercedes-Benz Atego 2426",
    category: "pesado",
    suggestedAxles: 3,
    tankCapacityLiters: 300,
    baselineConsumptionKml: 2.9,
    maintenancePlan: [
      { serviceName: "Óleo de Motor", intervalKm: 15000 },
      { serviceName: "Filtro de Óleo", intervalKm: 15000 },
      { serviceName: "Filtro de Combustível", intervalKm: 20000 },
      { serviceName: "Lonas de Freio", intervalKm: 30000 },
    ],
  },
  {
    id: "scania_r450",
    label: "Scania R450",
    category: "pesado",
    suggestedAxles: 6,
    tankCapacityLiters: 500,
    baselineConsumptionKml: 2.4,
    maintenancePlan: [
      { serviceName: "Óleo de Motor", intervalKm: 20000 },
      { serviceName: "Filtro de Óleo", intervalKm: 20000 },
      { serviceName: "Filtro de Ar", intervalKm: 25000 },
      { serviceName: "Filtro Separador", intervalKm: 20000 },
    ],
  },
  {
    id: "volvo_fh_540",
    label: "Volvo FH 540",
    category: "pesado",
    suggestedAxles: 6,
    tankCapacityLiters: 600,
    baselineConsumptionKml: 2.2,
    maintenancePlan: [
      { serviceName: "Óleo de Motor", intervalKm: 20000 },
      { serviceName: "Filtro de Óleo", intervalKm: 20000 },
      { serviceName: "Filtro de Ar", intervalKm: 25000 },
      { serviceName: "Graxa (Engraxar)", intervalKm: 10000 },
    ],
  },
  {
    id: "custom",
    label: "Perfil Personalizado",
    category: "medio",
    suggestedAxles: 3,
    tankCapacityLiters: 300,
    baselineConsumptionKml: 3,
    maintenancePlan: [
      { serviceName: "Óleo de Motor", intervalKm: 15000 },
      { serviceName: "Filtro de Óleo", intervalKm: 15000 },
    ],
  },
];

export function getProfileTemplateById(id?: string): VehicleProfileTemplate | null {
  if (!id) return null;
  return VEHICLE_PROFILE_TEMPLATES.find((t) => t.id === id) || null;
}

export function getVehicleProfileMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(VEHICLE_PROFILE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setVehicleProfile(vehicleId: string, profileId: string): void {
  const current = getVehicleProfileMap();
  current[vehicleId] = profileId;
  localStorage.setItem(VEHICLE_PROFILE_KEY, JSON.stringify(current));
}

export function getVehicleProfile(vehicleId: string): VehicleProfileTemplate | null {
  const map = getVehicleProfileMap();
  return getProfileTemplateById(map[vehicleId]);
}

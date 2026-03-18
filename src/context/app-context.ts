import { createContext, useContext } from "react";
import type {
  AppData,
  Vehicle,
  Trip,
  Freight,
  Fueling,
  Expense,
  MaintenanceService,
  PersonalExpense,
} from "@/types";

export interface FreightUpdateResult {
  status: "updated" | "route_refreshed" | "saved_without_route" | "blocked";
  userMessage?: string;
}

export interface AppContextType {
  data: AppData;
  loading: boolean;
  personalExpensesEnabled: boolean;
  setPersonalExpensesEnabled: (v: boolean) => Promise<void>;
  addVehicle: (v: Omit<Vehicle, "id">) => Promise<void>;
  updateVehicle: (id: string, v: Partial<Omit<Vehicle, "id">>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  updateVehicleKm: (vehicleId: string, km: number) => Promise<void>;
  addTrip: (vehicleId: string) => Promise<Trip>;
  finishTrip: (
    id: string,
    arrivalKm?: number,
  ) => Promise<{ autoCompletedFreightId?: string | null }>;
  deleteTrip: (id: string) => Promise<void>;
  getActiveTrips: () => Trip[];
  addFreight: (
    tripId: string,
    f: Omit<
      Freight,
      "id" | "tripId" | "commissionValue" | "status" | "estimatedDistance"
    >,
  ) => Promise<void>;
  updateFreight: (
    tripId: string,
    freightId: string,
    f: Omit<
      Freight,
      "id" | "tripId" | "commissionValue" | "status" | "estimatedDistance"
    >,
    options?: { forceRouteRefresh?: boolean; suppressSuccessToast?: boolean },
  ) => Promise<FreightUpdateResult>;
  deleteFreight: (tripId: string, freightId: string) => Promise<void>;
  startFreight: (tripId: string, freightId: string) => Promise<void>;
  completeFreight: (
    tripId: string,
    freightId: string,
    option?: "complete_only" | "start_next_if_planned",
  ) => Promise<{ promotedFreightId?: string | null }>;
  addFueling: (
    tripId: string,
    f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">,
  ) => Promise<void>;
  updateFueling: (
    tripId: string,
    fuelingId: string,
    f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">,
  ) => Promise<void>;
  deleteFueling: (tripId: string, fuelingId: string) => Promise<void>;
  addExpense: (
    tripId: string,
    e: Omit<Expense, "id" | "tripId">,
  ) => Promise<void>;
  updateExpense: (
    tripId: string,
    expenseId: string,
    e: Omit<Expense, "id" | "tripId">,
  ) => Promise<void>;
  deleteExpense: (tripId: string, expenseId: string) => Promise<void>;
  addPersonalExpense: (
    tripId: string,
    e: Omit<PersonalExpense, "id" | "tripId">,
  ) => Promise<void>;
  updatePersonalExpense: (
    tripId: string,
    id: string,
    e: Omit<PersonalExpense, "id" | "tripId">,
  ) => Promise<void>;
  deletePersonalExpense: (tripId: string, id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshData: () => Promise<void>;
  addMaintenanceService: (
    s: Omit<MaintenanceService, "id" | "createdAt">,
  ) => Promise<void>;
  deleteMaintenanceService: (id: string) => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};

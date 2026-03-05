import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AppData, Vehicle, Trip, Freight, Fueling, Expense, TripStatus, MaintenanceService, PersonalExpense } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getMaintenanceAlerts, checkAndNotifyMaintenance } from "@/lib/maintenance";
import { isOnline, addToOfflineQueue, getOfflineQueue, removeFromQueue, setCachedData, getCachedData } from "@/lib/offlineQueue";
import { toast } from "@/hooks/use-toast";

interface AppContextType {
  data: AppData;
  loading: boolean;
  personalExpensesEnabled: boolean;
  setPersonalExpensesEnabled: (v: boolean) => Promise<void>;
  addVehicle: (v: Omit<Vehicle, "id">) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  updateVehicleKm: (vehicleId: string, km: number) => Promise<void>;
  addTrip: (vehicleId: string) => Promise<Trip>;
  finishTrip: (id: string, arrivalKm?: number) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  getActiveTrip: () => Trip | undefined;
  addFreight: (tripId: string, f: Omit<Freight, "id" | "tripId" | "commissionValue">) => Promise<void>;
  deleteFreight: (tripId: string, freightId: string) => Promise<void>;
  addFueling: (tripId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => Promise<void>;
  updateFueling: (tripId: string, fuelingId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => Promise<void>;
  deleteFueling: (tripId: string, fuelingId: string) => Promise<void>;
  addExpense: (tripId: string, e: Omit<Expense, "id" | "tripId">) => Promise<void>;
  deleteExpense: (tripId: string, expenseId: string) => Promise<void>;
  addPersonalExpense: (tripId: string, e: Omit<PersonalExpense, "id" | "tripId">) => Promise<void>;
  deletePersonalExpense: (tripId: string, id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshData: () => Promise<void>;
  addMaintenanceService: (s: Omit<MaintenanceService, "id" | "createdAt">) => Promise<void>;
  deleteMaintenanceService: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};

async function calculateFuelingAverage(
  fuelings: Fueling[],
  freights: Freight[],
  fueling: { kmCurrent: number; liters: number; fullTank: boolean },
  fuelingIndex: number,
  tripVehicleId?: string
): Promise<number> {
  if (!fueling.fullTank || fueling.liters === 0) return 0;

  // Determine the trip's starting KM
  const freightKms = freights.map(f => f.kmInitial).filter(k => k > 0);
  const firstFuelingKm = fuelings.length > 0 ? fuelings[0].kmCurrent : fueling.kmCurrent;
  const tripStartKm = freightKms.length > 0 ? Math.min(...freightKms, firstFuelingKm) : firstFuelingKm;
  const isInitialFueling = fuelingIndex === 0 || fueling.kmCurrent === tripStartKm;

  if (isInitialFueling) {
    // Historical lookup: find last full_tank fueling for this vehicle
    if (tripVehicleId) {
      const { data: vehicleFuelings } = await supabase
        .from("fuelings")
        .select("km_current, trip_id")
        .eq("full_tank", true)
        .order("km_current", { ascending: false });
      const { data: vehicleTrips } = await supabase
        .from("trips")
        .select("id")
        .eq("vehicle_id", tripVehicleId);
      const vehicleTripIds = new Set((vehicleTrips || []).map(t => t.id));
      const historicFueling = (vehicleFuelings || [])
        .filter(f => vehicleTripIds.has(f.trip_id) && f.km_current < fueling.kmCurrent)
        .sort((a, b) => b.km_current - a.km_current)[0];

      if (historicFueling) {
        const distance = fueling.kmCurrent - historicFueling.km_current;
        if (distance > 0) return Math.round((distance / fueling.liters) * 100) / 100;
      }
    }
    return 0; // Marco Zero
  }

  // Normal calculation — exclude initial fueling liters
  let lastFullTankKm: number | null = null;
  let accumLiters = 0;
  for (let i = fuelingIndex - 1; i >= 0; i--) {
    const isThisInitial = fuelings[i].kmCurrent === tripStartKm;
    if (!isThisInitial) accumLiters += fuelings[i].liters;
    if (fuelings[i].fullTank) { lastFullTankKm = fuelings[i].kmCurrent; break; }
  }
  if (lastFullTankKm === null) return 0;
  const totalLiters = accumLiters + fueling.liters;
  const distance = fueling.kmCurrent - lastFullTankKm;
  if (totalLiters === 0 || distance <= 0) return 0;
  return Math.round((distance / totalLiters) * 100) / 100;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [data, setData] = useState<AppData>(() => getCachedData<AppData>() || { vehicles: [], trips: [], maintenanceServices: [] });
  const [loading, setLoading] = useState(true);
  const [personalExpensesEnabled, setPersonalExpensesEnabledState] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) {
      setData({ vehicles: [], trips: [], maintenanceServices: [] });
      setLoading(false);
      return;
    }

    if (!isOnline()) {
      const cached = getCachedData<AppData>();
      if (cached) setData(cached);
      setLoading(false);
      return;
    }

    try {
      const [vehiclesRes, tripsRes, freightsRes, fuelingsRes, expensesRes, maintRes, personalExpRes, profileRes] = await Promise.all([
        supabase.from("vehicles").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("trips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("freights").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("fuelings").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("expenses").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("maintenance_services").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("personal_expenses").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("profiles").select("personal_expenses_enabled").eq("user_id", user.id).single(),
      ]);

      if (profileRes.data) {
        setPersonalExpensesEnabledState((profileRes.data as any).personal_expenses_enabled || false);
      }

      const vehicles: Vehicle[] = (vehiclesRes.data || []).map((v: any) => ({
        id: v.id, brand: v.brand, model: v.model, year: v.year, plate: v.plate,
        isFleetOwner: v.is_fleet_owner, driverName: v.driver_name, currentKm: v.current_km || 0,
      }));

      const freightsMap = new Map<string, Freight[]>();
      (freightsRes.data || []).forEach((f: any) => {
        const freight: Freight = { id: f.id, tripId: f.trip_id, origin: f.origin, destination: f.destination,
          kmInitial: f.km_initial, grossValue: f.gross_value, commissionPercent: f.commission_percent,
          commissionValue: f.commission_value, createdAt: f.created_at };
        if (!freightsMap.has(f.trip_id)) freightsMap.set(f.trip_id, []);
        freightsMap.get(f.trip_id)!.push(freight);
      });

      const fuelingsMap = new Map<string, Fueling[]>();
      (fuelingsRes.data || []).forEach((f: any) => {
        const fueling: Fueling = { id: f.id, tripId: f.trip_id, stationName: f.station, totalValue: f.total_value,
          liters: f.liters, pricePerLiter: f.price_per_liter, kmCurrent: f.km_current, fullTank: f.full_tank,
          average: f.average, date: f.date, receiptUrl: f.receipt_url || undefined };
        if (!fuelingsMap.has(f.trip_id)) fuelingsMap.set(f.trip_id, []);
        fuelingsMap.get(f.trip_id)!.push(fueling);
      });

      const expensesMap = new Map<string, Expense[]>();
      (expensesRes.data || []).forEach((e: any) => {
        const expense: Expense = { id: e.id, tripId: e.trip_id, category: e.category,
          description: e.description, value: e.value, date: e.date, receiptUrl: e.receipt_url || undefined };
        if (!expensesMap.has(e.trip_id)) expensesMap.set(e.trip_id, []);
        expensesMap.get(e.trip_id)!.push(expense);
      });

      const personalExpMap = new Map<string, PersonalExpense[]>();
      (personalExpRes.data || []).forEach((pe: any) => {
        const item: PersonalExpense = { id: pe.id, tripId: pe.trip_id, category: pe.category,
          description: pe.description, value: pe.value, date: pe.date };
        if (!personalExpMap.has(pe.trip_id)) personalExpMap.set(pe.trip_id, []);
        personalExpMap.get(pe.trip_id)!.push(item);
      });

      const trips: Trip[] = (tripsRes.data || []).map((t: any) => ({
        id: t.id, vehicleId: t.vehicle_id, status: t.status as TripStatus,
        freights: freightsMap.get(t.id) || [], fuelings: fuelingsMap.get(t.id) || [],
        expenses: expensesMap.get(t.id) || [], personalExpenses: personalExpMap.get(t.id) || [],
        createdAt: t.created_at, finishedAt: t.finished_at,
        estimatedDistance: t.estimated_distance || 0,
      }));

      const maintenanceServices: MaintenanceService[] = (maintRes.data || []).map((s: any) => ({
        id: s.id, vehicleId: s.vehicle_id, serviceName: s.service_name,
        lastChangeKm: s.last_change_km, intervalKm: s.interval_km, createdAt: s.created_at,
      }));

      const appData = { vehicles, trips, maintenanceServices };
      setData(appData);
      setCachedData(appData);
    } catch (err) {
      console.error("Error fetching data:", err);
      const cached = getCachedData<AppData>();
      if (cached) setData(cached);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sync offline queue when coming back online
  useEffect(() => {
    const syncQueue = async () => {
      const queue = getOfflineQueue();
      if (queue.length === 0 || !user) return;

      for (const action of queue) {
        try {
          switch (action.type) {
            case "addExpense":
              await supabase.from("expenses").insert({ ...action.payload, user_id: user.id });
              break;
            case "addFueling":
              await supabase.from("fuelings").insert({ ...action.payload, user_id: user.id });
              break;
            case "addPersonalExpense":
              await supabase.from("personal_expenses").insert({ ...action.payload, user_id: user.id });
              break;
            case "finishTrip":
              await supabase.from("trips").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", action.payload.tripId);
              if (action.payload.arrivalKm) {
                await supabase.from("vehicles").update({ current_km: action.payload.arrivalKm }).eq("id", action.payload.vehicleId);
              }
              break;
          }
          removeFromQueue(action.id);
        } catch (err) {
          console.error("Failed to sync action:", action, err);
        }
      }
      toast({ title: "Dados sincronizados!", description: "Suas ações offline foram enviadas para a nuvem." });
      await fetchData();
    };

    const handleOnline = () => syncQueue();
    window.addEventListener("online", handleOnline);
    // Also try on mount
    if (isOnline()) syncQueue();
    return () => window.removeEventListener("online", handleOnline);
  }, [user, fetchData]);

  const setPersonalExpensesEnabled = useCallback(async (val: boolean) => {
    if (!user) return;
    setPersonalExpensesEnabledState(val);
    await supabase.from("profiles").update({ personal_expenses_enabled: val } as any).eq("user_id", user.id);
  }, [user]);

  const addVehicle = useCallback(async (v: Omit<Vehicle, "id">) => {
    if (!user) return;
    await supabase.from("vehicles").insert({
      user_id: user.id, brand: v.brand, model: v.model, year: v.year, plate: v.plate,
      is_fleet_owner: v.isFleetOwner || false, driver_name: v.driverName || null, current_km: v.currentKm || 0,
    });
    await fetchData();
  }, [user, fetchData]);

  const deleteVehicle = useCallback(async (id: string) => {
    await supabase.from("vehicles").delete().eq("id", id);
    await fetchData();
  }, [fetchData]);

  const updateVehicleKm = useCallback(async (vehicleId: string, km: number) => {
    const vehicle = data.vehicles.find(v => v.id === vehicleId);
    if (vehicle && km < vehicle.currentKm) return;
    await supabase.from("vehicles").update({ current_km: km }).eq("id", vehicleId);
    await fetchData();
    const updatedVehicles = data.vehicles.map(v => v.id === vehicleId ? { ...v, currentKm: km } : v);
    const alerts = getMaintenanceAlerts(updatedVehicles, data.maintenanceServices);
    if (alerts.length > 0) checkAndNotifyMaintenance(alerts);
  }, [data.vehicles, data.maintenanceServices, fetchData]);

  const addTrip = useCallback(async (vehicleId: string): Promise<Trip> => {
    if (!user) throw new Error("Not authenticated");
    const { data: inserted, error } = await supabase.from("trips").insert({
      user_id: user.id, vehicle_id: vehicleId, status: "open",
    }).select().single();
    if (error || !inserted) throw new Error(error?.message || "Failed to create trip");
    const trip: Trip = { id: inserted.id, vehicleId: inserted.vehicle_id, status: inserted.status as TripStatus,
      freights: [], fuelings: [], expenses: [], personalExpenses: [], createdAt: inserted.created_at, finishedAt: inserted.finished_at,
      estimatedDistance: (inserted as any).estimated_distance || 0 };
    await fetchData();
    return trip;
  }, [user, fetchData]);

  const finishTrip = useCallback(async (id: string, arrivalKm?: number) => {
    const trip = data.trips.find(t => t.id === id);

    if (!isOnline()) {
      addToOfflineQueue({ type: "finishTrip", payload: { tripId: id, arrivalKm, vehicleId: trip?.vehicleId } });
      toast({ title: "Salvo no celular", description: "Será enviado para a nuvem quando houver sinal." });
      return;
    }

    await supabase.from("trips").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", id);
    if (arrivalKm && trip) {
      await supabase.from("vehicles").update({ current_km: arrivalKm }).eq("id", trip.vehicleId);
    }
    await fetchData();
    if (arrivalKm && trip) {
      const updatedVehicles = data.vehicles.map(v => v.id === trip.vehicleId ? { ...v, currentKm: arrivalKm } : v);
      const alerts = getMaintenanceAlerts(updatedVehicles, data.maintenanceServices);
      if (alerts.length > 0) checkAndNotifyMaintenance(alerts);
    }
  }, [data.trips, data.vehicles, data.maintenanceServices, fetchData]);

  const deleteTrip = useCallback(async (id: string) => {
    await supabase.from("trips").delete().eq("id", id);
    await fetchData();
  }, [fetchData]);

  const getActiveTrip = useCallback(() => data.trips.find(t => t.status === "open"), [data.trips]);

  const addFreight = useCallback(async (tripId: string, f: Omit<Freight, "id" | "tripId" | "commissionValue">) => {
    if (!user) return;
    const commissionValue = f.grossValue * (f.commissionPercent / 100);
    await supabase.from("freights").insert({
      trip_id: tripId, user_id: user.id, origin: f.origin, destination: f.destination,
      km_initial: f.kmInitial, km_final: 0, gross_value: f.grossValue,
      commission_percent: f.commissionPercent, commission_value: commissionValue,
    });
    // Fetch fresh data first so we have updated freights list
    await fetchData();
    // Recalculate estimated distance from all freights of this trip (query DB directly)
    try {
      const { getRouteDistance } = await import("@/lib/routeApi");
      const { data: dbFreights } = await supabase.from("freights").select("origin, destination").eq("trip_id", tripId);
      const allFreights = dbFreights || [];
      const distances = await Promise.all(allFreights.map(fr => getRouteDistance(fr.origin, fr.destination)));
      const totalEstimated = distances.reduce((sum, d) => sum + (d || 0), 0);
      await supabase.from("trips").update({ estimated_distance: totalEstimated }).eq("id", tripId);
      await fetchData();
    } catch (err) {
      console.warn("Could not calculate estimated distance:", err);
    }
  }, [user, fetchData]);

  const deleteFreight = useCallback(async (tripId: string, freightId: string) => {
    await supabase.from("freights").delete().eq("id", freightId);
    // Recalculate estimated distance after deletion (query DB directly for fresh data)
    try {
      const { getRouteDistance } = await import("@/lib/routeApi");
      const { data: remaining } = await supabase.from("freights").select("origin, destination").eq("trip_id", tripId);
      if (!remaining || remaining.length === 0) {
        await supabase.from("trips").update({ estimated_distance: 0 }).eq("id", tripId);
      } else {
        const distances = await Promise.all(remaining.map(fr => getRouteDistance(fr.origin, fr.destination)));
        const total = distances.reduce((sum, d) => sum + (d || 0), 0);
        await supabase.from("trips").update({ estimated_distance: total }).eq("id", tripId);
      }
    } catch (err) {
      console.warn("Could not recalculate estimated distance:", err);
    }
    await fetchData();
  }, [fetchData]);

  const addFueling = useCallback(async (tripId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => {
    if (!user) return;

    if (!isOnline()) {
      const pricePerLiter = f.liters > 0 ? f.totalValue / f.liters : 0;
      addToOfflineQueue({ type: "addFueling", payload: {
        trip_id: tripId, station: f.stationName, total_value: f.totalValue,
        liters: f.liters, price_per_liter: Math.round(pricePerLiter * 100) / 100,
        km_current: f.kmCurrent, full_tank: f.fullTank, average: 0, date: f.date,
        receipt_url: f.receiptUrl || null,
      }});
      toast({ title: "Salvo no celular", description: "Será enviado para a nuvem quando houver sinal." });
      return;
    }

    const pricePerLiter = f.liters > 0 ? f.totalValue / f.liters : 0;
    const trip = data.trips.find(t => t.id === tripId);
    const fuelingIndex = trip ? trip.fuelings.length : 0;
    const average = trip ? await calculateFuelingAverage(trip.fuelings, trip.freights, f, fuelingIndex, trip.vehicleId) : 0;
    await supabase.from("fuelings").insert({
      trip_id: tripId, user_id: user.id, station: f.stationName, total_value: f.totalValue,
      liters: f.liters, price_per_liter: Math.round(pricePerLiter * 100) / 100,
      km_current: f.kmCurrent, full_tank: f.fullTank, average, date: f.date,
      receipt_url: f.receiptUrl || null,
    });
    if (trip) {
      await updateVehicleKm(trip.vehicleId, f.kmCurrent);
    }
    await fetchData();
  }, [user, data.trips, fetchData, updateVehicleKm]);

  const updateFueling = useCallback(async (tripId: string, fuelingId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => {
    const pricePerLiter = f.liters > 0 ? f.totalValue / f.liters : 0;
    const trip = data.trips.find(t => t.id === tripId);
    const fuelingIndex = trip ? trip.fuelings.findIndex(fu => fu.id === fuelingId) : -1;
    const average = trip && fuelingIndex >= 0 ? await calculateFuelingAverage(trip.fuelings, trip.freights, f, fuelingIndex, trip.vehicleId) : 0;
    await supabase.from("fuelings").update({
      station: f.stationName, total_value: f.totalValue, liters: f.liters,
      price_per_liter: Math.round(pricePerLiter * 100) / 100, km_current: f.kmCurrent,
      full_tank: f.fullTank, average, date: f.date, receipt_url: f.receiptUrl || null,
    }).eq("id", fuelingId);
    if (trip) await updateVehicleKm(trip.vehicleId, f.kmCurrent);
    else await fetchData();
  }, [data.trips, fetchData, updateVehicleKm]);

  const deleteFueling = useCallback(async (_tripId: string, fuelingId: string) => {
    await supabase.from("fuelings").delete().eq("id", fuelingId);
    await fetchData();
  }, [fetchData]);

  const addExpense = useCallback(async (tripId: string, e: Omit<Expense, "id" | "tripId">) => {
    if (!user) return;

    if (!isOnline()) {
      addToOfflineQueue({ type: "addExpense", payload: {
        trip_id: tripId, category: e.category, description: e.description,
        value: e.value, date: e.date, receipt_url: e.receiptUrl || null,
      }});
      toast({ title: "Salvo no celular", description: "Será enviado para a nuvem quando houver sinal." });
      return;
    }

    await supabase.from("expenses").insert({
      trip_id: tripId, user_id: user.id, category: e.category,
      description: e.description, value: e.value, date: e.date,
      receipt_url: e.receiptUrl || null,
    });
    await fetchData();
  }, [user, fetchData]);

  const deleteExpense = useCallback(async (_tripId: string, expenseId: string) => {
    await supabase.from("expenses").delete().eq("id", expenseId);
    await fetchData();
  }, [fetchData]);

  const addPersonalExpense = useCallback(async (tripId: string, e: Omit<PersonalExpense, "id" | "tripId">) => {
    if (!user) return;

    if (!isOnline()) {
      addToOfflineQueue({ type: "addPersonalExpense", payload: {
        trip_id: tripId, category: e.category, description: e.description,
        value: e.value, date: e.date,
      }});
      toast({ title: "Salvo no celular", description: "Será enviado para a nuvem quando houver sinal." });
      return;
    }

    await supabase.from("personal_expenses").insert({
      trip_id: tripId, user_id: user.id, category: e.category,
      description: e.description, value: e.value, date: e.date,
    });
    await fetchData();
  }, [user, fetchData]);

  const deletePersonalExpense = useCallback(async (_tripId: string, id: string) => {
    await supabase.from("personal_expenses").delete().eq("id", id);
    await fetchData();
  }, [fetchData]);

  const clearHistory = useCallback(async () => {
    const finishedTrips = data.trips.filter(t => t.status === "finished");
    for (const trip of finishedTrips) await supabase.from("trips").delete().eq("id", trip.id);
    await fetchData();
  }, [data.trips, fetchData]);

  const addMaintenanceService = useCallback(async (s: Omit<MaintenanceService, "id" | "createdAt">) => {
    if (!user) return;
    await supabase.from("maintenance_services").insert({
      user_id: user.id, vehicle_id: s.vehicleId, service_name: s.serviceName,
      last_change_km: s.lastChangeKm, interval_km: s.intervalKm,
    });
    await fetchData();
  }, [user, fetchData]);

  const deleteMaintenanceService = useCallback(async (id: string) => {
    await supabase.from("maintenance_services").delete().eq("id", id);
    await fetchData();
  }, [fetchData]);

  return (
    <AppContext.Provider value={{
      data, loading, personalExpensesEnabled, setPersonalExpensesEnabled,
      addVehicle, deleteVehicle, updateVehicleKm, addTrip, finishTrip, deleteTrip, getActiveTrip,
      addFreight, deleteFreight, addFueling, updateFueling, deleteFueling, addExpense, deleteExpense,
      addPersonalExpense, deletePersonalExpense,
      clearHistory, refreshData: fetchData, addMaintenanceService, deleteMaintenanceService,
    }}>
      {children}
    </AppContext.Provider>
  );
};

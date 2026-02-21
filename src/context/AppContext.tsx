import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AppData, Vehicle, Trip, Freight, Fueling, Expense, TripStatus } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface AppContextType {
  data: AppData;
  loading: boolean;
  addVehicle: (v: Omit<Vehicle, "id">) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  addTrip: (vehicleId: string) => Promise<Trip>;
  finishTrip: (id: string) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  getActiveTrip: () => Trip | undefined;
  addFreight: (tripId: string, f: Omit<Freight, "id" | "tripId" | "commissionValue">) => Promise<void>;
  deleteFreight: (tripId: string, freightId: string) => Promise<void>;
  addFueling: (tripId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => Promise<void>;
  updateFueling: (tripId: string, fuelingId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => Promise<void>;
  deleteFueling: (tripId: string, fuelingId: string) => Promise<void>;
  addExpense: (tripId: string, e: Omit<Expense, "id" | "tripId">) => Promise<void>;
  deleteExpense: (tripId: string, expenseId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};

function calculateFuelingAverage(
  fuelings: Fueling[],
  freights: Freight[],
  fueling: { kmCurrent: number; liters: number; fullTank: boolean },
  fuelingIndex: number
): number {
  if (!fueling.fullTank || fueling.liters === 0) return 0;

  let lastFullTankKm: number | null = null;
  let accumLiters = 0;

  for (let i = fuelingIndex - 1; i >= 0; i--) {
    accumLiters += fuelings[i].liters;
    if (fuelings[i].fullTank) {
      lastFullTankKm = fuelings[i].kmCurrent;
      break;
    }
  }

  if (lastFullTankKm === null) {
    const firstFreight = freights[0];
    if (firstFreight) {
      lastFullTankKm = firstFreight.kmInitial;
    } else {
      return 0;
    }
  }

  const totalLiters = accumLiters + fueling.liters;
  const distance = fueling.kmCurrent - lastFullTankKm;
  if (totalLiters === 0 || distance <= 0) return 0;
  return Math.round((distance / totalLiters) * 100) / 100;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [data, setData] = useState<AppData>({ vehicles: [], trips: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setData({ vehicles: [], trips: [] });
      setLoading(false);
      return;
    }

    try {
      const [vehiclesRes, tripsRes, freightsRes, fuelingsRes, expensesRes] = await Promise.all([
        supabase.from("vehicles").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("trips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("freights").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("fuelings").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("expenses").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      ]);

      const vehicles: Vehicle[] = (vehiclesRes.data || []).map((v: any) => ({
        id: v.id,
        brand: v.brand,
        model: v.model,
        year: v.year,
        plate: v.plate,
        isFleetOwner: v.is_fleet_owner,
        driverName: v.driver_name,
      }));

      const freightsMap = new Map<string, Freight[]>();
      (freightsRes.data || []).forEach((f: any) => {
        const freight: Freight = {
          id: f.id,
          tripId: f.trip_id,
          origin: f.origin,
          destination: f.destination,
          kmInitial: f.km_initial,
          grossValue: f.gross_value,
          commissionPercent: f.commission_percent,
          commissionValue: f.commission_value,
          createdAt: f.created_at,
        };
        if (!freightsMap.has(f.trip_id)) freightsMap.set(f.trip_id, []);
        freightsMap.get(f.trip_id)!.push(freight);
      });

      const fuelingsMap = new Map<string, Fueling[]>();
      (fuelingsRes.data || []).forEach((f: any) => {
        const fueling: Fueling = {
          id: f.id,
          tripId: f.trip_id,
          stationName: f.station,
          totalValue: f.total_value,
          liters: f.liters,
          pricePerLiter: f.price_per_liter,
          kmCurrent: f.km_current,
          fullTank: f.full_tank,
          average: f.average,
          date: f.date,
        };
        if (!fuelingsMap.has(f.trip_id)) fuelingsMap.set(f.trip_id, []);
        fuelingsMap.get(f.trip_id)!.push(fueling);
      });

      const expensesMap = new Map<string, Expense[]>();
      (expensesRes.data || []).forEach((e: any) => {
        const expense: Expense = {
          id: e.id,
          tripId: e.trip_id,
          category: e.category,
          description: e.description,
          value: e.value,
          date: e.date,
        };
        if (!expensesMap.has(e.trip_id)) expensesMap.set(e.trip_id, []);
        expensesMap.get(e.trip_id)!.push(expense);
      });

      const trips: Trip[] = (tripsRes.data || []).map((t: any) => ({
        id: t.id,
        vehicleId: t.vehicle_id,
        status: t.status as TripStatus,
        freights: freightsMap.get(t.id) || [],
        fuelings: fuelingsMap.get(t.id) || [],
        expenses: expensesMap.get(t.id) || [],
        createdAt: t.created_at,
        finishedAt: t.finished_at,
      }));

      setData({ vehicles, trips });
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addVehicle = useCallback(async (v: Omit<Vehicle, "id">) => {
    if (!user) return;
    await supabase.from("vehicles").insert({
      user_id: user.id,
      brand: v.brand,
      model: v.model,
      year: v.year,
      plate: v.plate,
      is_fleet_owner: v.isFleetOwner || false,
      driver_name: v.driverName || null,
    });
    await fetchData();
  }, [user, fetchData]);

  const deleteVehicle = useCallback(async (id: string) => {
    await supabase.from("vehicles").delete().eq("id", id);
    await fetchData();
  }, [fetchData]);

  const addTrip = useCallback(async (vehicleId: string): Promise<Trip> => {
    if (!user) throw new Error("Not authenticated");
    const { data: inserted, error } = await supabase.from("trips").insert({
      user_id: user.id,
      vehicle_id: vehicleId,
      status: "open",
    }).select().single();

    if (error || !inserted) throw new Error(error?.message || "Failed to create trip");

    const trip: Trip = {
      id: inserted.id,
      vehicleId: inserted.vehicle_id,
      status: inserted.status as TripStatus,
      freights: [],
      fuelings: [],
      expenses: [],
      createdAt: inserted.created_at,
      finishedAt: inserted.finished_at,
    };
    await fetchData();
    return trip;
  }, [user, fetchData]);

  const finishTrip = useCallback(async (id: string) => {
    await supabase.from("trips").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", id);
    await fetchData();
  }, [fetchData]);

  const deleteTrip = useCallback(async (id: string) => {
    await supabase.from("trips").delete().eq("id", id);
    await fetchData();
  }, [fetchData]);

  const getActiveTrip = useCallback(() => {
    return data.trips.find((t) => t.status === "open");
  }, [data.trips]);

  const addFreight = useCallback(async (tripId: string, f: Omit<Freight, "id" | "tripId" | "commissionValue">) => {
    if (!user) return;
    const commissionValue = f.grossValue * (f.commissionPercent / 100);
    await supabase.from("freights").insert({
      trip_id: tripId,
      user_id: user.id,
      origin: f.origin,
      destination: f.destination,
      km_initial: f.kmInitial,
      km_final: 0,
      gross_value: f.grossValue,
      commission_percent: f.commissionPercent,
      commission_value: commissionValue,
    });
    await fetchData();
  }, [user, fetchData]);

  const deleteFreight = useCallback(async (_tripId: string, freightId: string) => {
    await supabase.from("freights").delete().eq("id", freightId);
    await fetchData();
  }, [fetchData]);

  const addFueling = useCallback(async (tripId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => {
    if (!user) return;
    const pricePerLiter = f.liters > 0 ? f.totalValue / f.liters : 0;

    const trip = data.trips.find((t) => t.id === tripId);
    const fuelingIndex = trip ? trip.fuelings.length : 0;
    const average = trip ? calculateFuelingAverage(trip.fuelings, trip.freights, f, fuelingIndex) : 0;

    await supabase.from("fuelings").insert({
      trip_id: tripId,
      user_id: user.id,
      station: f.stationName,
      total_value: f.totalValue,
      liters: f.liters,
      price_per_liter: Math.round(pricePerLiter * 100) / 100,
      km_current: f.kmCurrent,
      full_tank: f.fullTank,
      average,
      date: f.date,
    });
    await fetchData();
  }, [user, data.trips, fetchData]);

  const updateFueling = useCallback(async (tripId: string, fuelingId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => {
    const pricePerLiter = f.liters > 0 ? f.totalValue / f.liters : 0;

    const trip = data.trips.find((t) => t.id === tripId);
    const fuelingIndex = trip ? trip.fuelings.findIndex((fu) => fu.id === fuelingId) : -1;
    const average = trip && fuelingIndex >= 0 ? calculateFuelingAverage(trip.fuelings, trip.freights, f, fuelingIndex) : 0;

    await supabase.from("fuelings").update({
      station: f.stationName,
      total_value: f.totalValue,
      liters: f.liters,
      price_per_liter: Math.round(pricePerLiter * 100) / 100,
      km_current: f.kmCurrent,
      full_tank: f.fullTank,
      average,
      date: f.date,
    }).eq("id", fuelingId);
    await fetchData();
  }, [data.trips, fetchData]);

  const deleteFueling = useCallback(async (_tripId: string, fuelingId: string) => {
    await supabase.from("fuelings").delete().eq("id", fuelingId);
    await fetchData();
  }, [fetchData]);

  const addExpense = useCallback(async (tripId: string, e: Omit<Expense, "id" | "tripId">) => {
    if (!user) return;
    await supabase.from("expenses").insert({
      trip_id: tripId,
      user_id: user.id,
      category: e.category,
      description: e.description,
      value: e.value,
      date: e.date,
    });
    await fetchData();
  }, [user, fetchData]);

  const deleteExpense = useCallback(async (_tripId: string, expenseId: string) => {
    await supabase.from("expenses").delete().eq("id", expenseId);
    await fetchData();
  }, [fetchData]);

  const clearHistory = useCallback(async () => {
    const finishedTrips = data.trips.filter((t) => t.status === "finished");
    for (const trip of finishedTrips) {
      await supabase.from("trips").delete().eq("id", trip.id);
    }
    await fetchData();
  }, [data.trips, fetchData]);

  return (
    <AppContext.Provider value={{
      data, loading, addVehicle, deleteVehicle, addTrip, finishTrip, deleteTrip, getActiveTrip,
      addFreight, deleteFreight, addFueling, updateFueling, deleteFueling, addExpense, deleteExpense,
      clearHistory, refreshData: fetchData,
    }}>
      {children}
    </AppContext.Provider>
  );
};

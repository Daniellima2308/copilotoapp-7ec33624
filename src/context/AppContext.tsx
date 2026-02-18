import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AppData, Vehicle, Trip, Freight, Fueling, Expense, TripStatus } from "@/types";
import { loadData, saveData, generateId } from "@/lib/storage";

interface AppContextType {
  data: AppData;
  // Vehicles
  addVehicle: (v: Omit<Vehicle, "id">) => void;
  deleteVehicle: (id: string) => void;
  // Trips
  addTrip: (vehicleId: string) => Trip;
  finishTrip: (id: string) => void;
  deleteTrip: (id: string) => void;
  getActiveTrip: () => Trip | undefined;
  // Freights
  addFreight: (tripId: string, f: Omit<Freight, "id" | "tripId" | "commissionValue">) => void;
  deleteFreight: (tripId: string, freightId: string) => void;
  // Fuelings
  addFueling: (tripId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => void;
  updateFueling: (tripId: string, fuelingId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => void;
  deleteFueling: (tripId: string, fuelingId: string) => void;
  // Expenses
  addExpense: (tripId: string, e: Omit<Expense, "id" | "tripId">) => void;
  deleteExpense: (tripId: string, expenseId: string) => void;
  clearHistory: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const updateData = useCallback((fn: (d: AppData) => AppData) => {
    setData((prev) => fn(prev));
  }, []);

  const updateTrip = useCallback((tripId: string, fn: (t: Trip) => Trip) => {
    updateData((d) => ({
      ...d,
      trips: d.trips.map((t) => (t.id === tripId ? fn(t) : t)),
    }));
  }, [updateData]);

  const addVehicle = useCallback((v: Omit<Vehicle, "id">) => {
    updateData((d) => ({ ...d, vehicles: [...d.vehicles, { ...v, id: generateId() }] }));
  }, [updateData]);

  const deleteVehicle = useCallback((id: string) => {
    updateData((d) => ({ ...d, vehicles: d.vehicles.filter((v) => v.id !== id) }));
  }, [updateData]);

  const addTrip = useCallback((vehicleId: string): Trip => {
    const trip: Trip = {
      id: generateId(),
      vehicleId,
      status: "open",
      freights: [],
      fuelings: [],
      expenses: [],
      createdAt: new Date().toISOString(),
    };
    updateData((d) => ({ ...d, trips: [trip, ...d.trips] }));
    return trip;
  }, [updateData]);

  const finishTrip = useCallback((id: string) => {
    updateTrip(id, (t) => ({ ...t, status: "finished" as TripStatus, finishedAt: new Date().toISOString() }));
  }, [updateTrip]);

  const deleteTrip = useCallback((id: string) => {
    updateData((d) => ({ ...d, trips: d.trips.filter((t) => t.id !== id) }));
  }, [updateData]);

  const getActiveTrip = useCallback(() => {
    return data.trips.find((t) => t.status === "open");
  }, [data.trips]);

  const addFreight = useCallback((tripId: string, f: Omit<Freight, "id" | "tripId" | "commissionValue">) => {
    const commissionValue = f.grossValue * (f.commissionPercent / 100);
    updateTrip(tripId, (t) => ({
      ...t,
      freights: [...t.freights, { ...f, id: generateId(), tripId, commissionValue }],
    }));
  }, [updateTrip]);

  const deleteFreight = useCallback((tripId: string, freightId: string) => {
    updateTrip(tripId, (t) => ({
      ...t,
      freights: t.freights.filter((f) => f.id !== freightId),
    }));
  }, [updateTrip]);

  const addFueling = useCallback((tripId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => {
    const pricePerLiter = f.liters > 0 ? f.totalValue / f.liters : 0;
    
    updateData((d) => {
      const trip = d.trips.find((t) => t.id === tripId);
      if (!trip) return d;

      let average = 0;
      if (trip.fuelings.length === 0) {
        // First fueling: use trip's first freight KM initial
        const firstFreight = trip.freights[0];
        if (firstFreight && f.liters > 0) {
          average = (f.kmCurrent - firstFreight.kmInitial) / f.liters;
        }
      } else {
        const lastFueling = trip.fuelings[trip.fuelings.length - 1];
        if (f.liters > 0) {
          average = (f.kmCurrent - lastFueling.kmCurrent) / f.liters;
        }
      }

      const newFueling: Fueling = {
        ...f,
        id: generateId(),
        tripId,
        pricePerLiter: Math.round(pricePerLiter * 100) / 100,
        average: Math.round(average * 100) / 100,
      };

      return {
        ...d,
        trips: d.trips.map((t) =>
          t.id === tripId ? { ...t, fuelings: [...t.fuelings, newFueling] } : t
        ),
      };
    });
  }, [updateData]);

  const updateFueling = useCallback((tripId: string, fuelingId: string, f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">) => {
    const pricePerLiter = f.liters > 0 ? f.totalValue / f.liters : 0;

    updateData((d) => {
      const trip = d.trips.find((t) => t.id === tripId);
      if (!trip) return d;

      const fuelingIndex = trip.fuelings.findIndex((fu) => fu.id === fuelingId);
      if (fuelingIndex === -1) return d;

      let average = 0;
      if (fuelingIndex === 0) {
        const firstFreight = trip.freights[0];
        if (firstFreight && f.liters > 0) {
          average = (f.kmCurrent - firstFreight.kmInitial) / f.liters;
        }
      } else {
        const prevFueling = trip.fuelings[fuelingIndex - 1];
        if (f.liters > 0) {
          average = (f.kmCurrent - prevFueling.kmCurrent) / f.liters;
        }
      }

      const updated: Fueling = {
        ...f,
        id: fuelingId,
        tripId,
        pricePerLiter: Math.round(pricePerLiter * 100) / 100,
        average: Math.round(average * 100) / 100,
      };

      return {
        ...d,
        trips: d.trips.map((t) =>
          t.id === tripId
            ? { ...t, fuelings: t.fuelings.map((fu) => (fu.id === fuelingId ? updated : fu)) }
            : t
        ),
      };
    });
  }, [updateData]);

  const deleteFueling = useCallback((tripId: string, fuelingId: string) => {
    updateTrip(tripId, (t) => ({
      ...t,
      fuelings: t.fuelings.filter((f) => f.id !== fuelingId),
    }));
  }, [updateTrip]);

  const addExpense = useCallback((tripId: string, e: Omit<Expense, "id" | "tripId">) => {
    updateTrip(tripId, (t) => ({
      ...t,
      expenses: [...t.expenses, { ...e, id: generateId(), tripId }],
    }));
  }, [updateTrip]);

  const deleteExpense = useCallback((tripId: string, expenseId: string) => {
    updateTrip(tripId, (t) => ({
      ...t,
      expenses: t.expenses.filter((e) => e.id !== expenseId),
    }));
  }, [updateTrip]);

  const clearHistory = useCallback(() => {
    updateData((d) => ({
      ...d,
      trips: d.trips.filter((t) => t.status === "open"),
    }));
  }, [updateData]);

  return (
    <AppContext.Provider
      value={{
        data,
        addVehicle,
        deleteVehicle,
        addTrip,
        finishTrip,
        deleteTrip,
        getActiveTrip,
        addFreight,
        deleteFreight,
        addFueling,
        updateFueling,
        deleteFueling,
        addExpense,
        deleteExpense,
        clearHistory,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

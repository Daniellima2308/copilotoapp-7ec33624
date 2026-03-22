import React, { useState, useCallback, useEffect } from "react";
import {
  AppData,
  Vehicle,
  Trip,
  Freight,
  Fueling,
  Expense,
  TripStatus,
  MaintenanceService,
  PersonalExpense,
  VehicleOperationProfile,
  DriverBond,
  FreightStatus,
  ExpenseCategory,
  PersonalExpenseCategory,
} from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import {
  getMaintenanceAlerts,
  checkAndNotifyMaintenance,
} from "@/lib/maintenance";
import {
  isOnline,
  addToOfflineQueue,
  getOfflineQueue,
  removeFromQueue,
  setCachedData,
  getCachedData,
} from "@/lib/offlineQueue";
import { toast } from "@/hooks/use-toast";
import { AppContext, StartFreightResult } from "@/context/app-context";
import {
  getKmBounds,
  getNumericWarnings,
  validateKmByContext,
  validatePercent,
  validatePositiveNumber,
} from "@/lib/fieldValidation";
import {
  isDriverBond,
  isVehicleOperationProfile,
  normalizeVehicleProfileForPersistence,
  normalizeVehicleProfileUpdateForPersistence,
} from "@/lib/vehicleOperation";
import {
  getFreightStatusForInsert,
  normalizeTripFreights,
} from "@/lib/freightStatus";
import {
  buildFuelingFinancialPlan,
  buildTripStartKmMap,
  calculateFuelingPricePerLiter,
  getFuelingOriginalTotalValue,
  sortFuelingsByTimeline,
} from "@/lib/fueling";

const round2 = (value: number) => Math.round(value * 100) / 100;

function getTripMaxRealKm(trip: Trip | undefined, vehicleCurrentKm = 0) {
  if (!trip) return vehicleCurrentKm;

  return Math.max(
    vehicleCurrentKm,
    ...trip.fuelings.map((fueling) => fueling.kmCurrent || 0),
    ...trip.freights
      .filter((freight) => freight.status === "in_progress" || freight.status === "completed")
      .map((freight) => freight.kmInitial || 0),
  );
}

function getTripStartKm(trip: Trip | undefined) {
  if (!trip) return null;

  const checkpoints = [
    ...trip.fuelings.map((fueling) => fueling.kmCurrent),
    ...trip.freights
      .filter((freight) => freight.status === "in_progress" || freight.status === "completed")
      .map((freight) => freight.kmInitial),
  ].filter((km): km is number => Number.isFinite(km) && km >= 0);

  if (checkpoints.length === 0) return null;
  return Math.min(...checkpoints);
}

function getTripPendingPlannedFreights(trip: Trip | undefined) {
  return (trip?.freights || []).filter((freight) => freight.status === "planned");
}

function showActionSuccess(title: string, description?: string) {
  toast({ title, description });
}

function showActionNotice(title: string, description?: string) {
  toast({
    title,
    description,
    variant: "notice",
  });
}

function showActionError(title: string, description?: string) {
  toast({
    title,
    description: description || "Tenta novamente.",
    variant: "destructive",
  });
}

function showOfflineSaved(title: string) {
  showActionNotice(
    title,
    "Salvo no celular. Quando houver sinal, o app envia para a nuvem.",
  );
}

function buildRouteFailureDetails(params: {
  reason: string | null;
}): string {
  return (
    params.reason ||
    "A rota foi salva, mas a previsão ainda não foi liberada."
  );
}

function buildOfflineSyncRouteToast(
  routeSyncFailures: string[],
): { title: string; description: string } | null {
  if (routeSyncFailures.length === 0) return null;
  if (routeSyncFailures.length === 1) {
    return {
      title: "Sincronização parcial",
      description:
        "Um frete foi salvo, mas a previsão da rota ainda está em ajuste.",
    };
  }

  return {
    title: "Sincronização parcial",
    description: `${routeSyncFailures.length} fretes foram salvos e ainda têm rota em ajuste.`,
  };
}

interface FreightRouteResolution {
  estimatedDistance: number;
  diagnostic: {
    distanceKm: number | null;
    reason: string | null;
    originQueryUsed?: string;
    destinationQueryUsed?: string;
    source?: "cache" | "provider";
  };
}

async function resolveFreightEstimatedDistance(params: {
  userId: string;
  origin: string;
  destination: string;
}): Promise<FreightRouteResolution> {
  const { getRouteDistanceDiagnosticWithCache } =
    await import("@/lib/routeApi");
  const diagnostic = await getRouteDistanceDiagnosticWithCache({
    origin: params.origin,
    destination: params.destination,
    userId: params.userId,
  });

  return {
    estimatedDistance:
      diagnostic.distanceKm && diagnostic.distanceKm > 0
        ? diagnostic.distanceKm
        : 0,
    diagnostic,
  };
}

async function refreshFreightEstimatedDistance(params: {
  userId: string;
  origin: string;
  destination: string;
}): Promise<FreightRouteResolution> {
  const { refreshRouteDistanceCache } = await import("@/lib/routeApi");
  const diagnostic = await refreshRouteDistanceCache({
    origin: params.origin,
    destination: params.destination,
    userId: params.userId,
  });

  return {
    estimatedDistance:
      diagnostic.distanceKm && diagnostic.distanceKm > 0
        ? diagnostic.distanceKm
        : 0,
    diagnostic,
  };
}

async function updateTripEstimatedDistanceBySum(tripId: string): Promise<void> {
  const { data: dbFreights, error: freightsError } = await supabase
    .from("freights")
    .select("estimated_distance")
    .eq("trip_id", tripId);

  if (freightsError) {
    throw new Error(
      freightsError.message ||
        "Falha ao carregar fretes para somar distância estimada.",
    );
  }

  const totalEstimated = (dbFreights || []).reduce(
    (sum, freight) => sum + (freight.estimated_distance || 0),
    0,
  );

  const { error: tripUpdateError } = await supabase
    .from("trips")
    .update({ estimated_distance: totalEstimated })
    .eq("id", tripId);

  if (tripUpdateError) {
    throw new Error(
      tripUpdateError.message ||
        "Falha ao salvar distância estimada da viagem.",
    );
  }
}

async function ensureMutation<T extends { message?: string } | null>(
  mutation: Promise<{ data: unknown; error: T }>,
  fallbackMessage: string,
) {
  const result = await mutation;
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }

  return result;
}

interface VehicleFuelingSnapshot {
  trips: Trip[];
  tripIds: string[];
  fuelings: Array<{
    id: string;
    trip_id: string;
    station: string;
    total_value: number;
    liters: number;
    km_current: number;
    full_tank: boolean | null;
    date: string;
    receipt_url: string | null;
    original_total_value: number | null;
  }>;
}

async function getVehicleFuelingSnapshot(vehicleId: string): Promise<VehicleFuelingSnapshot> {
  const { data: vehicleTrips, error: tripsError } = await supabase
    .from("trips")
    .select("id,status,created_at,finished_at,estimated_distance")
    .eq("vehicle_id", vehicleId);

  if (tripsError) {
    throw new Error(tripsError.message || "Falha ao carregar viagens do veículo.");
  }

  const tripIds = (vehicleTrips || []).map((trip) => trip.id);
  if (tripIds.length === 0) {
    return { trips: [], tripIds: [], fuelings: [] };
  }

  const [{ data: freights, error: freightsError }, { data: fuelings, error: fuelingsError }] =
    await Promise.all([
      supabase
        .from("freights")
        .select("id,trip_id,origin,destination,km_initial,gross_value,commission_percent,commission_value,status,estimated_distance,created_at")
        .in("trip_id", tripIds),
      supabase
        .from("fuelings")
        .select("id,trip_id,station,total_value,liters,km_current,full_tank,date,receipt_url,original_total_value")
        .in("trip_id", tripIds),
    ]);

  if (freightsError) {
    throw new Error(freightsError.message || "Falha ao carregar fretes para revisar combustível.");
  }

  if (fuelingsError) {
    throw new Error(fuelingsError.message || "Falha ao carregar abastecimentos do veículo.");
  }

  const freightsByTrip = new Map<string, Freight[]>();
  (freights || []).forEach((freight) => {
    const normalized: Freight = {
      id: freight.id,
      tripId: freight.trip_id,
      origin: freight.origin,
      destination: freight.destination,
      kmInitial: freight.km_initial,
      grossValue: freight.gross_value,
      commissionPercent: freight.commission_percent,
      commissionValue: freight.commission_value,
      status: (freight.status || "planned") as FreightStatus,
      estimatedDistance: freight.estimated_distance || 0,
      createdAt: freight.created_at,
    };

    if (!freightsByTrip.has(freight.trip_id)) freightsByTrip.set(freight.trip_id, []);
    freightsByTrip.get(freight.trip_id)!.push(normalized);
  });

  const fuelingsByTrip = new Map<string, Fueling[]>();
  (fuelings || []).forEach((fueling) => {
    const normalized: Fueling = {
      id: fueling.id,
      tripId: fueling.trip_id,
      stationName: fueling.station,
      totalValue: fueling.total_value,
      liters: fueling.liters,
      pricePerLiter: 0,
      kmCurrent: fueling.km_current,
      fullTank: fueling.full_tank ?? true,
      average: 0,
      date: fueling.date,
      receiptUrl: fueling.receipt_url || undefined,
      originalTotalValue: fueling.original_total_value ?? undefined,
    };

    if (!fuelingsByTrip.has(fueling.trip_id)) fuelingsByTrip.set(fueling.trip_id, []);
    fuelingsByTrip.get(fueling.trip_id)!.push(normalized);
  });

  const trips: Trip[] = (vehicleTrips || []).map((trip) => ({
    id: trip.id,
    vehicleId,
    status: trip.status as TripStatus,
    freights: normalizeTripFreights(freightsByTrip.get(trip.id) || []),
    fuelings: fuelingsByTrip.get(trip.id) || [],
    expenses: [],
    personalExpenses: [],
    createdAt: trip.created_at,
    finishedAt: trip.finished_at,
    estimatedDistance: trip.estimated_distance || 0,
  }));

  return {
    trips,
    tripIds,
    fuelings: fuelings || [],
  };
}

function getFreightCreationFeedback(status: FreightStatus) {
  if (status === "in_progress") {
    return {
      title: "Frete iniciado",
      description: "Este trecho já virou o trecho atual da viagem.",
      variant: "success" as const,
    };
  }

  return {
    title: "Próximo frete adicionado",
    description: "Trecho salvo e aguardando início.",
    variant: "notice" as const,
  };
}

function getVehicleCurrentKmFromSources(params: {
  freightKms: Array<number | null | undefined>;
  fuelingKms: Array<number | null | undefined>;
}) {
  const validFreightKms = params.freightKms.filter(
    (km): km is number => typeof km === "number" && Number.isFinite(km) && km > 0,
  );
  const validFuelingKms = params.fuelingKms.filter(
    (km): km is number => typeof km === "number" && Number.isFinite(km) && km > 0,
  );
  const maxKm = Math.max(0, ...validFreightKms, ...validFuelingKms);

  return {
    maxKm,
    hasKmRecords: validFreightKms.length > 0 || validFuelingKms.length > 0,
  };
}

async function recalculateVehicleKm(vehicleId: string) {
  const { data: vehicleTrips } = await supabase
    .from("trips")
    .select("id")
    .eq("vehicle_id", vehicleId);
  const tripIds = (vehicleTrips || []).map((t) => t.id);

  if (tripIds.length === 0) {
    return;
  }

  const [{ data: fuelings }, { data: freights }] = await Promise.all([
    supabase.from("fuelings").select("km_current").in("trip_id", tripIds),
    supabase
      .from("freights")
      .select("km_initial,status")
      .in("trip_id", tripIds)
      .in("status", ["in_progress", "completed"]),
  ]);

  const { maxKm, hasKmRecords } = getVehicleCurrentKmFromSources({
    fuelingKms: (fuelings || []).map((fueling) => fueling.km_current),
    freightKms: (freights || []).map((freight) => freight.km_initial),
  });

  if (hasKmRecords) {
    await supabase
      .from("vehicles")
      .update({ current_km: maxKm })
      .eq("id", vehicleId);
  }
}

async function getVehicleTimelineKms(
  vehicleId: string,
  exclude?: { fuelingId?: string; freightId?: string },
) {
  const { data: vehicleTrips } = await supabase
    .from("trips")
    .select("id")
    .eq("vehicle_id", vehicleId);

  const tripIds = (vehicleTrips || []).map((t) => t.id);
  if (tripIds.length === 0) return [];

  const [{ data: fuelings }, { data: freights }] = await Promise.all([
    supabase.from("fuelings").select("id,km_current").in("trip_id", tripIds),
    supabase.from("freights").select("id,km_initial").in("trip_id", tripIds),
  ]);

  const fuelingKms = (fuelings || [])
    .filter((f) => !exclude?.fuelingId || f.id !== exclude.fuelingId)
    .map((f) => f.km_current);

  const freightKms = (freights || [])
    .filter((f) => !exclude?.freightId || f.id !== exclude.freightId)
    .map((f) => f.km_initial);

  return getKmBounds([...fuelingKms, ...freightKms]);
}

function showWarnings(warnings: string[]) {
  warnings.forEach((warning) => {
    toast({ title: "Confere esse número rapidinho", description: warning });
  });
}

async function reprocessVehicleFuelings(params: {
  userId: string;
  vehicleId: string;
}) {
  const snapshot = await getVehicleFuelingSnapshot(params.vehicleId);
  if (snapshot.tripIds.length === 0) return;

  const tripStartKmMap = buildTripStartKmMap(snapshot.trips);
  const financialPlan = buildFuelingFinancialPlan({
    fuelings: snapshot.fuelings.map((fueling) => ({
      id: fueling.id,
      tripId: fueling.trip_id,
      stationName: fueling.station,
      totalValue: getFuelingOriginalTotalValue({
        totalValue: fueling.total_value,
        originalTotalValue: fueling.original_total_value,
      }),
      liters: fueling.liters,
      kmCurrent: fueling.km_current,
      fullTank: fueling.full_tank ?? true,
      date: fueling.date,
      receiptUrl: fueling.receipt_url,
      originalTotalValue: fueling.original_total_value,
    })),
    tripStartKmMap,
  });

  const fuelingIds = snapshot.fuelings.map((fueling) => fueling.id);
  if (fuelingIds.length > 0) {
    await ensureMutation(
      supabase.from("expenses").delete().in("source_fueling_id", fuelingIds),
      "Falha ao limpar rateios anteriores do combustível.",
    );
  }

  for (const computed of financialPlan) {
    await ensureMutation(
      supabase
        .from("fuelings")
        .update({
          total_value: computed.effectiveTripValue,
          price_per_liter: computed.pricePerLiter,
          average: computed.average,
          allocated_value: computed.allocatedValue,
          original_total_value: computed.originalTotalValue,
        })
        .eq("id", computed.id),
      "Falha ao recalcular um abastecimento do veículo.",
    );
  }

  const rateioExpenses = financialPlan.flatMap((computed) =>
    computed.rateioExpenses.map((expense) => ({
      trip_id: expense.tripId,
      user_id: params.userId,
      category: "combustivel_rateio",
      description: expense.description,
      value: expense.value,
      date: expense.date,
      source_fueling_id: expense.sourceFuelingId,
    })),
  );

  if (rateioExpenses.length > 0) {
    await ensureMutation(
      supabase.from("expenses").insert(rateioExpenses),
      "Falha ao recriar os rateios do combustível.",
    );
  }
}

interface FuelingInputData {
  stationName: string;
  totalValue: number;
  liters: number;
  kmCurrent: number;
  date: string;
  fullTank: boolean;
  receiptUrl?: string;
}

async function getTripVehicleId(tripId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select("vehicle_id")
    .eq("id", tripId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Falha ao localizar o veículo da viagem.");
  }

  if (!data?.vehicle_id) {
    throw new Error("Viagem não encontrada para este abastecimento.");
  }

  return data.vehicle_id as string;
}

async function persistFuelingAdd(params: {
  userId: string;
  tripId: string;
  fuelingId: string;
  fueling: FuelingInputData;
}) {
  const originalTotalValue = round2(params.fueling.totalValue);
  const vehicleId = await getTripVehicleId(params.tripId);

  await ensureMutation(
    supabase.from("fuelings").insert({
      id: params.fuelingId,
      trip_id: params.tripId,
      user_id: params.userId,
      station: params.fueling.stationName,
      total_value: originalTotalValue,
      liters: params.fueling.liters,
      price_per_liter: calculateFuelingPricePerLiter(
        originalTotalValue,
        params.fueling.liters,
      ),
      km_current: params.fueling.kmCurrent,
      full_tank: params.fueling.fullTank,
      average: 0,
      date: params.fueling.date,
      receipt_url: params.fueling.receiptUrl || null,
      allocated_value: null,
      original_total_value: null,
    }),
    "Falha ao salvar o abastecimento.",
  );

  await reprocessVehicleFuelings({ userId: params.userId, vehicleId });
  await recalculateVehicleKm(vehicleId);
}

async function persistFuelingUpdate(params: {
  userId: string;
  tripId: string;
  fuelingId: string;
  fueling: FuelingInputData;
}) {
  const vehicleId = await getTripVehicleId(params.tripId);
  const originalTotalValue = round2(params.fueling.totalValue);

  await ensureMutation(
    supabase
      .from("fuelings")
      .update({
        station: params.fueling.stationName,
        total_value: originalTotalValue,
        liters: params.fueling.liters,
        price_per_liter: calculateFuelingPricePerLiter(
          originalTotalValue,
          params.fueling.liters,
        ),
        km_current: params.fueling.kmCurrent,
        full_tank: params.fueling.fullTank,
        average: 0,
        date: params.fueling.date,
        receipt_url: params.fueling.receiptUrl || null,
        allocated_value: null,
        original_total_value: null,
      })
      .eq("id", params.fuelingId),
    "Falha ao atualizar o abastecimento.",
  );

  await reprocessVehicleFuelings({ userId: params.userId, vehicleId });
  await recalculateVehicleKm(vehicleId);
}

async function persistFuelingDelete(params: {
  userId: string;
  tripId: string;
  fuelingId: string;
}) {
  const vehicleId = await getTripVehicleId(params.tripId);

  await ensureMutation(
    supabase.from("expenses").delete().eq("source_fueling_id", params.fuelingId),
    "Falha ao limpar rateios ligados a este abastecimento.",
  );
  await ensureMutation(
    supabase.from("fuelings").delete().eq("id", params.fuelingId),
    "Falha ao excluir o abastecimento.",
  );

  await reprocessVehicleFuelings({ userId: params.userId, vehicleId });
  await recalculateVehicleKm(vehicleId);
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [data, setData] = useState<AppData>(
    () =>
      getCachedData<AppData>() || {
        vehicles: [],
        trips: [],
        maintenanceServices: [],
      },
  );
  const [loading, setLoading] = useState(true);
  const [personalExpensesEnabled, setPersonalExpensesEnabledState] =
    useState(false);

  const fetchData = useCallback(
    async (options?: { throwOnError?: boolean }) => {
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
        const [
          vehiclesRes,
          tripsRes,
          freightsRes,
          fuelingsRes,
          expensesRes,
          maintRes,
          personalExpRes,
          profileRes,
        ] = await Promise.all([
          supabase
            .from("vehicles")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("trips")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("freights")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("fuelings")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("expenses")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("maintenance_services")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("personal_expenses")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("profiles")
            .select("personal_expenses_enabled")
            .eq("user_id", user.id)
            .single(),
        ]);

        if (vehiclesRes.error) throw vehiclesRes.error;
        if (tripsRes.error) throw tripsRes.error;
        if (freightsRes.error) throw freightsRes.error;
        if (fuelingsRes.error) throw fuelingsRes.error;
        if (expensesRes.error) throw expensesRes.error;
        if (maintRes.error) throw maintRes.error;
        if (personalExpRes.error) throw personalExpRes.error;
        if (profileRes.error && profileRes.error.code !== "PGRST116")
          throw profileRes.error;

        if (profileRes.data) {
          const profile = profileRes.data as {
            personal_expenses_enabled: boolean | null;
          };
          setPersonalExpensesEnabledState(
            profile.personal_expenses_enabled || false,
          );
        }

        const vehicles: Vehicle[] = (vehiclesRes.data || []).map(
          (v: {
            id: string;
            brand: string;
            model: string;
            year: number;
            plate: string;
            is_fleet_owner: boolean | null;
            driver_name: string | null;
            current_km: number | null;
            operation_profile: string | null;
            driver_bond: string | null;
            default_commission_percent: number | null;
          }) => ({
            id: v.id,
            brand: v.brand,
            model: v.model,
            year: v.year,
            plate: v.plate,
            isFleetOwner: v.is_fleet_owner,
            driverName: v.driver_name,
            currentKm: v.current_km || 0,
            operationProfile: isVehicleOperationProfile(v.operation_profile)
              ? v.operation_profile
              : "driver_owner",
            driverBond: isDriverBond(v.driver_bond) ? v.driver_bond : undefined,
            defaultCommissionPercent: v.default_commission_percent ?? undefined,
          }),
        );

        const freightsMap = new Map<string, Freight[]>();
        (freightsRes.data || []).forEach(
          (f: {
            id: string;
            trip_id: string;
            origin: string;
            destination: string;
            km_initial: number;
            gross_value: number;
            commission_percent: number;
            commission_value: number;
            status: string | null;
            estimated_distance: number | null;
            created_at: string;
          }) => {
            const freight: Freight = {
              id: f.id,
              tripId: f.trip_id,
              origin: f.origin,
              destination: f.destination,
              kmInitial: f.km_initial,
              grossValue: f.gross_value,
              commissionPercent: f.commission_percent,
              commissionValue: f.commission_value,
              status: (f.status || "planned") as FreightStatus,
              estimatedDistance: f.estimated_distance || 0,
              createdAt: f.created_at,
            };
            if (!freightsMap.has(f.trip_id)) freightsMap.set(f.trip_id, []);
            freightsMap.get(f.trip_id)!.push(freight);
          },
        );

        const fuelingsMap = new Map<string, Fueling[]>();
        (fuelingsRes.data || []).forEach(
          (f: {
            id: string;
            trip_id: string;
            station: string;
            total_value: number;
            liters: number;
            price_per_liter: number;
            km_current: number;
            full_tank: boolean | null;
            average: number;
            date: string;
            receipt_url: string | null;
            allocated_value: number | null;
            original_total_value: number | null;
          }) => {
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
              receiptUrl: f.receipt_url || undefined,
              allocatedValue: f.allocated_value ?? undefined,
              originalTotalValue: f.original_total_value ?? undefined,
            };
            if (!fuelingsMap.has(f.trip_id)) fuelingsMap.set(f.trip_id, []);
            fuelingsMap.get(f.trip_id)!.push(fueling);
          },
        );

        const expensesMap = new Map<string, Expense[]>();
        (expensesRes.data || []).forEach(
          (e: {
            id: string;
            trip_id: string;
            category: string;
            description: string;
            value: number;
            date: string;
            receipt_url: string | null;
          }) => {
            const expense: Expense = {
              id: e.id,
              tripId: e.trip_id,
              category: e.category as ExpenseCategory,
              description: e.description,
              value: e.value,
              date: e.date,
              receiptUrl: e.receipt_url || undefined,
            };
            if (!expensesMap.has(e.trip_id)) expensesMap.set(e.trip_id, []);
            expensesMap.get(e.trip_id)!.push(expense);
          },
        );

        const personalExpMap = new Map<string, PersonalExpense[]>();
        (personalExpRes.data || []).forEach(
          (pe: {
            id: string;
            trip_id: string;
            category: string;
            description: string;
            value: number;
            date: string;
          }) => {
            const item: PersonalExpense = {
              id: pe.id,
              tripId: pe.trip_id,
              category: pe.category as PersonalExpenseCategory,
              description: pe.description,
              value: pe.value,
              date: pe.date,
            };
            if (!personalExpMap.has(pe.trip_id))
              personalExpMap.set(pe.trip_id, []);
            personalExpMap.get(pe.trip_id)!.push(item);
          },
        );

        const normalizedFreightsMap = new Map<string, Freight[]>();
        for (const [tripId, freights] of freightsMap.entries()) {
          normalizedFreightsMap.set(tripId, normalizeTripFreights(freights));
        }

        const trips: Trip[] = (tripsRes.data || []).map(
          (t: {
            id: string;
            vehicle_id: string;
            status: string;
            created_at: string;
            finished_at: string | null;
            estimated_distance: number | null;
          }) => ({
            id: t.id,
            vehicleId: t.vehicle_id,
            status: t.status as TripStatus,
            freights: normalizedFreightsMap.get(t.id) || [],
            fuelings: fuelingsMap.get(t.id) || [],
            expenses: expensesMap.get(t.id) || [],
            personalExpenses: personalExpMap.get(t.id) || [],
            createdAt: t.created_at,
            finishedAt: t.finished_at,
            estimatedDistance: t.estimated_distance || 0,
          }),
        );

        trips.forEach((trip) => {
          trip.fuelings = sortFuelingsByTimeline(trip.fuelings);
        });

        const maintenanceServices: MaintenanceService[] = (
          maintRes.data || []
        ).map(
          (s: {
            id: string;
            vehicle_id: string;
            service_name: string;
            last_change_km: number;
            interval_km: number;
            created_at: string;
          }) => ({
            id: s.id,
            vehicleId: s.vehicle_id,
            serviceName: s.service_name,
            lastChangeKm: s.last_change_km,
            intervalKm: s.interval_km,
            createdAt: s.created_at,
          }),
        );

        const appData = { vehicles, trips, maintenanceServices };
        setData(appData);
        setCachedData(appData);
      } catch (err) {
        console.error("Error fetching data:", err);
        const cached = getCachedData<AppData>();
        if (cached) setData(cached);
        if (options?.throwOnError) {
          throw err instanceof Error
            ? err
            : new Error("Falha ao recarregar dados.");
        }
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync offline queue when coming back online
  useEffect(() => {
    const syncQueue = async () => {
      const queue = getOfflineQueue();
      if (queue.length === 0 || !user) return;

      let syncErrors = 0;
      const affectedTripIds = new Set<string>();
      const routeSyncFailures: string[] = [];

      for (const action of queue) {
        try {
          switch (action.type) {
            case "addExpense":
              await supabase
                .from("expenses")
                .insert({ ...action.payload, user_id: user.id });
              break;
            case "addFueling":
              await persistFuelingAdd({
                userId: user.id,
                tripId: action.payload.trip_id,
                fuelingId: action.payload.id,
                fueling: {
                  stationName: action.payload.station,
                  totalValue: action.payload.total_value,
                  liters: action.payload.liters,
                  kmCurrent: action.payload.km_current,
                  date: action.payload.date,
                  fullTank: action.payload.full_tank ?? true,
                  receiptUrl: action.payload.receipt_url || undefined,
                },
              });
              break;
            case "updateFueling":
              await persistFuelingUpdate({
                userId: user.id,
                tripId: action.payload.trip_id,
                fuelingId: action.payload.id,
                fueling: {
                  stationName: action.payload.station,
                  totalValue: action.payload.total_value,
                  liters: action.payload.liters,
                  kmCurrent: action.payload.km_current,
                  date: action.payload.date,
                  fullTank: action.payload.full_tank ?? true,
                  receiptUrl: action.payload.receipt_url || undefined,
                },
              });
              break;
            case "addPersonalExpense":
              await supabase
                .from("personal_expenses")
                .insert({ ...action.payload, user_id: user.id });
              break;
            case "addFreight": {
              const { estimatedDistance, diagnostic } =
                await resolveFreightEstimatedDistance({
                  userId: user.id,
                  origin: action.payload.origin,
                  destination: action.payload.destination,
                });

              await supabase.from("freights").insert({
                ...action.payload,
                user_id: user.id,
                estimated_distance: estimatedDistance,
              });

              affectedTripIds.add(action.payload.trip_id);

              if (diagnostic.distanceKm === null) {
                const details = buildRouteFailureDetails({
                  reason: diagnostic.reason,
                  originQueryUsed: diagnostic.originQueryUsed,
                  destinationQueryUsed: diagnostic.destinationQueryUsed,
                });
                routeSyncFailures.push(details);
                console.error(
                  "Falha ao resolver rota durante sync offline de frete",
                  {
                    tripId: action.payload.trip_id,
                    origin: action.payload.origin,
                    destination: action.payload.destination,
                    reason: diagnostic.reason,
                    originQueryUsed: diagnostic.originQueryUsed,
                    destinationQueryUsed: diagnostic.destinationQueryUsed,
                  },
                );
              }
              break;
            }
            case "deleteFreight": {
              const { data: freightBeforeDelete } = await supabase
                .from("freights")
                .select("trip_id")
                .eq("id", action.payload.id)
                .maybeSingle();

              await supabase
                .from("freights")
                .delete()
                .eq("id", action.payload.id);

              if (freightBeforeDelete?.trip_id) {
                affectedTripIds.add(freightBeforeDelete.trip_id);
              }
              break;
            }
            case "deleteFueling":
              await persistFuelingDelete({
                userId: user.id,
                tripId: action.payload.trip_id,
                fuelingId: action.payload.id,
              });
              break;
            case "deleteExpense":
              await supabase
                .from("expenses")
                .delete()
                .eq("id", action.payload.id);
              break;
            case "deletePersonalExpense":
              await supabase
                .from("personal_expenses")
                .delete()
                .eq("id", action.payload.id);
              break;
            case "finishTrip":
              if (action.payload.activeFreightId) {
                await supabase
                  .from("freights")
                  .update({ status: "completed" })
                  .eq("id", action.payload.activeFreightId);
              }
              await supabase
                .from("trips")
                .update({
                  status: "finished",
                  finished_at: new Date().toISOString(),
                  estimated_distance: action.payload.finalTripDistance,
                })
                .eq("id", action.payload.tripId);
              if (action.payload.arrivalKm) {
                await supabase
                  .from("vehicles")
                  .update({ current_km: action.payload.arrivalKm })
                  .eq("id", action.payload.vehicleId);
              }
              break;
          }
          removeFromQueue(action.id);
        } catch (err) {
          console.error("Failed to sync action:", action, err);
          syncErrors++;
        }
      }

      if (affectedTripIds.size > 0) {
        const tripIds = Array.from(affectedTripIds);
        const { data: tripsForKm } = await supabase
          .from("trips")
          .select("id, vehicle_id")
          .in("id", tripIds);

        const affectedVehicleIds = new Set(
          (tripsForKm || []).map((trip) => trip.vehicle_id),
        );

        for (const tripId of tripIds) {
          try {
            await updateTripEstimatedDistanceBySum(tripId);
          } catch (error) {
            console.error(
              "Falha ao atualizar distância estimada após sync offline",
              { tripId, error },
            );
            syncErrors++;
          }
        }

        for (const vehicleId of affectedVehicleIds) {
          try {
            await recalculateVehicleKm(vehicleId);
          } catch (error) {
            console.error("Falha ao recalcular odômetro após sync offline", {
              vehicleId,
              error,
            });
            syncErrors++;
          }
        }
      }

      const routeSyncToast = buildOfflineSyncRouteToast(routeSyncFailures);
      if (routeSyncToast) {
        showActionNotice(routeSyncToast.title, routeSyncToast.description);
      }

      if (syncErrors === 0) {
        toast({
          title: "Dados sincronizados",
          description: "Suas ações offline foram enviadas para a nuvem.",
        });
      } else {
        showActionNotice(
          "Sincronização parcial",
          `${syncErrors} ação(ões) ainda dependem de nova tentativa.`,
        );
      }
      await fetchData();
    };

    const handleOnline = () => syncQueue();
    window.addEventListener("online", handleOnline);
    if (isOnline()) syncQueue();
    return () => window.removeEventListener("online", handleOnline);
  }, [user, fetchData]);

  const setPersonalExpensesEnabled = useCallback(
    async (val: boolean) => {
      if (!user) return;
      setPersonalExpensesEnabledState(val);
      await supabase
        .from("profiles")
        .update({ personal_expenses_enabled: val })
        .eq("user_id", user.id);
    },
    [user],
  );

  const addVehicle = useCallback(
    async (v: Omit<Vehicle, "id">) => {
      if (!user) return;

      const normalizedProfile = normalizeVehicleProfileForPersistence({
        operationProfile: v.operationProfile,
        driverBond: v.driverBond,
        defaultCommissionPercent: v.defaultCommissionPercent,
      });

      const { error } = await supabase.from("vehicles").insert({
        user_id: user.id,
        brand: v.brand,
        model: v.model,
        year: v.year,
        plate: v.plate,
        is_fleet_owner: v.isFleetOwner || false,
        driver_name: v.driverName || null,
        current_km: v.currentKm || 0,
        operation_profile: normalizedProfile.operationProfile,
        driver_bond: normalizedProfile.driverBond,
        default_commission_percent: normalizedProfile.defaultCommissionPercent,
      });
      if (error) throw new Error(error.message || "Falha ao salvar o veículo.");

      await fetchData({ throwOnError: true });
    },
    [user, fetchData],
  );

  const updateVehicle = useCallback(
    async (id: string, v: Partial<Omit<Vehicle, "id">>) => {
      const updateData: {
        brand?: string;
        model?: string;
        year?: number;
        plate?: string;
        is_fleet_owner?: boolean;
        driver_name?: string | null;
        current_km?: number;
        operation_profile?: VehicleOperationProfile;
        driver_bond?: DriverBond | null;
        default_commission_percent?: number | null;
      } = {};
      if (v.brand !== undefined) updateData.brand = v.brand;
      if (v.model !== undefined) updateData.model = v.model;
      if (v.year !== undefined) updateData.year = v.year;
      if (v.plate !== undefined) updateData.plate = v.plate;
      if (v.isFleetOwner !== undefined)
        updateData.is_fleet_owner = v.isFleetOwner;
      if (v.driverName !== undefined) updateData.driver_name = v.driverName;
      if (v.currentKm !== undefined) updateData.current_km = v.currentKm;

      if (
        v.operationProfile !== undefined ||
        v.driverBond !== undefined ||
        v.defaultCommissionPercent !== undefined
      ) {
        const currentVehicle = data.vehicles.find(
          (vehicle) => vehicle.id === id,
        );
        const normalizedProfile = normalizeVehicleProfileUpdateForPersistence({
          currentVehicle,
          operationProfile: v.operationProfile,
          driverBond: v.driverBond,
          defaultCommissionPercent: v.defaultCommissionPercent,
        });

        updateData.operation_profile = normalizedProfile.operationProfile;
        updateData.driver_bond = normalizedProfile.driverBond;
        updateData.default_commission_percent =
          normalizedProfile.defaultCommissionPercent;
      }
      const { error } = await supabase
        .from("vehicles")
        .update(updateData)
        .eq("id", id);
      if (error)
        throw new Error(error.message || "Falha ao atualizar o veículo.");

      await fetchData({ throwOnError: true });
    },
    [data.vehicles, fetchData],
  );

  const deleteVehicle = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error)
        throw new Error(error.message || "Falha ao excluir o veículo.");

      await fetchData({ throwOnError: true });
    },
    [fetchData],
  );

  const updateVehicleKm = useCallback(
    async (vehicleId: string, km: number) => {
      const kmValidation = validatePositiveNumber(km, "KM", true);
      if (!kmValidation.isValid) {
        toast({
          title: "Não deu para salvar",
          description: kmValidation.message,
          variant: "destructive",
        });
        return;
      }

      await supabase
        .from("vehicles")
        .update({ current_km: km })
        .eq("id", vehicleId);
      await fetchData();
      const updatedVehicles = data.vehicles.map((v) =>
        v.id === vehicleId ? { ...v, currentKm: km } : v,
      );
      const alerts = getMaintenanceAlerts(
        updatedVehicles,
        data.maintenanceServices,
      );
      if (alerts.length > 0) checkAndNotifyMaintenance(alerts);
    },
    [data.vehicles, data.maintenanceServices, fetchData],
  );

  const addTrip = useCallback(
    async (vehicleId: string): Promise<Trip> => {
      if (!user) throw new Error("Not authenticated");
      // Check if this vehicle already has an active trip
      const existingActive = data.trips.find(
        (t) => t.vehicleId === vehicleId && t.status === "open",
      );
      if (existingActive)
        throw new Error("Este veículo já possui uma viagem em andamento.");
      const { data: inserted, error } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          vehicle_id: vehicleId,
          status: "open",
        })
        .select()
        .single();
      if (error || !inserted)
        throw new Error(error?.message || "Failed to create trip");
      const trip: Trip = {
        id: inserted.id,
        vehicleId: inserted.vehicle_id,
        status: inserted.status as TripStatus,
        freights: [],
        fuelings: [],
        expenses: [],
        personalExpenses: [],
        createdAt: inserted.created_at,
        finishedAt: inserted.finished_at,
        estimatedDistance: inserted.estimated_distance || 0,
      };
      await fetchData();
      return trip;
    },
    [user, data.trips, fetchData],
  );

  const finishTrip = useCallback(
    async (
      id: string,
      options?: {
        arrivalKm?: number;
        allowPendingPlanned?: boolean;
      },
    ): Promise<{
      autoCompletedFreightId?: string | null;
      pendingPlannedFreights?: number;
    }> => {
      const trip = data.trips.find((t) => t.id === id);
      const arrivalKm = options?.arrivalKm;
      const allowPendingPlanned = options?.allowPendingPlanned ?? false;

      if (!trip) {
        throw new Error("Trip not found");
      }

      if (trip.freights.length === 0) {
        showActionError(
          "Não foi possível finalizar a viagem",
          "Adicione pelo menos 1 frete antes de finalizar a viagem.",
        );
        throw new Error("Trip must have at least 1 freight");
      }

      const activeFreight =
        trip.freights.find((freight) => freight.status === "in_progress") ??
        null;
      const pendingPlannedFreights = getTripPendingPlannedFreights(trip);

      if (pendingPlannedFreights.length > 0 && !allowPendingPlanned) {
        showActionNotice(
          "Tem trecho não iniciado nesta viagem",
          pendingPlannedFreights.length === 1
            ? "Revise esse trecho antes de fechar ou confirme que ele deve ficar fora do consolidado final."
            : `Existem ${pendingPlannedFreights.length} trechos não iniciados. Confirme o fechamento para deixar esses trechos fora do consolidado final.`,
        );
        return {
          autoCompletedFreightId: activeFreight?.id ?? null,
          pendingPlannedFreights: pendingPlannedFreights.length,
        };
      }

      const vehicle = data.vehicles.find((item) => item.id === trip.vehicleId);
      const minOperationalKm = getTripMaxRealKm(trip, vehicle?.currentKm || 0);
      const tripStartKm = getTripStartKm(trip);

      if (!isOnline()) {
        addToOfflineQueue({
          type: "finishTrip",
          payload: {
            tripId: id,
            arrivalKm,
            vehicleId: trip.vehicleId,
            activeFreightId: activeFreight?.id ?? null,
            finalTripDistance:
              arrivalKm != null && tripStartKm != null
                ? Math.max(arrivalKm - tripStartKm, 0)
                : trip.estimatedDistance,
          },
        });
        showOfflineSaved("Viagem finalizada");
        return {
          autoCompletedFreightId: activeFreight?.id ?? null,
          pendingPlannedFreights: pendingPlannedFreights.length,
        };
      }

      if (arrivalKm != null) {
        const arrivalValidation = validatePositiveNumber(
          arrivalKm,
          "KM de chegada",
          true,
        );
        if (!arrivalValidation.isValid) {
          showActionError(
            "Não foi possível finalizar a viagem",
            arrivalValidation.message,
          );
          return {
            autoCompletedFreightId: activeFreight?.id ?? null,
            pendingPlannedFreights: pendingPlannedFreights.length,
          };
        }

        if (arrivalKm < minOperationalKm) {
          const referenceLabel =
            minOperationalKm === (vehicle?.currentKm || 0)
              ? "odômetro atual do veículo"
              : "maior KM real já lançado nesta operação";
          showActionError(
            "Não foi possível finalizar a viagem",
            `O KM de chegada não pode ficar abaixo de ${minOperationalKm.toLocaleString("pt-BR")} km, que é o ${referenceLabel}.`,
          );
          return {
            autoCompletedFreightId: activeFreight?.id ?? null,
            pendingPlannedFreights: pendingPlannedFreights.length,
          };
        }

        const vehicleTimelineKms = await getVehicleTimelineKms(trip.vehicleId);
        const kmContextValidation = validateKmByContext(
          arrivalKm,
          "KM de chegada",
          vehicleTimelineKms,
        );
        if (!kmContextValidation.isValid) {
          showActionError(
            "Não foi possível finalizar a viagem",
            kmContextValidation.message,
          );
          return {
            autoCompletedFreightId: activeFreight?.id ?? null,
            pendingPlannedFreights: pendingPlannedFreights.length,
          };
        }

        if (kmContextValidation.warnings.length > 0) {
          showWarnings(kmContextValidation.warnings);
        }
      }

      if (activeFreight?.id) {
        await supabase
          .from("freights")
          .update({ status: "completed" })
          .eq("id", activeFreight.id);
      }

      const finalTripDistance =
        arrivalKm != null && tripStartKm != null
          ? Math.max(arrivalKm - tripStartKm, 0)
          : trip.estimatedDistance;

      await supabase
        .from("trips")
        .update({
          status: "finished",
          finished_at: new Date().toISOString(),
          estimated_distance: finalTripDistance,
        })
        .eq("id", id);
      if (arrivalKm != null) {
        await updateVehicleKm(trip.vehicleId, arrivalKm);
      } else {
        await fetchData();
      }
      showActionSuccess(
        "Viagem finalizada",
        pendingPlannedFreights.length > 0
          ? activeFreight?.id
            ? "Frete em andamento concluído. Trechos não iniciados ficaram fora do consolidado final da viagem."
            : "Trechos não iniciados ficaram fora do consolidado final da viagem."
          : activeFreight?.id
            ? "Frete em andamento concluído junto com a viagem."
            : "Fechamento concluído com o consolidado final da viagem.",
      );
      return {
        autoCompletedFreightId: activeFreight?.id ?? null,
        pendingPlannedFreights: pendingPlannedFreights.length,
      };
    },
    [data.trips, data.vehicles, fetchData, updateVehicleKm],
  );

  const deleteTrip = useCallback(
    async (id: string) => {
      const trip = data.trips.find((t) => t.id === id);
      const vehicleId = trip?.vehicleId;
      await supabase.from("trips").delete().eq("id", id);
      if (vehicleId) {
        await recalculateVehicleKm(vehicleId);
      }
      await fetchData();
    },
    [data.trips, fetchData],
  );

  const getActiveTrips = useCallback(
    () => data.trips.filter((t) => t.status === "open"),
    [data.trips],
  );

  const recalculateTripEstimatedDistance = useCallback(
    async (tripId: string) => {
      try {
        await updateTripEstimatedDistanceBySum(tripId);
      } catch (error) {
        console.error(
          "Falha ao recalcular distância estimada da viagem",
          error,
        );
        toast({
          title: "Falha ao recalcular rota estimada",
          description:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao atualizar distância da viagem.",
          variant: "destructive",
        });
      }
    },
    [],
  );

  const addFreight = useCallback(
    async (
      tripId: string,
      f: Omit<
        Freight,
        "id" | "tripId" | "commissionValue" | "status" | "estimatedDistance"
      >,
    ) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const kmValidation = validatePositiveNumber(
        f.kmInitial,
        "KM inicial",
        true,
      );
      const grossValidation = validatePositiveNumber(
        f.grossValue,
        "Valor bruto",
      );
      const percentValidation = validatePercent(
        f.commissionPercent,
        "Comissão",
      );

      if (
        !kmValidation.isValid ||
        !grossValidation.isValid ||
        !percentValidation.isValid
      ) {
        const message =
          kmValidation.message ||
          grossValidation.message ||
          percentValidation.message;
        throw new Error(message || "Dados do frete inválidos.");
      }

      const trip = data.trips.find((t) => t.id === tripId);
      const vehicleId = trip?.vehicleId;
      if (vehicleId) {
        const timelineKms = await getVehicleTimelineKms(vehicleId);
        const kmCheck = validateKmByContext(
          f.kmInitial,
          "KM inicial",
          timelineKms,
        );
        if (!kmCheck.isValid) {
          throw new Error(
            kmCheck.message || "KM incoerente para este veículo.",
          );
        }
        showWarnings(kmCheck.warnings);
      }

      showWarnings(
        getNumericWarnings({
          totalValue: f.grossValue,
          commissionPercent: f.commissionPercent,
        }),
      );

      const commissionValue = f.grossValue * (f.commissionPercent / 100);
      const freightStatus = getFreightStatusForInsert(trip?.freights || []);
      const freightFeedback = getFreightCreationFeedback(freightStatus);

      if (!isOnline()) {
        addToOfflineQueue({
          type: "addFreight",
          payload: {
            trip_id: tripId,
            origin: f.origin,
            destination: f.destination,
            km_initial: f.kmInitial,
            km_final: 0,
            gross_value: f.grossValue,
            commission_percent: f.commissionPercent,
            commission_value: commissionValue,
            status: freightStatus,
            estimated_distance: 0,
          },
        });
        if (freightFeedback.variant === "notice") {
          showActionNotice(freightFeedback.title, freightFeedback.description);
        } else {
          showOfflineSaved(freightFeedback.title);
        }
        return;
      }

      const { estimatedDistance, diagnostic: distanceDiagnostic } =
        await resolveFreightEstimatedDistance({
          origin: f.origin,
          destination: f.destination,
          userId: user.id,
        });

      if (distanceDiagnostic.distanceKm === null) {
        const description = buildRouteFailureDetails({
          reason: distanceDiagnostic.reason,
        });

        showActionNotice("Previsão ainda em ajuste", description);

        console.error("Falha no diagnóstico de rota ao criar frete", {
          tripId,
          origin: f.origin,
          destination: f.destination,
          reason: distanceDiagnostic.reason,
          originQueryUsed: distanceDiagnostic.originQueryUsed,
          destinationQueryUsed: distanceDiagnostic.destinationQueryUsed,
        });
      }

      const { error: freightInsertError } = await supabase
        .from("freights")
        .insert({
          trip_id: tripId,
          user_id: user.id,
          origin: f.origin,
          destination: f.destination,
          km_initial: f.kmInitial,
          km_final: 0,
          gross_value: f.grossValue,
          commission_percent: f.commissionPercent,
          commission_value: commissionValue,
          status: freightStatus,
          estimated_distance: estimatedDistance,
        });
      if (freightInsertError)
        throw new Error(
          freightInsertError.message || "Falha ao salvar o frete.",
        );
      if (vehicleId) {
        await recalculateVehicleKm(vehicleId);
      }
      await recalculateTripEstimatedDistance(tripId);
      await fetchData();
      if (freightFeedback.variant === "notice") {
        showActionNotice(freightFeedback.title, freightFeedback.description);
      } else {
        showActionSuccess(freightFeedback.title, freightFeedback.description);
      }
    },
    [user, data.trips, fetchData, recalculateTripEstimatedDistance],
  );

  const deleteFreight = useCallback(
    async (tripId: string, freightId: string) => {
      const trip = data.trips.find((t) => t.id === tripId);
      const vehicleId = trip?.vehicleId;
      const freightToDelete =
        trip?.freights.find((freight) => freight.id === freightId) ?? null;

      if (!isOnline()) {
        addToOfflineQueue({
          type: "deleteFreight",
          payload: { id: freightId },
        });
        showOfflineSaved("Frete excluído");
        return;
      }

      await supabase.from("freights").delete().eq("id", freightId);
      await recalculateTripEstimatedDistance(tripId);
      if (vehicleId) {
        await recalculateVehicleKm(vehicleId);
      }
      await fetchData();

      if (freightToDelete?.status === "planned") {
        showActionNotice(
          "Próximo frete excluído",
          "A fila da viagem foi atualizada sem mexer no KM atual do veículo.",
        );
        return;
      }

      if (freightToDelete?.status === "completed") {
        showActionNotice(
          "Frete concluído excluído",
          "Histórico e odômetro foram recalculados com base no que restou na operação.",
        );
        return;
      }

      showActionNotice(
        "Frete em andamento excluído",
        "A viagem ficou sem trecho ativo até você iniciar outro frete.",
      );
    },
    [data.trips, fetchData, recalculateTripEstimatedDistance],
  );

  const startFreight = useCallback(
    async (tripId: string, freightId: string): Promise<StartFreightResult> => {
      const trip = data.trips.find((candidate) => candidate.id === tripId);
      const activeFreight =
        trip?.freights.find(
          (freight) =>
            freight.status === "in_progress" && freight.id !== freightId,
        ) ?? null;

      if (activeFreight) {
        return {
          status: "blocked_active_freight",
          activeFreightId: activeFreight.id,
        };
      }

      await supabase
        .from("freights")
        .update({ status: "in_progress" })
        .eq("id", freightId);
      await fetchData();
      showActionSuccess(
        "Frete iniciado",
        "Este trecho agora está em andamento na viagem.",
      );
      return { status: "started" };
    },
    [data.trips, fetchData],
  );

  const completeFreight = useCallback(
    async (
      tripId: string,
      freightId: string,
      option:
        | "complete_only"
        | "start_next_if_planned" = "start_next_if_planned",
    ): Promise<{ promotedFreightId?: string | null }> => {
      await supabase
        .from("freights")
        .update({ status: "completed" })
        .eq("id", freightId);

      let promotedFreightId: string | null = null;

      if (option === "start_next_if_planned") {
        const { data: nextPlanned } = await supabase
          .from("freights")
          .select("id")
          .eq("trip_id", tripId)
          .eq("status", "planned")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextPlanned?.id) {
          await supabase
            .from("freights")
            .update({ status: "in_progress" })
            .eq("id", nextPlanned.id);
          promotedFreightId = nextPlanned.id;
        }
      }

      await fetchData();
      return { promotedFreightId };
    },
    [fetchData],
  );

  const updateFreight = useCallback(
    async (
      tripId: string,
      freightId: string,
      f: Omit<
        Freight,
        "id" | "tripId" | "commissionValue" | "status" | "estimatedDistance"
      >,
      options?: { forceRouteRefresh?: boolean; suppressSuccessToast?: boolean },
    ): Promise<FreightUpdateResult> => {
      if (!user) {
        return {
          status: "blocked",
          userMessage: "Faça login novamente para revisar este frete.",
        };
      }

      const kmValidation = validatePositiveNumber(
        f.kmInitial,
        "KM inicial",
        true,
      );
      const grossValidation = validatePositiveNumber(
        f.grossValue,
        "Valor bruto",
      );
      const percentValidation = validatePercent(
        f.commissionPercent,
        "Comissão",
      );
      if (
        !kmValidation.isValid ||
        !grossValidation.isValid ||
        !percentValidation.isValid
      ) {
        const message =
          kmValidation.message ||
          grossValidation.message ||
          percentValidation.message;
        showActionError("Não foi possível salvar agora", message);
        return {
          status: "blocked",
          userMessage: message || "Não foi possível salvar agora.",
        };
      }

      const trip = data.trips.find((t) => t.id === tripId);
      const vehicleId = trip?.vehicleId;

      if (vehicleId) {
        const timelineKms = await getVehicleTimelineKms(vehicleId, {
          freightId,
        });
        const kmCheck = validateKmByContext(
          f.kmInitial,
          "KM inicial",
          timelineKms,
        );
        if (!kmCheck.isValid) {
          throw new Error(
            kmCheck.message || "KM incoerente para este veículo.",
          );
        }
        showWarnings(kmCheck.warnings);
      }

      showWarnings(
        getNumericWarnings({
          totalValue: f.grossValue,
          commissionPercent: f.commissionPercent,
        }),
      );

      const commissionValue = f.grossValue * (f.commissionPercent / 100);

      const { data: currentFreight, error: currentFreightError } =
        await supabase
          .from("freights")
          .select("origin, destination, estimated_distance, status, km_initial")
          .eq("id", freightId)
          .single();

      if (currentFreightError) {
        throw new Error(
          currentFreightError.message ||
            "Falha ao carregar dados atuais do frete.",
        );
      }

      if (
        currentFreight.status === "completed" &&
        currentFreight.km_initial !== f.kmInitial
      ) {
        const userMessage =
          "Frete concluído não pode ter o KM inicial alterado no fluxo normal.";
        showActionError("Não foi possível salvar agora", userMessage);
        return {
          status: "blocked",
          userMessage,
        };
      }

      const routeChanged =
        currentFreight.origin !== f.origin ||
        currentFreight.destination !== f.destination;
      const shouldRefreshRoute =
        routeChanged || Boolean(options?.forceRouteRefresh);
      let nextEstimatedDistance = currentFreight.estimated_distance || 0;

      if (shouldRefreshRoute) {
        const { estimatedDistance, diagnostic: distanceDiagnostic } =
          await refreshFreightEstimatedDistance({
            origin: f.origin,
            destination: f.destination,
            userId: user.id,
          });

        if (distanceDiagnostic.distanceKm === null) {
          const description = buildRouteFailureDetails({
            reason: distanceDiagnostic.reason,
          });

          console.error("Falha no diagnóstico de rota ao editar frete", {
            tripId,
            freightId,
            origin: f.origin,
            destination: f.destination,
            reason: distanceDiagnostic.reason,
            originQueryUsed: distanceDiagnostic.originQueryUsed,
            destinationQueryUsed: distanceDiagnostic.destinationQueryUsed,
          });

          if (routeChanged) {
            const userMessage = `Rota salva, mas a previsão ainda não foi liberada. ${description}`;
            if (!options?.suppressSuccessToast) {
              showActionNotice("Previsão ainda em ajuste", userMessage);
            }

            return { status: "blocked", userMessage };
          }

          await supabase
            .from("freights")
            .update({
              origin: f.origin,
              destination: f.destination,
              km_initial: f.kmInitial,
              gross_value: f.grossValue,
              commission_percent: f.commissionPercent,
              commission_value: commissionValue,
              estimated_distance: nextEstimatedDistance,
            })
            .eq("id", freightId);
          await recalculateTripEstimatedDistance(tripId);
          if (vehicleId) {
            await recalculateVehicleKm(vehicleId);
          }
          await fetchData();

          return {
            status: "saved_without_route",
            userMessage: `Rota salva, mas a previsão ainda não foi liberada. ${description}`,
          };
        }

        nextEstimatedDistance = estimatedDistance;
      }

      await supabase
        .from("freights")
        .update({
          origin: f.origin,
          destination: f.destination,
          km_initial: f.kmInitial,
          gross_value: f.grossValue,
          commission_percent: f.commissionPercent,
          commission_value: commissionValue,
          estimated_distance: nextEstimatedDistance,
        })
        .eq("id", freightId);
      await recalculateTripEstimatedDistance(tripId);
      if (vehicleId) {
        await recalculateVehicleKm(vehicleId);
      }
      await fetchData();

      if (!options?.suppressSuccessToast) {
        showActionSuccess("Frete atualizado");
      }

      return {
        status: shouldRefreshRoute ? "route_refreshed" : "updated",
      };
    },
    [user, data.trips, fetchData, recalculateTripEstimatedDistance],
  );

  const addFueling = useCallback(
    async (
      tripId: string,
      f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">,
    ) => {
      if (!user) return;

      const totalValidation = validatePositiveNumber(
        f.totalValue,
        "Valor total",
      );
      const litersValidation = validatePositiveNumber(f.liters, "Litros");
      const kmValidation = validatePositiveNumber(
        f.kmCurrent,
        "KM atual",
        true,
      );

      if (
        !totalValidation.isValid ||
        !litersValidation.isValid ||
        !kmValidation.isValid
      ) {
        const message =
          totalValidation.message ||
          litersValidation.message ||
          kmValidation.message;
        showActionError("Não foi possível salvar agora", message);
        return;
      }

      const fuelingId = crypto.randomUUID();
      const pricePerLiter = calculateFuelingPricePerLiter(f.totalValue, f.liters);

      if (!isOnline()) {
        addToOfflineQueue({
          type: "addFueling",
          payload: {
            id: fuelingId,
            trip_id: tripId,
            station: f.stationName,
            total_value: f.totalValue,
            liters: f.liters,
            price_per_liter: pricePerLiter,
            km_current: f.kmCurrent,
            full_tank: f.fullTank,
            average: 0,
            date: f.date,
            receipt_url: f.receiptUrl || null,
          },
        });
        showOfflineSaved("Abastecimento salvo");
        return;
      }

      const trip = data.trips.find((t) => t.id === tripId);
      const vehicleId = trip?.vehicleId || "";

      if (vehicleId) {
        const timelineKms = await getVehicleTimelineKms(vehicleId);
        const kmCheck = validateKmByContext(
          f.kmCurrent,
          "KM do abastecimento",
          timelineKms,
        );
        if (!kmCheck.isValid) {
          toast({
            title: "KM incoerente para abastecimento",
            description: kmCheck.message,
            variant: "destructive",
          });
          return;
        }
        showWarnings(kmCheck.warnings);
      }

      showWarnings(
        getNumericWarnings({
          totalValue: f.totalValue,
          liters: f.liters,
          pricePerLiter,
        }),
      );

      try {
        await persistFuelingAdd({
          userId: user.id,
          tripId,
          fuelingId,
          fueling: {
            stationName: f.stationName,
            totalValue: f.totalValue,
            liters: f.liters,
            kmCurrent: f.kmCurrent,
            date: f.date,
            fullTank: f.fullTank,
            receiptUrl: f.receiptUrl,
          },
        });
        await fetchData();
        showActionSuccess(
          "Abastecimento salvo",
          "O custo, a média e os rateios ligados a este tanque foram revisados.",
        );
      } catch (error) {
        showActionError(
          "Não foi possível salvar o abastecimento",
          error instanceof Error ? error.message : "Tenta novamente.",
        );
      }
    },
    [user, data.trips, fetchData],
  );

  const updateFueling = useCallback(
    async (
      tripId: string,
      fuelingId: string,
      f: Omit<Fueling, "id" | "tripId" | "pricePerLiter" | "average">,
    ) => {
      if (!user) return;

      const totalValidation = validatePositiveNumber(
        f.totalValue,
        "Valor total",
      );
      const litersValidation = validatePositiveNumber(f.liters, "Litros");
      const kmValidation = validatePositiveNumber(
        f.kmCurrent,
        "KM atual",
        true,
      );
      if (
        !totalValidation.isValid ||
        !litersValidation.isValid ||
        !kmValidation.isValid
      ) {
        const message =
          totalValidation.message ||
          litersValidation.message ||
          kmValidation.message;
        showActionError("Não foi possível salvar agora", message);
        return;
      }
      const pricePerLiter = calculateFuelingPricePerLiter(f.totalValue, f.liters);
      const trip = data.trips.find((t) => t.id === tripId);
      const vehicleId = trip?.vehicleId || "";
      if (vehicleId) {
        const timelineKms = await getVehicleTimelineKms(vehicleId, {
          fuelingId,
        });
        const kmCheck = validateKmByContext(
          f.kmCurrent,
          "KM do abastecimento",
          timelineKms,
        );
        if (!kmCheck.isValid) {
          toast({
            title: "KM incoerente para abastecimento",
            description: kmCheck.message,
            variant: "destructive",
          });
          return;
        }
        showWarnings(kmCheck.warnings);
      }

      showWarnings(
        getNumericWarnings({
          totalValue: f.totalValue,
          liters: f.liters,
          pricePerLiter,
        }),
      );

      if (!isOnline()) {
        addToOfflineQueue({
          type: "updateFueling",
          payload: {
            id: fuelingId,
            trip_id: tripId,
            station: f.stationName,
            total_value: f.totalValue,
            liters: f.liters,
            price_per_liter: pricePerLiter,
            km_current: f.kmCurrent,
            full_tank: f.fullTank,
            average: 0,
            date: f.date,
            receipt_url: f.receiptUrl || null,
          },
        });
        showOfflineSaved("Abastecimento atualizado");
        return;
      }

      try {
        await persistFuelingUpdate({
          userId: user.id,
          tripId,
          fuelingId,
          fueling: {
            stationName: f.stationName,
            totalValue: f.totalValue,
            liters: f.liters,
            kmCurrent: f.kmCurrent,
            date: f.date,
            fullTank: f.fullTank,
            receiptUrl: f.receiptUrl,
          },
        });
        await fetchData();
        showActionSuccess(
          "Abastecimento atualizado",
          "O sistema refez média, rateio e impacto financeiro deste abastecimento.",
        );
      } catch (error) {
        showActionError(
          "Não foi possível atualizar o abastecimento",
          error instanceof Error ? error.message : "Tenta novamente.",
        );
      }
    },
    [user, data.trips, fetchData],
  );

  const deleteFueling = useCallback(
    async (tripId: string, fuelingId: string) => {
      if (!user) return;
      if (!isOnline()) {
        addToOfflineQueue({
          type: "deleteFueling",
          payload: { id: fuelingId, trip_id: tripId },
        });
        showOfflineSaved("Abastecimento excluído");
        return;
      }

      try {
        await persistFuelingDelete({
          userId: user.id,
          tripId,
          fuelingId,
        });
        await fetchData();
        showActionSuccess(
          "Abastecimento excluído",
          "Os ajustes de custo, média, rateio e odômetro foram refeitos.",
        );
      } catch (error) {
        showActionError(
          "Não foi possível excluir o abastecimento",
          error instanceof Error ? error.message : "Tenta novamente.",
        );
      }
    },
    [fetchData, user],
  );

  const addExpense = useCallback(
    async (tripId: string, e: Omit<Expense, "id" | "tripId">) => {
      if (!user) return;

      const valueValidation = validatePositiveNumber(
        e.value,
        "Valor da despesa",
      );
      if (!valueValidation.isValid) {
        showActionError(
          "Não foi possível salvar agora",
          valueValidation.message,
        );
        return;
      }
      showWarnings(getNumericWarnings({ totalValue: e.value }));

      if (!isOnline()) {
        addToOfflineQueue({
          type: "addExpense",
          payload: {
            trip_id: tripId,
            category: e.category,
            description: e.description,
            value: e.value,
            date: e.date,
            receipt_url: e.receiptUrl || null,
          },
        });
        showOfflineSaved("Despesa salva");
        return;
      }

      await supabase.from("expenses").insert({
        trip_id: tripId,
        user_id: user.id,
        category: e.category,
        description: e.description,
        value: e.value,
        date: e.date,
        receipt_url: e.receiptUrl || null,
      });
      await fetchData();
      showActionSuccess("Despesa salva");
    },
    [user, fetchData],
  );

  const deleteExpense = useCallback(
    async (_tripId: string, expenseId: string) => {
      if (!isOnline()) {
        addToOfflineQueue({
          type: "deleteExpense",
          payload: { id: expenseId },
        });
        showOfflineSaved("Despesa excluída");
        return;
      }
      await supabase.from("expenses").delete().eq("id", expenseId);
      await fetchData();
    },
    [fetchData],
  );

  const updateExpense = useCallback(
    async (
      _tripId: string,
      expenseId: string,
      e: Omit<Expense, "id" | "tripId">,
    ) => {
      const valueValidation = validatePositiveNumber(
        e.value,
        "Valor da despesa",
      );
      if (!valueValidation.isValid) {
        showActionError(
          "Não foi possível salvar agora",
          valueValidation.message,
        );
        return;
      }
      showWarnings(getNumericWarnings({ totalValue: e.value }));

      await supabase
        .from("expenses")
        .update({
          category: e.category,
          description: e.description,
          value: e.value,
          date: e.date,
          receipt_url: e.receiptUrl || null,
        })
        .eq("id", expenseId);
      await fetchData();
      showActionSuccess("Despesa atualizada");
    },
    [fetchData],
  );

  const addPersonalExpense = useCallback(
    async (tripId: string, e: Omit<PersonalExpense, "id" | "tripId">) => {
      if (!user) return;

      const valueValidation = validatePositiveNumber(
        e.value,
        "Valor do gasto pessoal",
      );
      if (!valueValidation.isValid) {
        showActionError(
          "Não foi possível salvar agora",
          valueValidation.message,
        );
        return;
      }
      showWarnings(getNumericWarnings({ totalValue: e.value }));

      if (!isOnline()) {
        addToOfflineQueue({
          type: "addPersonalExpense",
          payload: {
            trip_id: tripId,
            category: e.category,
            description: e.description,
            value: e.value,
            date: e.date,
          },
        });
        showOfflineSaved("Gasto pessoal salvo");
        return;
      }

      await supabase.from("personal_expenses").insert({
        trip_id: tripId,
        user_id: user.id,
        category: e.category,
        description: e.description,
        value: e.value,
        date: e.date,
      });
      await fetchData();
      showActionSuccess("Gasto pessoal salvo");
    },
    [user, fetchData],
  );

  const deletePersonalExpense = useCallback(
    async (_tripId: string, id: string) => {
      if (!isOnline()) {
        addToOfflineQueue({ type: "deletePersonalExpense", payload: { id } });
        showOfflineSaved("Gasto pessoal removido");
        return;
      }
      await supabase.from("personal_expenses").delete().eq("id", id);
      await fetchData();
    },
    [fetchData],
  );

  const updatePersonalExpense = useCallback(
    async (
      _tripId: string,
      id: string,
      e: Omit<PersonalExpense, "id" | "tripId">,
    ) => {
      const valueValidation = validatePositiveNumber(
        e.value,
        "Valor do gasto pessoal",
      );
      if (!valueValidation.isValid) {
        showActionError(
          "Não foi possível salvar agora",
          valueValidation.message,
        );
        return;
      }
      showWarnings(getNumericWarnings({ totalValue: e.value }));

      await supabase
        .from("personal_expenses")
        .update({
          category: e.category,
          description: e.description,
          value: e.value,
          date: e.date,
        })
        .eq("id", id);
      await fetchData();
    },
    [fetchData],
  );

  const clearHistory = useCallback(async () => {
    const finishedTrips = data.trips.filter((t) => t.status === "finished");
    for (const trip of finishedTrips)
      await supabase.from("trips").delete().eq("id", trip.id);
    await fetchData();
  }, [data.trips, fetchData]);

  const addMaintenanceService = useCallback(
    async (s: Omit<MaintenanceService, "id" | "createdAt">) => {
      if (!user) return;

      const lastKmValidation = validatePositiveNumber(
        s.lastChangeKm,
        "KM da última troca",
        true,
      );
      const intervalValidation = validatePositiveNumber(
        s.intervalKm,
        "Intervalo de manutenção",
      );

      if (!lastKmValidation.isValid || !intervalValidation.isValid) {
        const message = lastKmValidation.message || intervalValidation.message;
        toast({
          title: "Não deu para salvar a manutenção",
          description: message,
          variant: "destructive",
        });
        return;
      }

      const timelineKms = await getVehicleTimelineKms(s.vehicleId);
      const kmCheck = validateKmByContext(
        s.lastChangeKm,
        "KM da última troca",
        timelineKms,
      );
      if (!kmCheck.isValid) {
        toast({
          title: "KM incoerente para manutenção",
          description: kmCheck.message,
          variant: "destructive",
        });
        return;
      }
      showWarnings(kmCheck.warnings);

      await supabase.from("maintenance_services").insert({
        user_id: user.id,
        vehicle_id: s.vehicleId,
        service_name: s.serviceName,
        last_change_km: s.lastChangeKm,
        interval_km: s.intervalKm,
      });
      await fetchData();
    },
    [user, fetchData],
  );

  const deleteMaintenanceService = useCallback(
    async (id: string) => {
      await supabase.from("maintenance_services").delete().eq("id", id);
      await fetchData();
    },
    [fetchData],
  );

  return (
    <AppContext.Provider
      value={{
        data,
        loading,
        personalExpensesEnabled,
        setPersonalExpensesEnabled,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        updateVehicleKm,
        addTrip,
        finishTrip,
        deleteTrip,
        getActiveTrips,
        addFreight,
        updateFreight,
        deleteFreight,
        startFreight,
        completeFreight,
        addFueling,
        updateFueling,
        deleteFueling,
        addExpense,
        updateExpense,
        deleteExpense,
        addPersonalExpense,
        updatePersonalExpense,
        deletePersonalExpense,
        clearHistory,
        refreshData: fetchData,
        addMaintenanceService,
        deleteMaintenanceService,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

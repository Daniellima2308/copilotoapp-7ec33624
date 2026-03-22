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

const round2 = (value: number) => Math.round(value * 100) / 100;

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

interface LastFullTankFueling {
  kmCurrent: number;
  tripId: string;
}

async function getLastVehicleFullTankFueling(
  vehicleId: string,
  currentKm: number,
): Promise<LastFullTankFueling | null> {
  const { data: vehicleTrips } = await supabase
    .from("trips")
    .select("id")
    .eq("vehicle_id", vehicleId);

  const tripIds = (vehicleTrips || []).map((t) => t.id);
  if (tripIds.length === 0) return null;

  const { data: prevFuelings } = await supabase
    .from("fuelings")
    .select("km_current, trip_id")
    .in("trip_id", tripIds)
    .eq("full_tank", true)
    .lt("km_current", currentKm)
    .order("km_current", { ascending: false })
    .limit(1);

  const previous = prevFuelings?.[0];
  if (!previous) return null;

  return {
    kmCurrent: previous.km_current,
    tripId: previous.trip_id,
  };
}

async function calculateFuelingAverage(
  vehicleId: string,
  fueling: { kmCurrent: number; liters: number; fullTank: boolean },
): Promise<number> {
  if (!fueling.fullTank || fueling.liters <= 0) return 0;

  const previous = await getLastVehicleFullTankFueling(
    vehicleId,
    fueling.kmCurrent,
  );
  if (!previous) return 0;

  const distanceTotalTrecho = fueling.kmCurrent - previous.kmCurrent;
  if (distanceTotalTrecho <= 0 || fueling.liters <= 0) return 0;

  return round2(distanceTotalTrecho / fueling.liters);
}

interface AllocationResult {
  allocatedValue: number | null;
  originalTotalValue: number | null;
  previousTripId: string | null;
  previousTripCost: number;
}

async function calculateCostAllocation(
  vehicleId: string,
  currentTripId: string,
  fueling: { kmCurrent: number; liters: number; totalValue: number },
  pricePerLiter: number,
): Promise<AllocationResult> {
  const noAlloc: AllocationResult = {
    allocatedValue: null,
    originalTotalValue: null,
    previousTripId: null,
    previousTripCost: 0,
  };

  if (fueling.liters <= 0 || fueling.totalValue <= 0) return noAlloc;

  const previous = await getLastVehicleFullTankFueling(
    vehicleId,
    fueling.kmCurrent,
  );
  if (!previous) return noAlloc;

  const distanceTotalTrecho = fueling.kmCurrent - previous.kmCurrent;
  if (distanceTotalTrecho <= 0) return noAlloc;

  const mediaReal = distanceTotalTrecho / fueling.liters;
  if (mediaReal <= 0) return noAlloc;

  const [{ data: currentFreights }, { data: currentFuelings }] =
    await Promise.all([
      supabase
        .from("freights")
        .select("km_initial")
        .eq("trip_id", currentTripId)
        .order("km_initial", { ascending: true })
        .limit(1),
      supabase
        .from("fuelings")
        .select("km_current")
        .eq("trip_id", currentTripId)
        .order("km_current", { ascending: true })
        .limit(1),
    ]);

  const freightStartKm =
    currentFreights?.[0]?.km_initial ?? Number.POSITIVE_INFINITY;
  const fuelingStartKm =
    currentFuelings?.[0]?.km_current ?? Number.POSITIVE_INFINITY;
  const tripStartKm = Math.min(
    freightStartKm,
    fuelingStartKm,
    fueling.kmCurrent,
  );

  const kmViagemAtual = Math.max(0, fueling.kmCurrent - tripStartKm);

  // Sem cruzamento entre viagens: 100% do custo fica na viagem atual
  if (previous.kmCurrent >= tripStartKm || previous.tripId === currentTripId) {
    return {
      allocatedValue: round2(fueling.totalValue),
      originalTotalValue: null,
      previousTripId: null,
      previousTripCost: 0,
    };
  }

  const litrosViagemAtual = Math.min(fueling.liters, kmViagemAtual / mediaReal);
  const custoRateadoAtual = round2(litrosViagemAtual * pricePerLiter);
  const custoViagemAnterior = round2(
    Math.max(0, fueling.totalValue - custoRateadoAtual),
  );

  return {
    allocatedValue: custoRateadoAtual,
    originalTotalValue: round2(fueling.totalValue),
    previousTripId: custoViagemAnterior > 0 ? previous.tripId : null,
    previousTripCost: custoViagemAnterior,
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
              await supabase
                .from("fuelings")
                .insert({ ...action.payload, user_id: user.id });
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
              await supabase
                .from("expenses")
                .delete()
                .eq("source_fueling_id", action.payload.id);
              await supabase
                .from("fuelings")
                .delete()
                .eq("id", action.payload.id);
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
      arrivalKm?: number,
    ): Promise<{ autoCompletedFreightId?: string | null }> => {
      const trip = data.trips.find((t) => t.id === id);

      // Validate: trip must have at least 1 freight
      if (trip && trip.freights.length === 0) {
        showActionError(
          "Não foi possível finalizar a viagem",
          "Adicione pelo menos 1 frete antes de finalizar a viagem.",
        );
        throw new Error("Trip must have at least 1 freight");
      }

      const activeFreight =
        trip?.freights.find((freight) => freight.status === "in_progress") ??
        null;

      if (!isOnline()) {
        addToOfflineQueue({
          type: "finishTrip",
          payload: {
            tripId: id,
            arrivalKm,
            vehicleId: trip?.vehicleId,
            activeFreightId: activeFreight?.id ?? null,
          },
        });
        showOfflineSaved("Viagem finalizada");
        return { autoCompletedFreightId: activeFreight?.id ?? null };
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
          return { autoCompletedFreightId: activeFreight?.id ?? null };
        }
      }

      if (activeFreight?.id) {
        await supabase
          .from("freights")
          .update({ status: "completed" })
          .eq("id", activeFreight.id);
      }

      await supabase
        .from("trips")
        .update({ status: "finished", finished_at: new Date().toISOString() })
        .eq("id", id);
      if (arrivalKm && trip) {
        await updateVehicleKm(trip.vehicleId, arrivalKm);
      }
      await fetchData();
      showActionSuccess(
        "Viagem finalizada",
        activeFreight?.id
          ? "Frete em andamento concluído junto com a viagem."
          : undefined,
      );
      return { autoCompletedFreightId: activeFreight?.id ?? null };
    },
    [data.trips, fetchData, updateVehicleKm],
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

      if (!isOnline()) {
        const pricePerLiter = f.liters > 0 ? f.totalValue / f.liters : 0;
        addToOfflineQueue({
          type: "addFueling",
          payload: {
            trip_id: tripId,
            station: f.stationName,
            total_value: f.totalValue,
            liters: f.liters,
            price_per_liter: Math.round(pricePerLiter * 100) / 100,
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

      const pricePerLiter = f.liters > 0 ? f.totalValue / f.liters : 0;
      const roundedPPL = round2(pricePerLiter);
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
          pricePerLiter: roundedPPL,
        }),
      );

      const average = vehicleId
        ? await calculateFuelingAverage(vehicleId, f)
        : 0;
      const allocation =
        vehicleId && f.fullTank
          ? await calculateCostAllocation(vehicleId, tripId, f, roundedPPL)
          : null;

      const effectiveCurrentTripCost =
        allocation?.allocatedValue ?? round2(f.totalValue);

      await supabase.from("fuelings").insert({
        trip_id: tripId,
        user_id: user.id,
        station: f.stationName,
        total_value: effectiveCurrentTripCost,
        liters: f.liters,
        price_per_liter: roundedPPL,
        km_current: f.kmCurrent,
        full_tank: f.fullTank,
        average,
        date: f.date,
        receipt_url: f.receiptUrl || null,
        allocated_value: allocation?.allocatedValue ?? null,
        original_total_value: allocation?.originalTotalValue ?? null,
      });

      // Get the inserted fueling ID to link rateio expenses
      const { data: insertedFueling } = await supabase
        .from("fuelings")
        .select("id")
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .eq("km_current", f.kmCurrent)
        .eq("date", f.date)
        .order("created_at", { ascending: false })
        .limit(1);
      const sourceFuelingId = insertedFueling?.[0]?.id || null;

      // Se houve rateio entre viagens, lança retroativamente na viagem anterior
      if (
        allocation?.originalTotalValue != null &&
        allocation.previousTripId &&
        allocation.previousTripCost > 0
      ) {
        await supabase.from("expenses").insert({
          trip_id: allocation.previousTripId,
          user_id: user.id,
          category: "combustivel_rateio",
          description: `Rateio combustível - ${f.stationName}`,
          value: allocation.previousTripCost,
          date: f.date,
          source_fueling_id: sourceFuelingId,
        });
      }

      if (trip) {
        await updateVehicleKm(trip.vehicleId, f.kmCurrent);
      }
      await fetchData();
      showActionSuccess("Abastecimento salvo");
    },
    [user, data.trips, fetchData, updateVehicleKm],
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
      const pricePerLiter = f.liters > 0 ? f.totalValue / f.liters : 0;
      const roundedPPL = Math.round(pricePerLiter * 100) / 100;
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
          pricePerLiter: roundedPPL,
        }),
      );

      const average = vehicleId
        ? await calculateFuelingAverage(vehicleId, f)
        : 0;
      const allocation =
        vehicleId && f.fullTank
          ? await calculateCostAllocation(vehicleId, tripId, f, roundedPPL)
          : null;
      const effectiveCurrentTripCost =
        allocation?.allocatedValue ?? round2(f.totalValue);

      // Delete old rateio expenses linked to this fueling
      await supabase
        .from("expenses")
        .delete()
        .eq("source_fueling_id", fuelingId);

      await supabase
        .from("fuelings")
        .update({
          station: f.stationName,
          total_value: effectiveCurrentTripCost,
          liters: f.liters,
          price_per_liter: roundedPPL,
          km_current: f.kmCurrent,
          full_tank: f.fullTank,
          average,
          date: f.date,
          receipt_url: f.receiptUrl || null,
          allocated_value: allocation?.allocatedValue ?? null,
          original_total_value: allocation?.originalTotalValue ?? null,
        })
        .eq("id", fuelingId);

      // Re-create rateio expense if needed
      if (
        allocation?.originalTotalValue != null &&
        allocation.previousTripId &&
        allocation.previousTripCost > 0
      ) {
        await supabase.from("expenses").insert({
          trip_id: allocation.previousTripId,
          user_id: user.id,
          category: "combustivel_rateio",
          description: `Rateio combustível - ${f.stationName}`,
          value: allocation.previousTripCost,
          date: f.date,
          source_fueling_id: fuelingId,
        });
      }

      if (trip) {
        await recalculateVehicleKm(trip.vehicleId);
      }
      await fetchData();
      showActionSuccess("Abastecimento atualizado");
    },
    [user, data.trips, fetchData],
  );

  const deleteFueling = useCallback(
    async (tripId: string, fuelingId: string) => {
      if (!isOnline()) {
        addToOfflineQueue({
          type: "deleteFueling",
          payload: { id: fuelingId },
        });
        showOfflineSaved("Abastecimento excluído");
        return;
      }
      const trip = data.trips.find((t) => t.id === tripId);
      const vehicleId = trip?.vehicleId;
      await supabase
        .from("expenses")
        .delete()
        .eq("source_fueling_id", fuelingId);
      await supabase.from("fuelings").delete().eq("id", fuelingId);
      if (vehicleId) {
        await recalculateVehicleKm(vehicleId);
      }
      await fetchData();
    },
    [data.trips, fetchData],
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

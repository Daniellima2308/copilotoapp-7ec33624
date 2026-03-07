export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  isFleetOwner?: boolean;
  driverName?: string;
  currentKm: number;
}

export interface MaintenanceService {
  id: string;
  vehicleId: string;
  serviceName: string;
  lastChangeKm: number;
  intervalKm: number;
  createdAt: string;
}

export interface MaintenanceAlert {
  service: MaintenanceService;
  vehicle: Vehicle;
  kmSinceChange: number;
  kmRemaining: number;
  status: "ok" | "warning" | "overdue";
}

export interface Freight {
  id: string;
  tripId: string;
  origin: string;
  destination: string;
  kmInitial: number;
  grossValue: number;
  commissionPercent: number;
  commissionValue: number;
  createdAt: string;
}

export interface Fueling {
  id: string;
  tripId: string;
  stationName: string;
  totalValue: number;
  liters: number;
  kmCurrent: number;
  pricePerLiter: number;
  average: number;
  fullTank: boolean;
  date: string;
  receiptUrl?: string;
  /** When cost was prorated across trips, this is the value allocated to THIS trip */
  allocatedValue?: number;
  /** Original full invoice value when prorated */
  originalTotalValue?: number;
}

export type ExpenseCategory =
  | "manutencao"
  | "pedagio"
  | "estacionamento"
  | "alimentacao"
  | "hospedagem"
  | "multa"
  | "outros";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  manutencao: "Manutenção",
  pedagio: "Pedágio",
  estacionamento: "Estacionamento",
  alimentacao: "Alimentação",
  hospedagem: "Hospedagem",
  multa: "Multa",
  outros: "Outros",
};

export interface Expense {
  id: string;
  tripId: string;
  category: ExpenseCategory;
  description: string;
  value: number;
  date: string;
  receiptUrl?: string;
}

export type PersonalExpenseCategory =
  | "cafe_lanche"
  | "almoco_janta"
  | "banho"
  | "pernoite"
  | "outros";

export const PERSONAL_EXPENSE_LABELS: Record<PersonalExpenseCategory, string> = {
  cafe_lanche: "☕ Café/Lanche",
  almoco_janta: "🍽️ Almoço/Janta",
  banho: "🚿 Banho",
  pernoite: "🛏️ Pernoite",
  outros: "Outros",
};

export interface PersonalExpense {
  id: string;
  tripId: string;
  category: PersonalExpenseCategory;
  description: string;
  value: number;
  date: string;
}

export type TripStatus = "open" | "finished";

export interface Trip {
  id: string;
  vehicleId: string;
  status: TripStatus;
  freights: Freight[];
  fuelings: Fueling[];
  expenses: Expense[];
  personalExpenses: PersonalExpense[];
  createdAt: string;
  finishedAt?: string;
  estimatedDistance: number;
}

export interface AppData {
  vehicles: Vehicle[];
  trips: Trip[];
  maintenanceServices: MaintenanceService[];
}

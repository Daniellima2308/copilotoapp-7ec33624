export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
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
  date: string;
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

export type TripStatus = "open" | "finished";

export interface Trip {
  id: string;
  vehicleId: string;
  status: TripStatus;
  freights: Freight[];
  fuelings: Fueling[];
  expenses: Expense[];
  createdAt: string;
  finishedAt?: string;
}

export interface AppData {
  vehicles: Vehicle[];
  trips: Trip[];
}

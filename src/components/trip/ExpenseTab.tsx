import { useState } from "react";
import { Trip, Expense, ExpenseCategory, EXPENSE_CATEGORY_LABELS } from "@/types";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { Plus, Trash2 } from "lucide-react";
import { ReceiptUpload } from "@/components/ReceiptUpload";

interface ExpenseTabProps {
  trip: Trip;
  isOpen: boolean;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  addExpense: (tripId: string, e: Omit<Expense, "id" | "tripId">) => Promise<void>;
  deleteExpense: (tripId: string, expenseId: string) => Promise<void>;
}

export function ExpenseTab({ trip, isOpen, showForm, setShowForm, addExpense, deleteExpense }: ExpenseTabProps) {
  const [cat, setCat] = useState<ExpenseCategory>("pedagio");
  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    const finalDesc = desc.trim() || EXPENSE_CATEGORY_LABELS[cat];
    addExpense(trip.id, { category: cat, description: finalDesc, value: parseFloat(value), date, receiptUrl });
    setDesc(""); setValue(""); setReceiptUrl(undefined); setShowForm(false);
  };

  return (
    <div className="space-y-2">
      {trip.expenses.map((e: Expense) => (
        <div key={e.id} className="gradient-card rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{e.description}</p>
            <p className="text-xs text-muted-foreground">{EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory]} • {formatDate(e.date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-expense">{formatCurrency(e.value)}</span>
            {isOpen && <button onClick={() => deleteExpense(trip.id, e.id)} className="p-1"><Trash2 className="w-3.5 h-3.5 text-expense" /></button>}
          </div>
        </div>
      ))}
      {isOpen && (showForm ? (
        <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory)} className="input-field col-span-2">
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} className="input-field col-span-2" />
            <input placeholder="Valor (R$)" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="input-field" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
          </div>
          <ReceiptUpload value={receiptUrl} onChange={setReceiptUrl} />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold">Salvar</button>
            <button type="button" onClick={() => { setReceiptUrl(undefined); setShowForm(false); }} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">Cancelar</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full border border-dashed border-border rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" /> Nova Despesa
        </button>
      ))}
    </div>
  );
}

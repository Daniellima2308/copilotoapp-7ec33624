import { useState } from "react";
import { Trip, Expense, ExpenseCategory, EXPENSE_CATEGORY_LABELS } from "@/types";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || isSubmitting) return;
    const finalDesc = desc.trim() || EXPENSE_CATEGORY_LABELS[cat];
    try {
      setIsSubmitting(true);
      await addExpense(trip.id, { category: cat, description: finalDesc, value: parseFloat(value), date, receiptUrl });
      setDesc("");
      setValue("");
      setReceiptUrl(undefined);
      setShowForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      {trip.expenses.length === 0 && (
        <div className="gradient-card rounded-xl border border-dashed border-border/70 p-4">
          <p className="text-sm font-semibold text-foreground">Nenhuma despesa lançada por enquanto.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Pedágio, diária e outros custos entram aqui. Se ainda não teve gasto, tudo certo — lance só quando acontecer.
          </p>
        </div>
      )}

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
            <select value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory)} className="input-field col-span-2" disabled={isSubmitting}>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} className="input-field col-span-2" disabled={isSubmitting} />
            <input placeholder="Valor (R$)" type="number" step="0.01" min="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="input-field" disabled={isSubmitting} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" disabled={isSubmitting} />
          </div>
          <ReceiptUpload value={receiptUrl} onChange={setReceiptUrl} />
          <div className="flex gap-2">
            <button type="submit" disabled={isSubmitting} className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">{isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : "Salvar despesa"}</button>
            <button type="button" onClick={() => { setReceiptUrl(undefined); setShowForm(false); }} disabled={isSubmitting} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed">Cancelar</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full border border-dashed border-border rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm font-medium min-h-[44px]">
          <Plus className="w-4 h-4" /> Nova Despesa
        </button>
      ))}
    </div>
  );
}

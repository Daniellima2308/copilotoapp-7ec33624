import { useState } from "react";
import { useApp } from "@/context/app-context";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Wallet } from "lucide-react";
import { PERSONAL_EXPENSE_LABELS, PersonalExpenseCategory } from "@/types";
import { formatCurrency, formatDate } from "@/lib/calculations";

const PersonalExpensesPage = () => {
  const { data, getActiveTrips, addPersonalExpense, deletePersonalExpense } = useApp();
  const navigate = useNavigate();
  const activeTrips = getActiveTrips();
  const activeTrip = activeTrips.length > 0 ? activeTrips[0] : undefined;
  const [showForm, setShowForm] = useState(false);
  const [cat, setCat] = useState<PersonalExpenseCategory>("almoco_janta");
  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  if (!activeTrip) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center px-6 text-center">
        <Wallet className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold mb-2">Nenhuma viagem ativa</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Inicie uma viagem para registrar seus gastos pessoais como alimentação, banho e pernoite.
        </p>
        <button onClick={() => navigate("/")} className="gradient-profit text-primary-foreground rounded-xl px-6 py-3 font-bold text-sm">
          Ir para o Início
        </button>
      </div>
    );
  }

  const personalExpenses = activeTrip.personalExpenses || [];
  const total = personalExpenses.reduce((s, e) => s + e.value, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    const finalDesc = desc.trim() || PERSONAL_EXPENSE_LABELS[cat];
    addPersonalExpense(activeTrip.id, { category: cat, description: finalDesc, value: parseFloat(value), date });
    setDesc(""); setValue(""); setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Diário de Gastos</h1>
          <p className="text-[10px] text-muted-foreground">Gastos pessoais da viagem ativa</p>
        </div>
      </header>

      <div className="px-4 space-y-4">
        {/* Total card */}
        <div className="gradient-card rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Total Gastos Pessoais</p>
          <p className="text-2xl font-black font-mono text-warning">{formatCurrency(total)}</p>
        </div>

        {/* List */}
        <div className="space-y-2">
          {personalExpenses.map((pe) => (
            <div key={pe.id} className="gradient-card rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{pe.description}</p>
                <p className="text-xs text-muted-foreground">
                  {PERSONAL_EXPENSE_LABELS[pe.category as PersonalExpenseCategory]} • {formatDate(pe.date)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono text-warning">{formatCurrency(pe.value)}</span>
                <button onClick={() => deletePersonalExpense(activeTrip.id, pe.id)} className="p-1">
                  <Trash2 className="w-3.5 h-3.5 text-expense" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        {showForm ? (
          <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-4 space-y-3">
            <select value={cat} onChange={(e) => setCat(e.target.value as PersonalExpenseCategory)} className="input-field">
              {Object.entries(PERSONAL_EXPENSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} className="input-field" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Valor (R$)" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="input-field" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 gradient-profit text-primary-foreground rounded-lg py-2.5 text-sm font-bold">Salvar</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">Cancelar</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="w-full border border-dashed border-border rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> Novo Gasto Pessoal
          </button>
        )}
      </div>
    </div>
  );
};

export default PersonalExpensesPage;

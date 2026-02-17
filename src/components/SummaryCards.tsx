import { DollarSign, TrendingDown, TrendingUp, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";

interface SummaryCardsProps {
  grossRevenue: number;
  netRevenue: number;
  totalExpenses: number;
  totalCommissions: number;
}

export function SummaryCards({ grossRevenue, netRevenue, totalExpenses, totalCommissions }: SummaryCardsProps) {
  const cards = [
    {
      label: "Faturamento Bruto",
      value: formatCurrency(grossRevenue),
      icon: DollarSign,
      className: "gradient-card",
      valueClass: "text-foreground",
    },
    {
      label: "Valor Líquido",
      value: formatCurrency(netRevenue),
      icon: TrendingUp,
      className: netRevenue >= 0 ? "gradient-active-trip glow-profit" : "gradient-card glow-expense",
      valueClass: netRevenue >= 0 ? "text-profit" : "text-expense",
    },
    {
      label: "Total Despesas",
      value: formatCurrency(totalExpenses),
      icon: TrendingDown,
      className: "gradient-card",
      valueClass: "text-expense",
    },
    {
      label: "Total Comissões",
      value: formatCurrency(totalCommissions),
      icon: Percent,
      className: "gradient-card",
      valueClass: "text-warning",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className={`${card.className} rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <card.icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {card.label}
            </span>
          </div>
          <p className={`text-xl font-bold font-mono ${card.valueClass}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

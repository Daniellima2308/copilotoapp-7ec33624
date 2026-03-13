import { useMemo } from "react";
import { useApp } from "@/context/app-context";
import { TripHistoryList } from "@/components/TripHistoryList";
import { Trash2 } from "lucide-react";

const HistoryPage = () => {
  const { data, clearHistory } = useApp();
  const finishedTrips = useMemo(() => data.trips.filter((t) => t.status === "finished"), [data.trips]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Histórico</h1>
          {finishedTrips.length > 0 && (
            <button
              onClick={() => { if (confirm("Limpar todo o histórico de viagens finalizadas?")) clearHistory(); }}
              className="flex items-center gap-1 text-xs text-expense hover:text-expense/80 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
        </div>
      </header>
      <div className="px-4">
        <TripHistoryList trips={finishedTrips} />
      </div>
    </div>
  );
};

export default HistoryPage;

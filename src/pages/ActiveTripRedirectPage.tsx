import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/app-context";
import { toast } from "@/hooks/use-toast";

const ActiveTripRedirectPage = () => {
  const navigate = useNavigate();
  const { data, loading } = useApp();

  useEffect(() => {
    if (loading) return;

    const activeTrip = data.trips
      .filter((trip) => trip.status === "open")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!activeTrip) {
      toast({
        title: "Nenhuma viagem em andamento encontrada.",
        description: "Inicie uma nova viagem para acessar os detalhes.",
      });
      navigate("/", { replace: true });
      return;
    }

    navigate(`/trip/${activeTrip.id}`, { replace: true });
  }, [data.trips, loading, navigate]);

  return <div className="min-h-screen bg-background" />;
};

export default ActiveTripRedirectPage;

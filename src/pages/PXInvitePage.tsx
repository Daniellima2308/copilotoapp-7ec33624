import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const PXInvitePage = () => {
  const { channelId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (channelId) {
      toast({ title: "Entrando no canal...", description: "Redirecionando para o PX Digital." });
      // Store the channel ID so PXDigitalPage can pick it up
      sessionStorage.setItem("px_invite_channel", channelId);
      navigate("/px", { replace: true });
    }
  }, [channelId, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default PXInvitePage;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { AuthGuard } from "@/components/AuthGuard";
import { BottomNav } from "@/components/BottomNav";
import { OnboardingTour } from "@/components/OnboardingTour";
import Dashboard from "./pages/Dashboard";
import VehiclesPage from "./pages/VehiclesPage";
import NewTripPage from "./pages/NewTripPage";
import TripDetailPage from "./pages/TripDetailPage";
import FreightAnalysisPage from "./pages/FreightAnalysisPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import MaintenancePage from "./pages/MaintenancePage";
import PersonalExpensesPage from "./pages/PersonalExpensesPage";
import PXDigitalPage from "./pages/PXDigitalPage";
import PXInvitePage from "./pages/PXInvitePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedApp() {
  return (
    <AuthGuard>
      <AppProvider>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/new-trip" element={<NewTripPage />} />
          <Route path="/trip/:id" element={<TripDetailPage />} />
          <Route path="/freight-analysis" element={<FreightAnalysisPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/menu" element={<ProfilePage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/personal-expenses" element={<PersonalExpensesPage />} />
          <Route path="/px" element={<PXDigitalPage />} />
          <Route path="/px/convite/:channelId" element={<PXInvitePage />} />
        </Routes>
        <OnboardingTour />
        <BottomNav />
      </AppProvider>
    </AuthGuard>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/*" element={<ProtectedApp />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

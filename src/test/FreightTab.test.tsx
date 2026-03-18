import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FreightTab } from "@/components/trip/FreightTab";
import { Trip, Vehicle } from "@/types";

const toastMock = vi.fn();

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/components/CityAutocomplete", () => ({
  CityAutocomplete: ({
    placeholder,
    value,
    onChange,
    className,
  }: {
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    className?: string;
  }) => (
    <input
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const tripBase: Trip = {
  id: "trip-1",
  vehicleId: "vehicle-1",
  status: "open",
  freights: [],
  fuelings: [],
  expenses: [],
  personalExpenses: [],
  createdAt: new Date().toISOString(),
  estimatedDistance: 0,
};

const driverOwnerVehicle: Vehicle = {
  id: "vehicle-1",
  brand: "Volvo",
  model: "FH",
  year: 2022,
  plate: "ABC1234",
  operationProfile: "driver_owner",
  currentKm: 1000,
};

const defaultProps = {
  updateFreight: vi.fn().mockResolvedValue(undefined),
  deleteFreight: vi.fn(),
  startFreight: vi.fn(),
  completeFreight: vi.fn().mockResolvedValue({ promotedFreightId: null }),
};

describe("FreightTab", () => {
  it("fecha formulário apenas quando addFreight tiver sucesso", async () => {
    const addFreight = vi.fn().mockResolvedValue(undefined);
    const setShowForm = vi.fn();

    render(
      <FreightTab
        trip={tripBase}
        vehicle={driverOwnerVehicle}
        isOpen
        showForm
        setShowForm={setShowForm}
        addFreight={addFreight}
        {...defaultProps}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Origem"), {
      target: { value: "SP" },
    });
    fireEvent.change(screen.getByPlaceholderText("Destino"), {
      target: { value: "RJ" },
    });
    fireEvent.change(screen.getByPlaceholderText("KM Inicial"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByPlaceholderText("Valor Bruto (R$)"), {
      target: { value: "1000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar frete" }));

    await waitFor(() => {
      expect(addFreight).toHaveBeenCalledTimes(1);
      expect(setShowForm).toHaveBeenCalledWith(false);
    });
  });

  it("mantém formulário aberto e campos preenchidos quando save falha", async () => {
    const addFreight = vi.fn().mockRejectedValue(new Error("Falha de rede"));
    const setShowForm = vi.fn();

    render(
      <FreightTab
        trip={tripBase}
        vehicle={driverOwnerVehicle}
        isOpen
        showForm
        setShowForm={setShowForm}
        addFreight={addFreight}
        {...defaultProps}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Origem"), {
      target: { value: "SP" },
    });
    fireEvent.change(screen.getByPlaceholderText("Destino"), {
      target: { value: "RJ" },
    });
    fireEvent.change(screen.getByPlaceholderText("KM Inicial"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByPlaceholderText("Valor Bruto (R$)"), {
      target: { value: "1000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar frete" }));

    await waitFor(() => {
      expect(addFreight).toHaveBeenCalledTimes(1);
      expect(setShowForm).not.toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalled();
    });

    expect(screen.getByPlaceholderText("Origem")).toHaveValue("SP");
    expect(screen.getByPlaceholderText("Destino")).toHaveValue("RJ");
  });

  it("força nova tentativa de previsão ao revisar rota sem alterar campos", async () => {
    const updateFreight = vi
      .fn()
      .mockResolvedValue({ status: "route_refreshed" });

    render(
      <FreightTab
        trip={{
          ...tripBase,
          freights: [
            {
              id: "f-1",
              tripId: tripBase.id,
              origin: "SP",
              destination: "MG",
              kmInitial: 100,
              grossValue: 1000,
              commissionPercent: 10,
              commissionValue: 100,
              status: "in_progress",
              estimatedDistance: 0,
              createdAt: new Date().toISOString(),
            },
          ],
        }}
        vehicle={driverOwnerVehicle}
        isOpen
        showForm={false}
        setShowForm={vi.fn()}
        addFreight={vi.fn()}
        updateFreight={updateFreight}
        deleteFreight={vi.fn()}
        startFreight={vi.fn()}
        completeFreight={vi.fn().mockResolvedValue({ promotedFreightId: null })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revisar rota" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar e tentar previsão" }),
    );

    await waitFor(() => {
      expect(updateFreight).toHaveBeenCalledWith(
        "trip-1",
        "f-1",
        expect.objectContaining({ origin: "SP", destination: "MG" }),
        { forceRouteRefresh: true, suppressSuccessToast: true },
      );
    });
  });

  it("mostra feedback único quando a rota continua sem previsão após revisão", async () => {
    const updateFreight = vi.fn().mockResolvedValue({
      status: "saved_without_route",
      userMessage:
        "Origem e destino foram confirmados, mas a previsão da rota ainda não foi liberada.",
    });

    render(
      <FreightTab
        trip={{
          ...tripBase,
          freights: [
            {
              id: "f-1",
              tripId: tripBase.id,
              origin: "SP",
              destination: "MG",
              kmInitial: 100,
              grossValue: 1000,
              commissionPercent: 10,
              commissionValue: 100,
              status: "in_progress",
              estimatedDistance: 0,
              createdAt: new Date().toISOString(),
            },
          ],
        }}
        vehicle={driverOwnerVehicle}
        isOpen
        showForm={false}
        setShowForm={vi.fn()}
        addFreight={vi.fn()}
        updateFreight={updateFreight}
        deleteFreight={vi.fn()}
        startFreight={vi.fn()}
        completeFreight={vi.fn().mockResolvedValue({ promotedFreightId: null })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revisar rota" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar e tentar previsão" }),
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Previsão ainda em ajuste",
        }),
      );
    });

    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Rota revisada",
      }),
    );
  });

  it("mostra Retirada no card para perfil driver_owner", () => {
    render(
      <FreightTab
        trip={{
          ...tripBase,
          freights: [
            {
              id: "f-1",
              tripId: tripBase.id,
              origin: "SP",
              destination: "MG",
              kmInitial: 100,
              grossValue: 1000,
              commissionPercent: 10,
              commissionValue: 100,
              status: "in_progress",
              estimatedDistance: 450,
              createdAt: new Date().toISOString(),
            },
          ],
        }}
        vehicle={driverOwnerVehicle}
        isOpen
        showForm={false}
        setShowForm={vi.fn()}
        addFreight={vi.fn()}
        {...defaultProps}
      />,
    );

    expect(screen.getByText("Retirada")).toBeInTheDocument();
    expect(screen.queryByText("Comissão")).not.toBeInTheDocument();
  });

  it("abre modal ao tocar em Concluir e permite só concluir", async () => {
    const completeFreight = vi
      .fn()
      .mockResolvedValue({ promotedFreightId: null });

    render(
      <FreightTab
        trip={{
          ...tripBase,
          freights: [
            {
              id: "f-1",
              tripId: tripBase.id,
              origin: "SP",
              destination: "MG",
              kmInitial: 100,
              grossValue: 1000,
              commissionPercent: 10,
              commissionValue: 100,
              status: "in_progress",
              estimatedDistance: 450,
              createdAt: new Date().toISOString(),
            },
          ],
        }}
        vehicle={driverOwnerVehicle}
        isOpen
        showForm={false}
        setShowForm={vi.fn()}
        addFreight={vi.fn()}
        {...defaultProps}
        completeFreight={completeFreight}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Concluir/i }));
    expect(screen.getByText("Concluir frete atual?")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Só concluir este frete" }),
    );

    await waitFor(() => {
      expect(completeFreight).toHaveBeenCalledWith(
        "trip-1",
        "f-1",
        "complete_only",
      );
    });
  });
});

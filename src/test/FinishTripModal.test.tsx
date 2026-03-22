import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinishTripModal } from "@/components/FinishTripModal";

describe("FinishTripModal", () => {
  it("destaca trechos planned pendentes e exige confirmação explícita", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <FinishTripModal
        open
        onClose={vi.fn()}
        minKm={1200}
        activeFreight={{ origin: "São Paulo", destination: "Goiânia" }}
        pendingFreights={[
          { id: "planned-1", origin: "Goiânia", destination: "Belém" },
        ]}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.getByText("Existem trechos ainda não iniciados"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Goiânia → Belém/),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/KM do painel agora/i), {
      target: { value: "1400" },
    });
    fireEvent.click(screen.getByRole("button", { name: /finalizar viagem/i }));

    expect(
      await screen.findByText(/Confirme primeiro que os trechos não iniciados devem ficar fora do consolidado final/i),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByLabelText(/Entendi que os trechos não iniciados não entram no fechamento final desta viagem/i),
    );
    fireEvent.click(screen.getByRole("button", { name: /finalizar viagem/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      km: 1400,
      allowPendingPlanned: true,
    });
  });

  it("mostra erro claro quando o KM fica abaixo da referência mínima", async () => {
    render(
      <FinishTripModal
        open
        onClose={vi.fn()}
        minKm={2500}
        activeFreight={null}
        pendingFreights={[]}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/KM do painel agora/i), {
      target: { value: "2400" },
    });
    fireEvent.click(screen.getByRole("button", { name: /finalizar viagem/i }));

    expect(
      await screen.findByText("O KM de chegada precisa ser no mínimo 2.500."),
    ).toBeInTheDocument();
  });
});

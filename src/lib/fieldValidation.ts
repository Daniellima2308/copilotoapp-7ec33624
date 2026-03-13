export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface ValidationWithWarnings extends ValidationResult {
  warnings: string[];
}

const MAX_REASONABLE_KM = 9_999_999;

const isFiniteNumber = (value: number) => Number.isFinite(value);

export function validatePositiveNumber(value: number, fieldLabel: string, allowZero = false): ValidationResult {
  if (!isFiniteNumber(value)) {
    return { isValid: false, message: `Confira o campo ${fieldLabel}.` };
  }

  if (allowZero ? value < 0 : value <= 0) {
    return {
      isValid: false,
      message: allowZero
        ? `${fieldLabel} não pode ser negativo.`
        : `${fieldLabel} precisa ser maior que zero.`,
    };
  }

  return { isValid: true };
}

export function validatePercent(value: number, fieldLabel: string): ValidationResult {
  if (!isFiniteNumber(value)) return { isValid: false, message: `Confira o campo ${fieldLabel}.` };
  if (value < 0 || value > 100) {
    return { isValid: false, message: `${fieldLabel} precisa ficar entre 0% e 100%.` };
  }
  return { isValid: true };
}

export function getKmBounds(values: number[], currentValueToReplace?: number) {
  const cleaned = values
    .filter((v) => Number.isFinite(v) && v >= 0)
    .filter((v) => currentValueToReplace == null || v !== currentValueToReplace)
    .sort((a, b) => a - b);

  return cleaned;
}

export function validateKmByContext(
  kmValue: number,
  contextLabel: string,
  sortedNeighborKms: number[],
): ValidationWithWarnings {
  const base: ValidationWithWarnings = { isValid: true, warnings: [] };

  if (!Number.isFinite(kmValue) || kmValue < 0) {
    return { isValid: false, message: `${contextLabel} precisa ser um KM válido (zero ou maior).`, warnings: [] };
  }

  if (kmValue > MAX_REASONABLE_KM) {
    return { isValid: false, message: `${contextLabel} está alto demais. Confira se não houve erro de digitação.`, warnings: [] };
  }

  if (sortedNeighborKms.length > 0) {
    const max = sortedNeighborKms[sortedNeighborKms.length - 1];
    const min = sortedNeighborKms[0];

    if (kmValue < min - 5_000) {
      return {
        isValid: false,
        message: `${contextLabel} ficou muito abaixo do histórico do veículo. Confira para evitar erro de digitação.`,
        warnings: [],
      };
    }

    if (kmValue < min) {
      base.warnings.push(`${contextLabel} está abaixo do primeiro registro do veículo. Se for um lançamento antigo, pode seguir.`);
    }

    if (kmValue > max + 20_000) {
      base.warnings.push(`${contextLabel} está muito acima do histórico. Se estiver certo, pode salvar normalmente.`);
    }
  }

  return base;
}

export function getNumericWarnings({
  totalValue,
  liters,
  commissionPercent,
  pricePerLiter,
}: {
  totalValue?: number;
  liters?: number;
  commissionPercent?: number;
  pricePerLiter?: number;
}) {
  const warnings: string[] = [];

  if (totalValue != null && totalValue > 10000) {
    warnings.push("Valor alto para este lançamento. Confira antes de salvar.");
  }

  if (liters != null && liters > 1500) {
    warnings.push("Litros muito acima do normal. Confira se o valor está correto.");
  }

  if (commissionPercent != null && commissionPercent > 40) {
    warnings.push("Comissão está bem acima do padrão. Se estiver combinado, pode seguir.");
  }

  if (pricePerLiter != null && (pricePerLiter < 2 || pricePerLiter > 15)) {
    warnings.push("Preço por litro fora da faixa comum. Confira para evitar erro de digitação.");
  }

  return warnings;
}

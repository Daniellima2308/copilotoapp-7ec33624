import { supabase } from "@/integrations/supabase/client";

function getEdgeErrorMessage(error: unknown): string {
  if (!error) return "erro desconhecido";

  if (typeof error === "string") return error;

  if (error instanceof Error) return error.message;

  if (typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    const maybeError = (error as { error?: unknown }).error;

    if (typeof maybeMessage === "string" && maybeMessage.length > 0) return maybeMessage;
    if (typeof maybeError === "string" && maybeError.length > 0) return maybeError;
  }

  return JSON.stringify(error);
}

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    throw new Error(`Edge function error: ${getEdgeErrorMessage(error)}`);
  }

  return data as T;
}

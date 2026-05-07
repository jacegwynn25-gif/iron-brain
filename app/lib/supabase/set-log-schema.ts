type MaybePostgrestError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
} | null;

export function isMissingPrescribedWeightColumn(error: MaybePostgrestError): boolean {
  if (!error) return false;
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return text.includes('prescribed_weight') && (text.includes('column') || text.includes('schema cache'));
}

export function stripPrescribedWeight<T extends { prescribed_weight?: unknown }>(
  payloads: T[]
): Array<Omit<T, 'prescribed_weight'>> {
  return payloads.map((row) => {
    const payload = { ...row };
    delete payload.prescribed_weight;
    return payload;
  });
}

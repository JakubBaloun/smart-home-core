const DIAGNOSTIC_FIELDS = new Set(['battery', 'linkquality'])

/** Sorts telemetry fields so battery/linkquality trail everything else, preserving relative order otherwise. */
export function sortFieldsForDisplay(fields: string[]): string[] {
  return [...fields].sort((a, b) => {
    const aDiagnostic = DIAGNOSTIC_FIELDS.has(a) ? 1 : 0
    const bDiagnostic = DIAGNOSTIC_FIELDS.has(b) ? 1 : 0
    return aDiagnostic - bDiagnostic
  })
}

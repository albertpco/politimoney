export type ScreenState =
  | "loading"
  | "empty-no-results"
  | "empty-no-data"
  | "partial-coverage"
  | "stale-data"
  | "source-conflict"
  | "recoverable-error"
  | "blocking-error";

const ALLOWED: ScreenState[] = [
  "loading",
  "empty-no-results",
  "empty-no-data",
  "partial-coverage",
  "stale-data",
  "source-conflict",
  "recoverable-error",
  "blocking-error",
];

export function parseScreenState(
  value: string | string[] | undefined
): ScreenState | null {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return null;
  return ALLOWED.includes(normalized as ScreenState)
    ? (normalized as ScreenState)
    : null;
}

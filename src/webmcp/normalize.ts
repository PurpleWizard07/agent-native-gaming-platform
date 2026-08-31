// Tool schemas declare these fields as arrays, but a caller occasionally
// sends a bare string for a single value (confirmed via scripts/run-evals.sh
// smoke testing against real Chrome) — normalize rather than crash or,
// worse, silently iterate the string's characters.
export function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
}

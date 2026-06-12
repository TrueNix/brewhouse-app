// Small presentation helpers.

/** Human-readable "time ago" from a Unix epoch in seconds. */
export function timeAgo(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return "never";
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - epochSeconds);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Compact count formatting, e.g. 12345 -> "12.3k". */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Strip a trailing keg-revision suffix for cleaner display (1.2.3_1 -> 1.2.3). */
export function cleanVersion(v: string): string {
  return v.replace(/_\d+$/, "");
}

/** Pretty host from a homepage URL. */
export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Coerce an unknown thrown value (often a string from Tauri) into a message. */
export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}

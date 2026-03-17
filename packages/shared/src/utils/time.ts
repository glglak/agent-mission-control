export function nowISO(): string {
  return new Date().toISOString();
}

export function parseTimestamp(ts: string): Date {
  return new Date(ts);
}

export function msSince(ts: string): number {
  return Date.now() - new Date(ts).getTime();
}

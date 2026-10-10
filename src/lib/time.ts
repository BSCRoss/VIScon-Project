/**
 * All calendar/time logic goes through here. "Today" is always the Europe/Zurich calendar date,
 * stored as a UTC-midnight Date for Prisma `@db.Date` columns. Slots are minutes after midnight.
 */
export const ZONE = "Europe/Zurich";
export const SLOT_MIN = 11 * 60; // 11:00
export const SLOT_MAX = 14 * 60; // 14:00
export const SLOT_STEP = 15;
/** minutes after the planned slot before we ask for feedback */
export const FEEDBACK_DELAY_MIN = 45;

function zurichParts(now: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute };
}

/** "YYYY-MM-DD" of today in Zurich */
export function zurichTodayString(now?: Date): string {
  const { y, m, d } = zurichParts(now);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** UTC-midnight Date for a "YYYY-MM-DD" string (what Prisma @db.Date expects) */
export function dateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function zurichToday(now?: Date): Date {
  return dateOnly(zurichTodayString(now));
}

/** minutes after midnight, Zurich local time */
export function zurichNowMinutes(now?: Date): number {
  const { h, min } = zurichParts(now);
  return h * 60 + min;
}

export function addDays(iso: string, n: number): string {
  const d = dateOnly(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** Monday of the week containing `iso` */
export function mondayOf(iso: string): string {
  const d = dateOnly(iso);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dow);
  return toIso(d);
}

/** 1 = Monday … 7 = Sunday */
export function isoWeekday(iso: string): number {
  return ((dateOnly(iso).getUTCDay() + 6) % 7) + 1;
}

export function formatSlot(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function slots(): number[] {
  const out: number[] = [];
  for (let m = SLOT_MIN; m <= SLOT_MAX; m += SLOT_STEP) out.push(m);
  return out;
}

export function isValidSlot(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= SLOT_MIN && n <= SLOT_MAX && n % SLOT_STEP === 0;
}

/** "Friday, 10 Oct" */
export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(dateOnly(iso));
}

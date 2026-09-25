export const TIME_ZONE = process.env.TZ_DISPLAY ?? "Europe/Paris";

/** Today's date as `YYYY-MM-DD` in the household's time zone. */
export function todayISO(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function currentMonth(now: Date = new Date()): string {
  return monthOf(todayISO(now));
}

export function isValidMonth(m: string | undefined | null): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${month}-${String(daysInMonth(month)).padStart(2, "0")}` };
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Hand-rolled labels: Intl output differs between Node and browsers (e.g. "Wed, 23 Sept" vs
// "Wed 23 Sept"), which breaks hydration of client components.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatMonthName(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

export function formatMonth(month: string, style: "long" | "short" = "long"): string {
  const name = formatMonthName(month);
  return `${style === "short" ? name.slice(0, 3) : name} ${month.slice(0, 4)}`;
}

export function formatShortDate(date: string): string {
  return `${Number(date.slice(8, 10))} ${formatMonthName(date.slice(0, 7)).slice(0, 3)}`;
}

/** "Today", "Yesterday", or "Mon 14 Sep". */
export function formatDayHeading(date: string, today: string = todayISO()): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const year = date.slice(0, 4) === today.slice(0, 4) ? "" : ` ${date.slice(0, 4)}`;
  return `${weekday} ${formatShortDate(date)}${year}`;
}

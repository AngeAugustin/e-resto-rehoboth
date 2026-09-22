import type { Types } from "mongoose";

const WEEKDAYS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

const MONTHS_ABBR = [
  "Jan.",
  "Fev.",
  "Mar.",
  "Avr.",
  "Mai.",
  "Jun.",
  "Jul.",
  "Aou.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
] as const;

export function buildCashSessionName(date: Date, kind: "BAR" | "KITCHEN" = "BAR"): string {
  const weekday = WEEKDAYS[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTHS_ABBR[date.getMonth()];
  const year = date.getFullYear();
  const prefix = kind === "KITCHEN" ? "Session cuisine du" : "Session du";
  return `${prefix} ${weekday} ${day} ${month} ${year}`;
}

/** Sessions bar : champ `kind` BAR, ou documents historiques sans champ. */
export function barCashSessionFilter(exerciceId?: string | Types.ObjectId): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    $or: [{ kind: "BAR" }, { kind: { $exists: false } }, { kind: null }],
  };
  if (exerciceId) filter.exercice = exerciceId;
  return filter;
}

export function kitchenCashSessionFilter(exerciceId?: string | Types.ObjectId): Record<string, unknown> {
  const filter: Record<string, unknown> = { kind: "KITCHEN" };
  if (exerciceId) filter.exercice = exerciceId;
  return filter;
}

export function cashSessionKindFilter(
  kind: "BAR" | "KITCHEN",
  exerciceId?: string | Types.ObjectId
): Record<string, unknown> {
  return kind === "KITCHEN" ? kitchenCashSessionFilter(exerciceId) : barCashSessionFilter(exerciceId);
}

/**
 * Caisse cuisine : relance possible jusqu’au lendemain soir de la date de session
 * (fin du jour calendaire suivant `sessionDate`).
 */
export function kitchenSessionReopenDeadline(sessionDate: Date): Date {
  const deadline = new Date(sessionDate);
  deadline.setHours(0, 0, 0, 0);
  deadline.setDate(deadline.getDate() + 2);
  return deadline;
}

export function canReopenKitchenSessionByDate(sessionDate: Date, now = new Date()): boolean {
  return now < kitchenSessionReopenDeadline(sessionDate);
}

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

export function buildCashSessionName(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTHS_ABBR[date.getMonth()];
  const year = date.getFullYear();
  return `Session du ${weekday} ${day} ${month} ${year}`;
}

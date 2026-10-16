export function formatDateTimeUTC(value: string | number | Date, fallback = "Time unavailable"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);

  return `${formatted} UTC`;
}

/**
 * Timezone utilities - Configured for Africa/Lusaka (Zambia)
 */

export const COMMON_TIMEZONES = [
  { value: "Africa/Lusaka", label: "Lusaka (Africa/Lusaka)" },
];

const TIMEZONE = "Africa/Lusaka";

/**
 * Convert a datetime string to Africa/Lusaka timezone for display
 */
export function convertUtcToUserTimezone(
  dateString: string | null | undefined,
  timezone: string = TIMEZONE
): string {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    return date.toLocaleString("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch (error) {
    console.error("Error converting timezone:", error);
    return dateString;
  }
}

/**
 * Take datetime-local input and return it AS-IS as an ISO string
 * The backend will interpret this naive datetime as Africa/Lusaka
 */
export function convertUserTimezoneToUtc(
  localDateString: string,
  timezone: string = TIMEZONE
): string {
  if (!localDateString) return "";

  try {
    // Simply append seconds and return as ISO
    // The backend will handle it as-is (treating naive as Lusaka)
    return localDateString + ":00";
  } catch (error) {
    console.error("Error formatting datetime:", error);
    return localDateString;
  }
}

/**
 * Format datetime for datetime-local input
 * Converts UTC timestamp to local (Lusaka) time string (YYYY-MM-DDTHH:mm)
 */
export function formatDatetimeLocalFromUtc(
  dateString: string | null | undefined,
  timezone: string = TIMEZONE
): string {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);

    // Get the parts in the target timezone
    // We use sv-SE locale because it formats as YYYY-MM-DD HH:mm:ss which is close to ISO
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).formatToParts(date);

    const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || '';

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');

    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch (error) {
    console.error("Error formatting datetime-local:", error);
    return "";
  }
}

/**
 * Get current datetime formatted for datetime-local input
 */
export function getCurrentDatetimeLocal(timezone: string = TIMEZONE, offsetMs: number = 0): string {
  const now = new Date(Date.now() + offsetMs);

  // We need to format 'now' (which is local to browser) to the target timezone string
  // But actually, for creating NEW dates, we usually want the user's current wall clock time?
  // Or the server's wall clock time?
  // If the user is in Zambia, browser time is Zambia time.
  // If the user is elsewhere, we might want to force Zambia time?
  // Let's use the same logic as formatDatetimeLocalFromUtc but with 'now'

  return formatDatetimeLocalFromUtc(now.toISOString(), timezone);
}

/**
 * Format a date for display in user's timezone
 * @param utcDateString - ISO datetime string in UTC
 * @param timezone - User's timezone (IANA timezone identifier)
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDateForDisplay(
  utcDateString: string | null | undefined,
  timezone: string = TIMEZONE,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!utcDateString) return "";

  try {
    const date = new Date(utcDateString);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    };

    return date.toLocaleString("en-GB", defaultOptions);
  } catch (error) {
    console.error("Error formatting date:", error);
    return utcDateString;
  }
}

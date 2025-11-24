/**
 * Timezone utilities - SIMPLIFIED to use Africa/Cairo only
 * All dates are treated as Africa/Cairo time without conversion
 */

export const COMMON_TIMEZONES = [
  { value: "Africa/Cairo", label: "Cairo (Africa/Cairo)" },
];

const TIMEZONE = "Africa/Cairo";

/**
 * Convert a datetime string to Africa/Cairo timezone for display
 */
export function convertUtcToUserTimezone(
  dateString: string | null | undefined,
  timezone: string = TIMEZONE
): string {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      timeZone: TIMEZONE,
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
 * NO CONVERSION - treats the input as literal time
 */
export function convertUserTimezoneToUtc(
  localDateString: string,
  timezone: string = TIMEZONE
): string {
  if (!localDateString) return "";

  try {
    // Simply append seconds and return as ISO
    // The backend will handle it as-is
    return localDateString + ":00";
  } catch (error) {
    console.error("Error formatting datetime:", error);
    return localDateString;
  }
}

/**
 * Format datetime for datetime-local input
 * Extracts just the date and time parts without timezone conversion
 */
export function formatDatetimeLocalFromUtc(
  dateString: string | null | undefined,
  timezone: string = TIMEZONE
): string {
  if (!dateString) return "";

  try {
    // Remove timezone info and format as YYYY-MM-DDTHH:mm
    const cleaned = dateString.replace('Z', '').replace('+00:00', '');
    if (cleaned.includes('T')) {
      const [date, time] = cleaned.split('T');
      const [hour, minute] = time.split(':');
      return `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }
    return cleaned.substring(0, 16); // YYYY-MM-DDTHH:mm
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
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}`;
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
  timezone: string = "Africa/Cairo",
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
      hour: "2-digit",
      minute: "2-digit",
      ...options,
    };
    
    return date.toLocaleString("en-US", defaultOptions);
  } catch (error) {
    console.error("Error formatting date:", error);
    return utcDateString;
  }
}

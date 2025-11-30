/**
 * Custom hook for timezone-aware datetime operations
 */

import { useAuth } from "../context/AuthContext";
import {
  convertUtcToUserTimezone,
  convertUserTimezoneToUtc,
  formatDatetimeLocalFromUtc,
  getCurrentDatetimeLocal,
  formatDateForDisplay,
} from "../utils/timezone";

export function useTimezone() {
  const { user } = useAuth();
  const userTimezone = user?.timezone || "Africa/Lusaka";

  return {
    /**
     * User's current timezone
     */
    timezone: userTimezone,

    /**
     * Convert UTC datetime to user's timezone
     */
    toUserTimezone: (utcDate: string | null | undefined) =>
      convertUtcToUserTimezone(utcDate, userTimezone),

    /**
     * Convert user's local datetime to UTC
     */
    toUtc: (localDate: string) => convertUserTimezoneToUtc(localDate, userTimezone),

    /**
     * Format UTC datetime for datetime-local input
     */
    formatForInput: (utcDate: string | null | undefined) =>
      formatDatetimeLocalFromUtc(utcDate, userTimezone),

    /**
     * Get current datetime for datetime-local input
     * @param offsetMs - Optional offset in milliseconds to add to current time (e.g., 60000 for 1 minute in future)
     */
    getCurrentLocal: (offsetMs: number = 0) => getCurrentDatetimeLocal(userTimezone, offsetMs),

    /**
     * Format datetime for display
     */
    formatDisplay: (
      utcDate: string | null | undefined,
      options?: Intl.DateTimeFormatOptions
    ) => formatDateForDisplay(utcDate, userTimezone, options),
  };
}

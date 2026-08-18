/**
 * Date utility functions for Asia/Jakarta timezone
 */

const TIMEZONE = 'Asia/Jakarta';

/**
 * Format Date to Asia/Jakarta timezone string
 * @param date Date object or ISO string
 * @returns Formatted string: "2026-08-11 15:30:45"
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('id-ID', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format Date to Asia/Jakarta timezone ISO string without UTC marker
 * @param date Date object or ISO string
 * @returns ISO-like string: "2026-08-11T15:30:45.123"
 */
export function formatDateTimeISO(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d
    .toLocaleString('id-ID', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false,
    })
    .replace(/\/|\./g, '-');
}

/**
 * Get current date/time in Asia/Jakarta
 * @returns Date object adjusted to Asia/Jakarta
 */
export function nowDate(): Date {
  const now = new Date();
  const jakartaTime = new Date(
    now.toLocaleString('en-US', { timeZone: TIMEZONE }),
  );
  const diff = now.getTime() - jakartaTime.getTime();
  return new Date(Date.now() + diff);
}

/**
 * Hong Kong Timezone Utilities (Asia/Hong_Kong, UTC+8)
 * Ensures ISSHK Dream Center bookings are consistently created,
 * parsed, and displayed in Hong Kong Standard Time (HKT) regardless
 * of the user's local device, browser, or VPN timezone settings.
 */

export const HONG_KONG_TZ = 'Asia/Hong_Kong';
export const HONG_KONG_OFFSET = '+08:00';

/**
 * Robust ISO date parser ensuring UTC indicator ('Z') is preserved.
 */
export function parseIsoDate(isoStr) {
  if (!isoStr) return null;
  if (typeof isoStr === 'string' && !isoStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(isoStr)) {
    return new Date(`${isoStr}Z`);
  }
  return new Date(isoStr);
}

/**
 * Creates an ISO 8601 string explicitly tagged with Hong Kong (+08:00) timezone.
 * Example: createHKIsoString("2026-09-23", "11:00") -> "2026-09-23T11:00:00+08:00"
 */
export function createHKIsoString(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return `${dateStr}T${cleanTime}${HONG_KONG_OFFSET}`;
}

/**
 * Formats a single time string in Hong Kong Time (e.g. "11:00 AM").
 */
export function formatHKTime(dateOrIso, options = {}) {
  const d = typeof dateOrIso === 'string' ? parseIsoDate(dateOrIso) : dateOrIso;
  if (!d || isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: HONG_KONG_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options,
  }).format(d);
}

/**
 * Formats a time range in Hong Kong Time (e.g. "11:00 AM – 12:00 PM").
 */
export function formatHKTimeRange(startStr, endStr) {
  if (!startStr || !endStr) return '';
  const startTime = formatHKTime(startStr);
  const endTime = formatHKTime(endStr);
  if (!startTime || !endTime) return '';
  return `${startTime} – ${endTime}`;
}

/**
 * Formats a full date string in Hong Kong Time (e.g. "Wednesday, September 23, 2026").
 */
export function formatHKDate(dateOrIso, options = {}) {
  const d = typeof dateOrIso === 'string' ? parseIsoDate(dateOrIso) : (dateOrIso || new Date());
  if (!d || isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: HONG_KONG_TZ,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(d);
}

/**
 * Formats a short date string in Hong Kong Time (e.g. "Sep 23, 2026").
 */
export function formatHKShortDate(dateOrIso) {
  const d = typeof dateOrIso === 'string' ? parseIsoDate(dateOrIso) : (dateOrIso || new Date());
  if (!d || isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: HONG_KONG_TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Returns the "YYYY-MM-DD" date key in Hong Kong Time.
 * Used for grouping bookings into the correct calendar day cell.
 */
export function getHKDateKey(dateOrIso) {
  const d = typeof dateOrIso === 'string' ? parseIsoDate(dateOrIso) : (dateOrIso || new Date());
  if (!d || isNaN(d.getTime())) return '';

  // en-CA produces standard ISO 'YYYY-MM-DD'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HONG_KONG_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Formats date and time together in Hong Kong Time (e.g. "Sep 23, 2026, 11:00 AM").
 */
export function formatHKDateTime(dateOrIso) {
  const d = typeof dateOrIso === 'string' ? parseIsoDate(dateOrIso) : (dateOrIso || new Date());
  if (!d || isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: HONG_KONG_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Returns today's "YYYY-MM-DD" in Hong Kong Time.
 */
export function getHKTodayKey() {
  return getHKDateKey(new Date());
}

/**
 * Calculates a sensible default upcoming [startTime, endTime] for Hong Kong Time.
 * Suggests the start of the next hour (e.g. 10:48 AM -> 11:00 to 12:00).
 */
export function getHKDefaultStartEndTimes() {
  const now = new Date();
  const currentHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: HONG_KONG_TZ, hour: 'numeric', hourCycle: 'h23' }).format(now),
    10
  );
  const nextHour = (currentHour + 1) % 24;
  const endHour = (nextHour + 1) % 24;
  const pad = (n) => String(n).padStart(2, '0');

  // If late evening (>= 22:00), default to morning
  if (currentHour >= 22) {
    return { startTime: '09:00', endTime: '10:00' };
  }

  return {
    startTime: `${pad(nextHour)}:00`,
    endTime: `${pad(endHour)}:00`,
  };
}

/**
 * Checks whether a Hong Kong date and time combination is in the past.
 */
export function isHKPast(dateStr, timeStr) {
  if (!dateStr) return false;
  const isoStr = timeStr ? createHKIsoString(dateStr, timeStr) : `${dateStr}T23:59:59${HONG_KONG_OFFSET}`;
  const dt = new Date(isoStr);
  return dt.getTime() < Date.now();
}

/**
 * Returns current time in Hong Kong formatted as "HH:MM" (24-hour).
 */
export function getHKCurrentTimeString() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: HONG_KONG_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === 'hour')?.value || '00';
  const m = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${h}:${m}`;
}



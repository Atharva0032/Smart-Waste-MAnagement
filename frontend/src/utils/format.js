// Em dash used as the placeholder for missing or invalid values.
const DASH = '—';

// Safely coerce a value into a valid Date, or return null when it cannot.
function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// 'Nov 4, 2026'
export function formatDate(value) {
  const date = toDate(value);
  if (!date) return DASH;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// 'Nov 4, 2026, 3:45 PM'
export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return DASH;
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
}

// Relative time: 'just now', '5m ago', '3h ago', '2d ago', else a formatted date.
export function timeAgo(value) {
  const date = toDate(value);
  if (!date) return DASH;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

// Shorten long text with an ellipsis.
export function truncate(text, max = 120) {
  if (text === null || text === undefined) return DASH;
  const str = String(text);
  if (str.length <= max) return str;
  return `${str.slice(0, max).trimEnd()}…`;
}

// '12.5 h' or '—'
export function formatHours(hours) {
  if (hours === null || hours === undefined || hours === '') return DASH;
  const num = Number(hours);
  if (Number.isNaN(num)) return DASH;
  return `${num.toFixed(1)} h`;
}

// Locale-aware number formatting.
export function formatNumber(n) {
  if (n === null || n === undefined || n === '') return DASH;
  const num = Number(n);
  if (Number.isNaN(num)) return DASH;
  return new Intl.NumberFormat('en-US').format(num);
}

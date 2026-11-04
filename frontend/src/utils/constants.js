// Role identifiers used across auth, routing and dashboards.
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  WORKER: 'worker'
};

// Waste categories with a display label and a brand color used in charts/chips.
export const WASTE_TYPES = [
  { value: 'organic', label: 'Organic / Biodegradable', color: '#16a34a' },
  { value: 'plastic', label: 'Plastic & Packaging', color: '#0ea5e9' },
  { value: 'electronic', label: 'Electronic (E-Waste)', color: '#8b5cf6' },
  { value: 'hazardous', label: 'Hazardous Waste', color: '#ef4444' },
  { value: 'construction', label: 'Construction Debris', color: '#f59e0b' },
  { value: 'medical', label: 'Medical / Biomedical', color: '#ec4899' },
  { value: 'other', label: 'Other', color: '#64748b' }
];

// Resolve a waste type entry, falling back to a neutral placeholder.
export function getWasteTypeMeta(value) {
  return (
    WASTE_TYPES.find((type) => type.value === value) || {
      value,
      label: value,
      color: '#64748b'
    }
  );
}

// Status presentation metadata (label, hex and Tailwind badge classes).
export const STATUS_META = {
  pending: {
    label: 'Pending',
    hex: '#f59e0b',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    icon: 'schedule'
  },
  assigned: {
    label: 'Assigned',
    hex: '#0ea5e9',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'
  },
  in_progress: {
    label: 'In Progress',
    hex: '#6366f1',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300'
  },
  resolved: {
    label: 'Resolved',
    hex: '#10b981',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
  },
  rejected: {
    label: 'Rejected',
    hex: '#f43f5e',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
  }
};

// Resolve status metadata, falling back to a neutral entry for unknown statuses.
export function getStatusMeta(status) {
  return (
    STATUS_META[status] || {
      label: status || 'Unknown',
      hex: '#64748b',
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
      icon: 'help'
    }
  );
}

// Dropdown options derived from the status metadata.
export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));

// Service zones used in complaint forms and worker management.
export const AREAS = [
  'Zone A - North',
  'Zone B - South',
  'Zone C - East',
  'Zone D - West',
  'Zone E - Central',
  'Zone F - Industrial'
];

// Complaint priority options.
export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];

// Upload constraints shared by all image pickers.
export const MAX_IMAGE_SIZE_MB = 5;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

// Minimum AI confidence (percent) for the frontend to treat a detection as reliable.
export const AI_CONFIDENCE_THRESHOLD = 60;

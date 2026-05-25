// Summit Leads — Premium Dark Theme
// Matches web app exactly (src/index.css)

export const colors = {
  // Primary — confident steel blue
  primary: '#0ea5e9',
  primaryForeground: '#0f172a',
  primarySoft: 'rgba(14, 165, 233, 0.12)',

  // Background — slate-navy
  background: '#111827',
  foreground: '#f8fafc',

  // Cards
  card: '#1a1f2e',
  cardForeground: '#f8fafc',
  cardElevated: '#1e2533',

  // Secondary
  secondary: '#1f2937',
  secondaryForeground: '#e2e8f0',

  // Muted
  muted: '#1c212e',
  mutedForeground: '#94a3b8',

  // Accent — warm steel teal
  accent: '#06b6d4',
  accentForeground: '#0f172a',

  // Destructive
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',

  // Success
  success: '#10b981',
  successForeground: '#ffffff',

  // Warning
  warning: '#f59e0b',
  warningForeground: '#0f172a',

  // Border
  border: '#2d3748',
  input: '#2d3748',
  ring: '#0ea5e9',

  // Status Colors (operational)
  statusQueued: '#64748b',
  statusCalling: '#f59e0b',
  statusConnected: '#10b981',
  statusBooked: '#22c55e',
  statusDnc: '#ef4444',
  statusNoAnswer: '#64748b',
  statusNotInterested: '#f87171',
  statusOnRoute: '#f59e0b',
  statusInProgress: '#8b5cf6',
  statusSale: '#22c55e',
};

export const STATUS_COLORS: Record<string, string> = {
  booked: colors.statusQueued,
  confirmed: colors.primary,
  rescheduled: colors.statusOnRoute,
  replaced: colors.statusInProgress,
  on_route: colors.statusOnRoute,
  in_progress: colors.statusInProgress,
  completed: colors.statusConnected,
  sale: colors.statusSale,
  cancelled: colors.destructive,
  no_show: colors.statusNotInterested,
  scheduled: colors.statusQueued,
  en_route: colors.statusOnRoute,
  on_site: colors.statusInProgress,
};

export const fonts = {
  sans: 'System',
  display: 'System',
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 32,
    elevation: 8,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

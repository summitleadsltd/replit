import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.summitleadsltd.tech',
  appName: 'Summit Tech',

  // ─── Approach A: Remote URL ───────────────────────────────────────────────
  // Points the native WebView at your live Vercel deployment.
  // Technicians log in → Supabase role check → auto-redirected to /technician-dashboard
  // Any update you deploy to Vercel is instantly live in the app — no rebuild needed.
  webDir: 'dist',                    // Required field even for remote URL mode
  server: {
    url: 'https://crm.summitleadsltd.com',
    cleartext: false,                 // HTTPS only — never set true in production
    allowNavigation: [
      'crm.summitleadsltd.com',
      'wggmfykmabandkllqodc.supabase.co',  // Your Supabase project
      '*.supabase.co',
      // LiveKit WebRTC signalling domains
      '*.livekit.cloud',
      '*.livekit.io',
    ]
  },

  // ─── Plugin Configuration ─────────────────────────────────────────────────
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      backgroundColor: '#0f172a',     // Matches your CRM dark background
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerStyle: 'small',
      spinnerColor: '#6366f1',        // Matches your primary indigo colour
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0f172a',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // CapacitorHttp replaces the WebView's fetch with native HTTP on mobile.
    // This avoids CORS issues on certain Supabase edge function calls.
    CapacitorHttp: {
      enabled: true,
    },
  },

  // ─── Android-specific ────────────────────────────────────────────────────
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,  // Set true only during development
  },

  // ─── iOS-specific ────────────────────────────────────────────────────────
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;

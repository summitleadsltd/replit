import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

/**
 * useMobileAuth
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles Supabase auth deep link redirects on Android and iOS.
 *
 * When a technician taps a magic link in their email on mobile, the OS
 * opens the app via the com.summitleadsltd.tech:// URL scheme. This hook
 * catches that URL and completes the Supabase session exchange.
 *
 * Only active on native platforms. Does nothing in the browser.
 *
 * Usage — add to App.tsx inside AuthProvider:
 *
 *   function MobileAuthHandler() {
 *     useMobileAuth();
 *     return null;
 *   }
 *
 *   <AuthProvider>
 *     <MobileAuthHandler />
 *     <Suspense ...>
 *       <Routes> ... </Routes>
 *     </Suspense>
 *   </AuthProvider>
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useMobileAuth() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    const setup = async () => {
      const listener = await App.addListener('appUrlOpen', async ({ url }) => {
        if (import.meta.env.DEV) console.log('[MobileAuth] Deep link received:', url);

        // Supabase magic link: contains #access_token=...
        // Supabase PKCE flow: contains ?code=...
        if (url.includes('access_token') || url.includes('code=')) {
          try {
            if (url.includes('code=')) {
              // PKCE flow: exchange the code for a session
              const urlObj = new URL(url);
              const code = urlObj.searchParams.get('code');
              if (code) {
                const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                  if (import.meta.env.DEV) console.error('[MobileAuth] Code exchange failed:', error.message);
                } else {
                  if (import.meta.env.DEV) console.log('[MobileAuth] Session established for:', data.session?.user?.email);
                }
              }
            } else {
              // Implicit/magic link flow: extract tokens from hash fragment
              const hashParams = new URLSearchParams(url.split('#')[1] || '');
              const accessToken = hashParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token');
              if (accessToken && refreshToken) {
                const { data, error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                if (error) {
                  if (import.meta.env.DEV) console.error('[MobileAuth] setSession failed:', error.message);
                } else {
                  if (import.meta.env.DEV) console.log('[MobileAuth] Session established for:', data.session?.user?.email);
                }
              }
            }
          } catch (err) {
            if (import.meta.env.DEV) console.error('[MobileAuth] Deep link handling error:', err);
          }
          // The AuthProvider's onAuthStateChange listener will pick up
          // the new session and trigger the RoleRedirect automatically.
        }
      });

      cleanup = () => listener.remove();
    };

    setup();

    return () => {
      cleanup?.();
    };
  }, []);
}

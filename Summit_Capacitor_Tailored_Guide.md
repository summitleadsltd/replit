# Summit Tech — Capacitor Setup Guide
### Wired to your actual codebase (Remix of Summit Voice CRM)

---

## What We Know From Your Code

| Item | Detail |
|------|--------|
| App ID | `com.summitleadsltd.tech` |
| Live URL | `https://crm.summitleadsltd.com` |
| Supabase project | `wggmfykmabandkllqodc.supabase.co` |
| LiveKit WebRTC | `livekit-client ^2.18.10` — already installed |
| Technician route | `/technician-dashboard` — already exists & mobile-responsive |
| Role redirect | `App.tsx` auto-redirects `role === "technician"` to `/technician-dashboard` |
| Auth storage | `localStorage` in `supabase/client.ts` — compatible with Capacitor WebView |
| Build tool | Vite — `npm run build` outputs to `dist/` |

**Strategy chosen: Approach A (Remote URL wrap)**
Capacitor shells load `crm.summitleadsltd.com`. Your Vercel deployment is the live source.
Technicians log in → Supabase detects `technician` role → auto-redirect to `/technician-dashboard`.
No separate build needed. Vercel updates hit the app immediately.

---

## Phase 1 — Install Capacitor in Your Project

Run these commands from inside the project root folder:

```bash
# Install Capacitor core, CLI, and platform packages
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios

# Install essential native plugins
npm install @capacitor/push-notifications
npm install @capacitor/status-bar
npm install @capacitor/splash-screen
npm install @capacitor/app
npm install @capacitor/haptics
npm install @capacitor/local-notifications
```

---

## Phase 2 — Initialise Capacitor

```bash
npx cap init "Summit Tech" "com.summitleadsltd.tech" --web-dir dist
```

This creates `capacitor.config.ts` in your project root.
**The file has already been created and configured for LiveKit.**

---

## Phase 3 — Add Android and iOS Platforms

```bash
# Android (works on any OS)
npx cap add android

# iOS (Mac only — skip if you don't have a Mac)
npx cap add ios
```

You'll now have `android/` and `ios/` folders alongside `src/`. These are real native projects.

---

## Phase 4 — Android Manifest Permissions

Open: `android/app/src/main/AndroidManifest.xml`

Replace the entire file with the content from `AndroidManifest_additions.xml` provided alongside this guide.

**Why each permission matters for your app:**

| Permission | Reason |
|------------|--------|
| `INTERNET` | Everything — Supabase, LiveKit, Vercel |
| `RECORD_AUDIO` | LiveKit WebRTC calls — without this, calls are silent |
| `MODIFY_AUDIO_SETTINGS` | Switch audio between speaker/earpiece during calls |
| `BLUETOOTH_CONNECT` | Route audio to Bluetooth headsets |
| `WAKE_LOCK` | Keep call alive when screen turns off |
| `FOREGROUND_SERVICE` | Keep call running when app is backgrounded |
| `POST_NOTIFICATIONS` | Push notifications on Android 13+ |
| `CAMERA` | Job photo uploads from the technician dashboard |

---

## Phase 5 — iOS Info.plist Permissions

Open: `ios/App/App/Info.plist`

Add these entries inside the root `<dict>` tag:

```xml
<!-- Microphone — required for LiveKit WebRTC calls -->
<key>NSMicrophoneUsageDescription</key>
<string>Summit Tech needs microphone access to make and receive calls.</string>

<!-- Camera — for uploading job photos -->
<key>NSCameraUsageDescription</key>
<string>Summit Tech needs camera access to upload job photos.</string>

<!-- Photo Library — for selecting existing photos -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Summit Tech needs photo library access to attach job photos.</string>

<!-- Push Notifications -->
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
  <string>voip</string>
</array>

<!-- Deep link URL scheme for Supabase auth redirect -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.summitleadsltd.tech</string>
    </array>
  </dict>
</array>

<!-- App Transport Security — allows only HTTPS -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
</dict>

<!-- Limits navigation to your registered domains only -->
<key>WKAppBoundDomains</key>
<array>
  <string>crm.summitleadsltd.com</string>
  <string>wggmfykmabandkllqodc.supabase.co</string>
</array>
```

---

## Phase 6 — Handle Supabase Auth Deep Links

When a technician logs in via magic link or OAuth on mobile, Supabase redirects back to your app via the custom URL scheme. You need to handle this in your React code.

**The file `src/hooks/use-mobile-auth.ts` has already been created.**

It has already been integrated into `App.tsx` inside the `AuthProvider`:

```tsx
<AuthProvider>
  <MobileAuthHandler />    {/* ← already added */}
  <Suspense fallback={<LazyFallback />}>
    <Routes>
      ...
    </Routes>
  </Suspense>
</AuthProvider>
```

---

## Phase 7 — Add Microphone Permission Request for LiveKit

Your `Dialer` page uses LiveKit WebRTC. On mobile, the browser's permission dialog behaves differently inside a WebView — you need to explicitly request microphone permission via the Web API before LiveKit initialises.

Find where your LiveKit client is initialised (likely in `use-livekit-client.ts` or similar).

Add this at the top of that hook or before the LiveKit connection:

```typescript
import { Capacitor } from '@capacitor/core';

// At the start of your LiveKit init function:
async function requestMicrophonePermission() {
  if (!Capacitor.isNativePlatform()) return true; // Browser handles its own

  // Use the Web API, which Capacitor bridges natively:
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // Release immediately
    return true;
  } catch (err) {
    console.error('Microphone permission denied:', err);
    return false;
  }
}
```

Call this before connecting to LiveKit in your LiveKit initialisation code.

---

## Phase 8 — Sync and Open

```bash
# Sync your config into the native projects
npx cap sync

# Open Android Studio
npx cap open android

# Open Xcode (Mac only)
npx cap open ios
```

### In Android Studio:

1. Wait for Gradle sync to finish (bottom status bar — takes 2–3 min first time)
2. Connect your Android phone via USB
3. Enable **Developer Mode** on the phone: Settings → About Phone → tap Build Number 7 times
4. Enable **USB Debugging**: Settings → Developer Options → USB Debugging ON
5. Select your phone from the device dropdown in Android Studio
6. Click the green **Run** ▶ button

The app will install and open. You'll see `crm.summitleadsltd.com` loading inside the native shell. Log in with a technician account — you'll be auto-routed to `/technician-dashboard`.

---

## Phase 9 — Push Notifications Setup

Push notifications require a backend service to send the notification when a new appointment is assigned. Here's how to wire it up with your existing Supabase setup.

### Android — Firebase Cloud Messaging (FCM)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project → add an Android app with package name `com.summitleadsltd.tech`
3. Download `google-services.json` → place it at `android/app/google-services.json`
4. In `android/build.gradle` (project level), add:
   ```groovy
   dependencies {
     classpath 'com.google.gms:google-services:4.3.15'
   }
   ```
5. In `android/app/build.gradle`, add at the bottom:
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```

### iOS — Apple Push Notification Service (APNs)

1. In Xcode: Signing & Capabilities → + Capability → **Push Notifications**
2. Also add **Background Modes** → check **Remote notifications**
3. Download your APNs key from Apple Developer portal
4. Upload it in Firebase console under Project Settings → Cloud Messaging → iOS app

### Register the device token in your app

Add to your main layout component (e.g., `AppLayout.tsx`):

```typescript
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;

    const setup = async () => {
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') return;

      await PushNotifications.register();

      PushNotifications.addListener('registration', async ({ value: token }) => {
        // Save FCM/APNs token to Supabase so your backend can target this device
        await supabase
          .from('device_tokens')         // Create this table in Supabase
          .upsert({
            user_id: user.id,
            token,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,platform' });
      });

      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('Notification received in foreground:', notification);
        // You can show a toast here using your existing sonner setup
      });

      PushNotifications.addListener('pushNotificationActionPerformed', action => {
        // User tapped the notification — navigate to the relevant screen
        const data = action.notification.data;
        if (data?.route) {
          window.location.href = data.route; // e.g., '/technician-dashboard'
        }
      });
    };

    setup();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user]);
}
```

---

## Phase 10 — Build for Release

### Android (Play Store)

```bash
npx cap sync android
npx cap open android
```

In Android Studio:
1. **Build → Generate Signed Bundle/APK**
2. Choose **Android App Bundle (.aab)** — preferred by Google Play
3. **Create new keystore** — save the `.jks` file and passwords somewhere permanent and secure. If lost, you cannot publish updates.
4. Choose **Release** build variant
5. Upload the `.aab` file to [play.google.com/console](https://play.google.com/console)

### iOS (App Store)

```bash
npx cap sync ios
npx cap open ios
```

In Xcode:
1. Set your **Team** in Signing & Capabilities (requires Apple Developer account)
2. Set **Bundle Identifier** to `com.summitleadsltd.tech`
3. **Product → Archive**
4. In the Organizer window → **Distribute App → App Store Connect**
5. In [appstoreconnect.apple.com](https://appstoreconnect.apple.com) — fill in listing and submit for review

---

## Daily Development Workflow

```bash
# You updated the Vercel deployment — nothing to do!
# The native app loads crm.summitleadsltd.com live.

# If you added/removed a Capacitor plugin:
npm install @capacitor/new-plugin
npx cap sync        # Syncs plugin into android/ and ios/
npx cap open android  # Rebuild from Android Studio
```

---

## Known Issues to Watch For

### LiveKit WebRTC on Android WebView
WebRTC in Android WebViews has had historical quirks. If calls connect but you hear no audio:
1. Confirm `RECORD_AUDIO` permission is granted (check in phone Settings → Apps → Summit Tech → Permissions)
2. Test on a physical device, not emulator (emulators don't support WebRTC audio well)
3. Add this to `MainActivity.java` if audio is still broken:
   ```java
   WebView.setWebContentsDebuggingEnabled(true); // Development only
   ```

### Supabase `VITE_SUPABASE_PUBLISHABLE_KEY`
Your `supabase/client.ts` uses `VITE_SUPABASE_PUBLISHABLE_KEY` (not the standard `VITE_SUPABASE_ANON_KEY`). Since you're using the Remote URL approach, this doesn't affect the mobile app — your Vercel deployment has the correct env vars already. Just don't change it without updating Vercel too.

### iOS WebRTC Permissions
Safari/WKWebView on iOS requires microphone permission to be granted at the iOS level AND at the webpage level. Capacitor bridges this correctly, but the user will see **two** permission dialogs on first launch — one from iOS, one from the web page. This is expected behaviour.

---

## Checklist Before App Store Submission

- [ ] `capacitor.config.ts` in project root with correct `appId` and `server.url`
- [ ] `npx cap add android` done — `android/` folder exists
- [ ] `npx cap add ios` done — `ios/` folder exists (Mac only)
- [ ] AndroidManifest.xml updated with all permissions
- [ ] Info.plist updated with microphone, camera, and URL scheme entries
- [ ] `useMobileAuth` hook added to `App.tsx` for Supabase deep links (✅ done)
- [ ] Microphone permission requested before LiveKit initialises
- [ ] Tested on real Android device — login works, redirects to `/technician-dashboard`
- [ ] Tested on real iOS device — login works, calls work
- [ ] Keystore file saved securely (Android)
- [ ] Apple Developer account active ($99/year)
- [ ] Firebase project created and `google-services.json` placed in `android/app/`
- [ ] Push notifications tested end-to-end

---

## Files Already Integrated

The following files have already been created and integrated into your project:

1. ✅ `capacitor.config.ts` — Configured for LiveKit (not Telnyx)
2. ✅ `src/hooks/use-mobile-auth.ts` — Mobile auth deep link handler
3. ✅ `src/App.tsx` — MobileAuthHandler added inside AuthProvider
4. ✅ `AndroidManifest_additions.xml` — Updated for LiveKit WebRTC

**Next steps for you:**

1. Run the npm install commands from Phase 1
2. Run `npx cap init` (Phase 2)
3. Run `npx cap add android` (Phase 3)
4. Update `android/app/src/main/AndroidManifest.xml` with the provided file (Phase 4)
5. Add microphone permission request to your LiveKit client hook (Phase 7)
6. Run `npx cap sync` and `npx cap open android` (Phase 8)

---

*Tailored for Summit Leads Ltd — summit-reach-calls · Supabase: wggmfykmabandkllqodc*

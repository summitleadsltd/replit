# Summit Leads CRM — Deployment Checklist

**Date**: May 13, 2026
**Domains**:
- Web App: `https://crm.summitleadsltd.com`
- Mobile App: `https://app.summitleadsltd.com`

---

## 1. Cloudflare DNS Configuration

### Web App (`crm.summitleadsltd.com`)
Log into Cloudflare Dashboard → DNS → Add Records:

| Type | Name | Content | TTL | Proxy |
|------|------|---------|-----|-------|
| CNAME | `crm` | Your hosting domain (e.g., `your-project.vercel.app`) | Auto | Yes (orange cloud) |

**Note:** CNAME records can only point to hostnames, not IP addresses. If self-hosting on a VPS with an IP address, use an **A record** instead:
| Type | Name | Content | TTL | Proxy |
|------|------|---------|-----|-------|
| A | `crm` | `your-server-ip` | Auto | Yes |

### Mobile App (`app.summitleadsltd.com`)
| Type | Name | Content | TTL | Proxy |
|------|------|---------|-----|-------|
| CNAME | `app` | Your Expo/EAS or landing page domain | Auto | Yes |

For deep linking to work, also add:
```
applinks:app.summitleadsltd.com
```
to your iOS app's associated domains.

---

## 2. Web App Build & Deploy

```bash
cd "/path/to/project"

# Install dependencies
npm install

# Build for production
npm run build

# Deploy (example for Vercel)
npx vercel --prod
# Or copy dist/ folder to your web server
```

**SSL**: Ensure HTTPS is enabled on Cloudflare (automatic if proxied).

---

## 3. Mobile App Setup

```bash
cd "./technician-mobile"

# Install dependencies
npm install

# Start Expo
npx expo start
```

### EAS Build (for production)
```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Log in to Expo
eas login

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

---

## 4. Supabase Configuration

### A. Edge Function Secrets
In Supabase Dashboard → Edge Functions → Secrets, add:

| Secret Name | Value |
|-------------|-------|
| `SITE_URL` | `https://crm.summitleadsltd.com` |
| `APP_URL` | `https://crm.summitleadsltd.com` |

Deploy the updated edge function:
```bash
supabase functions deploy create-user
```

### B. Authentication → URL Configuration
1. Go to **Authentication → URL Configuration**
2. Set **Site URL**: `https://crm.summitleadsltd.com`
3. Add to **Redirect URLs**:
   - `https://crm.summitleadsltd.com/auth/callback`
   - `https://app.summitleadsltd.com/auth/callback` (for mobile deep links)

### C. Authentication → Email Templates
Customize the **Magic Link** template:
```html
<h2>You're invited to Summit Leads CRM</h2>
<p>Click the link below to set your password:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Set Password</a></p>
```

### D. CORS (if needed)
If you see CORS errors from the mobile app, update edge function CORS headers to include:
```
Access-Control-Allow-Origin: https://app.summitleadsltd.com
```
(Instead of `*` for production security.)

---

## 5. Environment Variables

### Web App (`/.env` or platform env vars)
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-ref
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
```

### Mobile App (`/technician-mobile/.env`)
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SITE_URL=https://app.summitleadsltd.com
```

### Edge Functions (Supabase Secrets)
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SITE_URL=https://crm.summitleadsltd.com
APP_URL=https://crm.summitleadsltd.com
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
TELNYX_API_KEY=your-telnyx-api-key
TELNYX_SIP_TRUNK_ID=your-telnyx-sip-trunk-id
OPENROUTER_API_KEY=your-openrouter-api-key (optional)
```

---

## 6. Post-Deploy Verification

### Web App
- [ ] `https://crm.summitleadsltd.com` loads correctly
- [ ] Login works with existing credentials
- [ ] Magic link invitations send and redirect correctly
- [ ] Campaign-agent assignment works
- [ ] LiveKit dialer connects

### Mobile App
- [ ] App builds successfully via EAS
- [ ] Login works on device/simulator
- [ ] Dashboard shows appointments
- [ ] Availability calendar works
- [ ] Image upload works
- [ ] Logo displays on login screen

### Edge Functions
- [ ] `create-user` deploys successfully
- [ ] Magic link emails contain correct redirect URL
- [ ] `livekit-token` returns valid tokens
- [ ] `livekit-webhook` receives events

---

## Files Changed This Session

| File | Change |
|------|--------|
| `supabase/functions/create-user/index.ts` | Magic link invitations + `SITE_URL` fallback |
| `supabase/functions/ai-call-summary/index.ts` | `APP_URL` fallback updated |
| `src/pages/CampaignDetail.tsx` | Agent assign/remove UI |
| `src/pages/UserManagement.tsx` | Email invitation checkbox |
| `technician-mobile/lib/theme.ts` | Summit Leads dark theme |
| `technician-mobile/App.tsx` | Navigation updates |
| `technician-mobile/screens/LoginScreen.tsx` | Dark theme + logo |
| `technician-mobile/screens/DashboardScreen.tsx` | Dark theme + availability button |
| `technician-mobile/screens/AppointmentDetailScreen.tsx` | Dark theme |
| `technician-mobile/screens/ManagerDashboardScreen.tsx` | New manager screen |
| `technician-mobile/screens/AvailabilityScreen.tsx` | New availability screen |
| `technician-mobile/components/ImageUpload.tsx` | Dark theme |
| `technician-mobile/tsconfig.json` | Fixed Expo base config error |
| `technician-mobile/app.json` | Expo config with domains |
| `.env.example` | Updated with production URLs |
| `technician-mobile/.env.example` | Mobile env template |
| `index.html` | Removed Lovable branding |
| `public/site.webmanifest` | Theme color updated |
| `CHANGES_SUMMARY.md` | Full documentation |
| `DEPLOYMENT.md` | This file |

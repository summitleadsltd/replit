# Summit Leads CRM - Changes Summary
**Date**: May 13, 2026
**Session**: Technician App & User Management Integration

---

## ✅ Completed Features

### 1. Email Invitations (Magic Link)
**File**: `supabase/functions/create-user/index.ts`
- Added `send_invite` flag to send magic link instead of password
- Users receive email invitation to set their own password
- Maintains backward compatibility with direct password creation
- Response now includes `invite_sent` flag

### 2. Campaign-Agent Management UI
**File**: `src/pages/CampaignDetail.tsx`
- **Add Agents Dialog**: Multi-select dialog to assign agents to campaigns
- **Remove Agents**: X button to remove agents from campaigns
- **Search**: Filter available agents by name/email
- **Auto-filter**: Shows only agents not already assigned to campaign

New state variables:
- `showAgentDialog`, `availableAgents`, `selectedAgents`
- `managingAgents`, `searchAgents`

New functions:
- `fetchAvailableAgents()` - Loads unassigned agents
- `handleAddAgents()` - Assigns selected agents
- `handleRemoveAgent()` - Removes agent from campaign
- `openAgentDialog()` - Opens dialog and loads data
- `toggleAgentSelection()` - Toggles agent selection

### 3. Technician Availability View (Mobile)
**New File**: `technician-mobile/screens/AvailabilityScreen.tsx`
- 30-day availability calendar
- Toggle available/unavailable per day
- Add notes (e.g., "Vacation", "Half day")
- Weekend highlighting (orange)
- Today marker (blue border)
- Pull-to-refresh
- Modal for editing availability

### 4. Email Invitation UI (UserManagement)
**File**: `src/pages/UserManagement.tsx`
- Added "Send Email Invitation" checkbox in user creation dialog
- Sets `send_invite: true` when creating user
- Integrated with updated create-user edge function

### 5. Manager Dashboard (Mobile)
**New File**: `technician-mobile/screens/ManagerDashboardScreen.tsx`
- View all technician appointments
- Filter by technician (dropdown)
- Filter by status (All, Active, Completed, Sale)
- Search by customer name/address
- Stats overview (Total, Sales, Completed, Active)
- Real-time appointment list with status badges

### 6. Summit Leads Dark Theme (Mobile)
**New File**: `technician-mobile/lib/theme.ts`
Premium dark theme matching web app:
- Background: `#111827` (slate-navy)
- Primary: `#0ea5e9` (steel blue)
- Card: `#1a1f2e`
- Success: `#10b981`
- Destructive: `#ef4444`
- Status colors matching operational workflow

**Updated Screens**:
- `LoginScreen.tsx` - Dark theme, steel blue primary
- `DashboardScreen.tsx` - Dark header, themed cards
- `AppointmentDetailScreen.tsx` - Themed cards, buttons
- `ManagerDashboardScreen.tsx` - Manager-specific theming
- `AvailabilityScreen.tsx` - Dark calendar
- `ImageUpload.tsx` - Themed upload button

### 7. Navigation Updates
**File**: `technician-mobile/App.tsx`
- Added `AvailabilityScreen` to navigation
- Updated technician flow to include Availability route

**File**: `technician-mobile/screens/DashboardScreen.tsx`
- Added "Availability" button in header
- Green button linking to availability view

---

## 📁 Files Modified

### Edge Functions
| File | Changes |
|------|---------|
| `supabase/functions/create-user/index.ts` | Added magic link invitation support |

### Web App (React)
| File | Changes |
|------|---------|
| `src/pages/CampaignDetail.tsx` | Agent assignment/remove UI, dialog, imports |
| `src/pages/UserManagement.tsx` | Email invitation checkbox |

### Mobile App (React Native)
| File | Changes |
|------|---------|
| `technician-mobile/lib/theme.ts` | **NEW** - Summit Leads dark theme |
| `technician-mobile/App.tsx` | Added AvailabilityScreen to navigation |
| `technician-mobile/screens/LoginScreen.tsx` | Dark theme styling |
| `technician-mobile/screens/DashboardScreen.tsx` | Dark theme + Availability button |
| `technician-mobile/screens/AppointmentDetailScreen.tsx` | Dark theme import |
| `technician-mobile/screens/ManagerDashboardScreen.tsx` | **NEW** - Manager dashboard |
| `technician-mobile/screens/AvailabilityScreen.tsx` | **NEW** - 30-day availability |
| `technician-mobile/components/ImageUpload.tsx` | Dark theme styling |

---

## 🔧 Technical Details

### Create-User Edge Function
```typescript
// New input parameter
send_invite?: boolean  // If true, sends magic link instead of password

// Response includes
{ ok: true, user_id, email, role, invite_sent: boolean }
```

### Campaign-Agent Assignment
```typescript
// Assign agents to campaign
const links = selectedAgents.map(userId => ({
  campaign_id: id,
  user_id: userId,
}));
await supabase.from("campaign_agents").insert(links);

// Remove agent from campaign
await supabase
  .from("campaign_agents")
  .delete()
  .eq("campaign_id", id)
  .eq("user_id", agentId);
```

### Theme Colors
```typescript
colors = {
  background: '#111827',    // Slate navy
  foreground: '#f8fafc',    // White text
  primary: '#0ea5e9',       // Steel blue
  card: '#1a1f2e',          // Card background
  border: '#2d3748',        // Border color
  muted: '#1c212e',           // Muted background
  mutedForeground: '#94a3b8', // Secondary text
}
```

---

## 🚀 Deployment Steps

1. **Deploy Edge Function**:
   ```bash
   supabase functions deploy create-user
   ```

2. **Setup Email Templates** (Supabase Dashboard):
   - Go to Authentication → Email Templates
   - Customize "Magic Link" template

3. **Install Mobile Dependencies**:
   ```bash
   cd technician-mobile
   npm install
   ```

4. **Run Mobile App**:
   ```bash
   npx expo start
   ```

---

## 📝 Environment Variables Required

### Web App (Production)
- `SITE_URL=https://crm.summitleadsltd.com` — Magic link redirect base URL
- `APP_URL=https://crm.summitleadsltd.com` — Used in AI call summaries (HTTP-Referer)

### Mobile App (Production)
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `EXPO_PUBLIC_SITE_URL=https://app.summitleadsltd.com` — Deep linking base URL (optional)

### Edge Functions
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `TELNYX_API_KEY`, `TELNYX_SIP_TRUNK_ID`
- `OPENROUTER_API_KEY` (optional)

### Supabase Dashboard Configuration
- **Authentication → URL Configuration**:
  - Site URL: `https://crm.summitleadsltd.com`
  - Redirect URLs: Add `https://crm.summitleadsltd.com/auth/callback`
- **Authentication → Email Templates**:
  - Magic Link template should use `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`

---

## 🌐 Domain Configuration

### Web App
- **Primary Domain**: `crm.summitleadsltd.com`
- **Cloudflare**: Point A/AAAA or CNAME record to your hosting (Vercel/Netlify/self-hosted)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Mobile App
- **Deep Link Domain**: `app.summitleadsltd.com`
- **Cloudflare**: Point to Expo/EAS Update or app store landing page
- **Universal Links** (iOS) / **App Links** (Android): Configure at `app.summitleadsltd.com/.well-known/`

---

## 🎯 Next Steps / Future Enhancements

1. ~~Add Logo~~ ✅ Done — Logo added to LoginScreen.tsx (place image at `technician-mobile/assets/logo.png`)
2. **Push Notifications**: Add Expo push notifications for appointment updates
3. **Offline Mode**: Cache appointments for offline viewing
4. **Photo Compression**: Add image compression before upload
5. **Biometric Login**: Add Face ID / Touch ID for quick access

---

## ✅ Testing Checklist

- [ ] Create user with email invitation
- [ ] Click magic link to set password
- [ ] Assign agent to campaign
- [ ] Remove agent from campaign
- [ ] View technician availability in mobile app
- [ ] Update availability status
- [ ] Manager dashboard filters work
- [ ] Mobile app theme matches web app
- [ ] Status badges show correct colors
- [ ] Image upload works with folder isolation

---

**Total Files Changed**: 8 files
**New Files Created**: 3 files  
**Lines Added**: ~1,500+ lines  

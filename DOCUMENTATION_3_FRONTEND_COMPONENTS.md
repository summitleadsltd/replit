# Summit Voice CRM - Frontend Components & Architecture

## Complete UI Component Reference

This document details all frontend components, their relationships, data flow, and integration points.

---

## 1. Application Architecture

### 1.1 Tech Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3.4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: React Context + TanStack Query
- **Routing**: React Router 6
- **Icons**: Lucide React
- **Notifications**: Sonner (toast notifications)

### 1.2 Directory Structure
```
src/
├── App.tsx                 # Root app with routes
├── main.tsx               # Entry point
├── pages/                 # Route-level page components
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui primitives
│   ├── layout/           # Layout components
│   ├── dialer/           # Dialer-specific components
│   ├── contacts/         # Contact management
│   ├── campaigns/        # Campaign management
│   ├── technicians/      # Technician features
│   ├── settings/         # Settings panels
│   └── ...
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
├── integrations/         # External service integrations
└── test/                 # Test utilities
```

---

## 2. Core Application Structure

### 2.1 App.tsx - Root Component

**Purpose**: Application entry point with routing and providers.

**Key Components**:
- `QueryClientProvider`: TanStack Query for server state
- `AuthProvider`: Authentication context
- `TooltipProvider`: Radix UI tooltips
- `BrowserRouter`: React Router
- `Toaster`: Toast notifications

**Route Structure**:
```tsx
<Routes>
  {/* Public */}
  <Route path="/auth" element={<Auth />} />
  <Route path="/auth/callback" element={<AuthCallback />} />
  <Route path="/set-password" element={<SetPassword />} />
  
  {/* Protected */}
  <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
    <Route path="/" element={<RoleRedirect />} />
    
    {/* Agent Routes */}
    <Route path="/dialer" element={<RoleGuard allowedRoles={['admin','agent','confirmer']}><Dialer /></RoleGuard>} />
    <Route path="/callbacks" element={<Callbacks />} />
    <Route path="/contacts" element={<Contacts />} />
    
    {/* Admin Routes */}
    <Route path="/campaigns" element={<RoleGuard allowedRoles={['admin']}><Campaigns /></RoleGuard>} />
    <Route path="/users" element={<UserManagement />} />
    <Route path="/settings" element={<CrmSettings />} />
    
    {/* Manager Routes */}
    <Route path="/team-dashboard" element={<TeamDashboard />} />
    <Route path="/qa-dashboard" element={<QaDashboard />} />
    <Route path="/reports" element={<Reports />} />
    
    {/* Technician Routes */}
    <Route path="/technician-dashboard" element={<TechnicianDashboard />} />
    <Route path="/technician-calendar" element={<TechnicianCalendar />} />
    
    {/* Confirmer Routes */}
    <Route path="/confirmer-queue" element={<ConfirmerQueue />} />
    
    {/* Client Routes */}
    <Route path="/client-portal" element={<ClientPortal />} />
  </Route>
</Routes>
```

---

### 2.2 Authentication & Authorization

#### AuthProvider (hooks/use-auth.tsx)

**Provides**:
- `session`: Current Supabase session
- `user`: Authenticated user
- `profile`: User profile from profiles table
- `role`: Primary role (admin > manager > team_leader > confirmer > agent > technician > client)
- `roles`: All assigned roles
- `company`: Active company
- `canDial`, `canManageAllCalendars`: Permission flags

**Logic**:
```typescript
// Fetch user data on auth state change
useEffect(() => {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      await fetchUserData(session.user.id);
    }
  });
}, []);

// Deactivated users are auto-signed out
if (!profile.is_active) {
  await supabase.auth.signOut();
}
```

#### RoleGuard (components/layout/RoleGuard.tsx)

**Props**: `allowedRoles: AppRole[]`, `children`

**Behavior**:
- Checks if user has any of the allowed roles
- If not: redirects to appropriate dashboard or shows "Access Denied"

---

## 3. Page Components

### 3.1 Dialer Page (pages/Dialer.tsx)

**Role**: Core dialing interface for agents

**State Management**:
```typescript
// Campaign selection
const [campaignId, setCampaignId] = useState<string | null>(null);
const [campaigns, setCampaigns] = useState<Campaign[]>([]);

// Call state (from LiveKit)
const {
  isCallActive, callState, callDuration,
  dial, hangUp, toggleMute, toggleHold, sendDTMF
} = useLiveKitClient();

// Queue state
const { currentLead, stats, loading, fetchNextLead, disposeLead } = useDialerQueue(campaignId);

// Daily queue (separate from campaign queue)
const { totalAssigned, contactedToday, remainingToday, currentLead: dailyLead } = useDialerQueue();

// Power dial state
const [powerDialActive, setPowerDialActive] = useState(false);
const [powerDialPaused, setPowerDialPaused] = useState(false);
const autoDialPendingRef = useRef(false);

// UI state
const [notes, setNotes] = useState("");
const [showCallbackModal, setShowCallbackModal] = useState(false);
const [showAppointmentModal, setShowAppointmentModal] = useState(false);
```

**Layout**: Three-column grid
- **Left Panel** (3 cols): Campaign selector, stats, power dial controls, dial pad
- **Center Panel** (5 cols): Lead card, call controls, timeline
- **Right Panel** (4 cols): Notes, activity timeline, script drawer

**Key Handlers**:
```typescript
// Load next lead
const handleLoadNext = async () => {
  if (!agentReady) { toast({ title: "Not ready" }); return; }
  await fetchNextLead();
  setNotes("");
};

// Start call
const handleStartCall = async () => {
  const from = await getOutboundCallerId();
  makeCall(phone, from);
};

// Auto-dial effect
useEffect(() => {
  if (!autoDialPendingRef.current || !currentLead || onCall) return;
  autoDialPendingRef.current = false;
  
  setTimeout(() => {
    makeCall(phone, from);
  }, 800);
}, [currentLead, onCall]);

// Disposition
const handleDispose = async (code: string) => {
  if (code === 'callback') { setShowCallbackModal(true); return; }
  if (code === 'appointment_booked') { setShowAppointmentModal(true); return; }
  
  const callLogId = await disposeLead(code, notes, lastCallStartedAt, lastCallDuration);
  triggerAiSummary(callLogId);
  await advanceToNext();
};
```

---

### 3.2 Campaigns Page (pages/Campaigns.tsx)

**Role**: Campaign management for admins

**Features**:
- Create/edit campaigns
- Import contacts to campaigns
- Set dial mode (click-to-call, power dial, predictive)
- Configure predictive settings (ratio, abandon rate)
- View campaign stats

**Data Flow**:
```typescript
// Load campaigns
const { data: campaigns } = useQuery({
  queryKey: ['campaigns'],
  queryFn: () => supabase.from('campaigns').select('*').eq('company_id', activeCompanyId)
});

// Create campaign
const createCampaign = async (data: CampaignFormData) => {
  await supabase.from('campaigns').insert({
    name: data.name,
    dial_mode: data.dial_mode,
    predictive_ratio: data.predictive_ratio,
    company_id: activeCompanyId
  });
};
```

---

### 3.3 Contacts Page (pages/Contacts.tsx)

**Role**: Contact/lead management

**Features**:
- View all contacts with filters
- Add/edit contact details
- View contact history
- Bulk actions (assign to campaign, mark DNC)

**Components Used**:
- `ContactList`: Paginated contact table
- `ContactForm`: Add/edit modal
- `ContactHistory`: Timeline of calls and appointments

---

### 3.4 Team Dashboard (pages/TeamDashboard.tsx)

**Role**: Manager/team leader oversight

**Features**:
- Real-time agent status view
- Active calls monitor
- Team performance metrics
- Queue depth by campaign

**Data Polling**:
```typescript
// Poll every 5 seconds for live updates
const { data: agentStatus } = useQuery({
  queryKey: ['agent-status', teamId],
  queryFn: fetchAgentStatuses,
  refetchInterval: 5000
});
```

---

### 3.5 Reports Page (pages/Reports.tsx)

**Role**: Analytics and reporting

**Reports Available**:
- Call volume by agent/campaign
- Conversion rates
- Disposition breakdown
- Recording playback stats
- AI summary usage

**Export**: CSV, PDF generation

---

### 3.6 Technician Pages

**TechnicianDashboard**: Active appointments, job status updates
**TechnicianCalendar**: Schedule view with availability
**ConfirmerQueue**: Appointments needing confirmation calls

---

## 4. Custom Hooks

### 4.1 useLiveKitClient (hooks/use-livekit-client.ts)

**Purpose**: Manage LiveKit WebRTC connection and call state.

**Returns**:
```typescript
{
  // Connection state
  isRegistered: boolean;      // Connected to LiveKit
  connectionStatus: string;     // 'connected' | 'disconnected' | 'error'
  
  // Call state
  isCallActive: boolean;       // Call in progress
  callState: CallState;         // 'idle' | 'connecting' | 'ringing' | 'active' | 'held' | 'ending'
  callDuration: number;         // Seconds
  awaitingDisposition: boolean; // Call ended, needs disposition
  callTimeline: TimelineEvent[];
  
  // Audio state
  muted: boolean;
  held: boolean;
  
  // Actions
  dial: (to: string, from?: string) => Promise<void>;
  hangUp: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDTMF: (digit: string) => void;
  submitDisposition: (code: string) => void;
}
```

**Implementation**:
```typescript
export function useLiveKitClient() {
  const [room, setRoom] = useState<Room | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [callDuration, setCallDuration] = useState(0);
  
  // Initialize on mount
  useEffect(() => {
    initLiveKit();
  }, []);
  
  const initLiveKit = async () => {
    // Get token from edge function
    const { data } = await supabase.functions.invoke('livekit-token');
    
    // Connect to LiveKit
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    
    await room.connect(data.wsUrl, data.token);
    setRoom(room);
    setCallState('idle');
  };
  
  const dial = async (to: string, from?: string) => {
    setCallState('connecting');
    
    // Call edge function to place call
    const { data } = await supabase.functions.invoke('livekit-call-control', {
      body: { action: 'dial', to, from }
    });
    
    if (data.success) {
      setCallState('ringing');
      // Wait for participant_joined webhook to set 'active'
    }
  };
  
  // Listen for room events
  useEffect(() => {
    if (!room) return;
    
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (participant.identity.startsWith('sip_')) {
        setCallState('active');
      }
    });
    
    room.on(RoomEvent.ParticipantDisconnected, () => {
      setCallState('idle');
      setAwaitingDisposition(true);
    });
  }, [room]);
  
  return { isRegistered: !!room, callState, dial, hangUp, ... };
}
```

---

### 4.2 useDialerQueue (hooks/use-dialer-queue.ts)

**Purpose**: Manage agent's daily lead queue.

**Returns**:
```typescript
{
  currentLead: QueueContact | null;  // Current lead to call
  totalAssigned: number;             // Total leads assigned today
  contactedToday: number;            // Leads contacted today
  remainingToday: number;            // Remaining in queue
  stats: {
    remaining: number;
    completed: number;
    callbacks: number;
    deferred: number;
    nextRetryAt: Date | null;
  };
  loading: boolean;
  fetchNextLead: () => Promise<void>;
  disposeLead: (code: string, notes: string, startedAt: string, duration: number) => Promise<string>;
  skipLead: () => Promise<void>;
}
```

**Queue Loading Logic**:
```typescript
const loadQueue = async () => {
  const today = todayDateString();
  const recentCutoff = new Date(Date.now() - 60 * 60 * 1000); // 60 min
  
  // 1. Get today's assigned leads
  const { data: ccRows } = await supabase
    .from('campaign_contacts')
    .select('..., contact:contacts!inner(*)')
    .eq('assigned_agent_id', userId)
    .eq('assigned_date', today)
    .eq('assignment_status', 'assigned');
  
  // 2. Check suppression sources (parallel)
  const [dncRes, attemptsRes, contactedRes] = await Promise.all([
    // DNC check
    supabase.from('dnc_entries').select('phone_e164').in('phone_e164', phones),
    // Recent dispositions
    supabase.from('call_attempts').select('contact_id, disposition, created_at')
      .in('contact_id', contactIds).order('created_at', { ascending: false }),
    // Today's contacted count
    supabase.from('call_attempts').select('contact_id', { count: 'exact' })
      .eq('agent_id', userId).gte('created_at', startOfToday)
  ]);
  
  // 3. Filter queue
  const filtered = rows.filter(r => {
    if (dncPhones.has(r.contact.phone_e164)) return false;
    if (SUPPRESS_DISPOSITIONS.has(latestDisposition)) return false;
    if (recentlyCalled.has(r.contact_id)) return false;
    return true;
  });
  
  setQueue(filtered);
};
```

---

### 4.3 useAgentStatus (hooks/use-agent-status.ts)

**Purpose**: Manage agent availability status.

**Statuses**:
- `offline`: Not logged in or unavailable
- `available`: Ready to receive calls
- `on_call`: Currently on a call
- `break`: Temporarily unavailable
- `wrap_up`: Post-call wrap-up time

**Returns**:
```typescript
{
  status: AgentStatus;
  updateStatus: (status: AgentStatus) => Promise<void>;
  isCallable: boolean;  // Can make/receive calls
}
```

---

### 4.4 useCampaignPhones (hooks/use-campaign-phones.ts)

**Purpose**: Manage outbound caller ID pool.

**Returns**:
```typescript
{
  phones: OutboundNumber[];
  getNextOutboundNumber: () => Promise<OutboundNumber | null>;
  markUsed: (id: string) => void;
}
```

---

## 5. Dialer Components

### 5.1 LeadCard (components/dialer/LeadCard.tsx)

**Purpose**: Display current lead information.

**Props**: `lead: QueueContact | null`

**Features**:
- Contact details (name, phone, address)
- Edit mode: Inline editing of contact fields
- Attempt counter
- Lead attributes (owner/renter, home value, credit rating)

**Edit Logic**:
```typescript
const saveEdit = async () => {
  const updates = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    phone_e164: normalizePhone(form.phone).e164,
    // ...
  };
  
  await supabase.from('contacts').update(updates).eq('id', lead.contact_id);
  
  // Mutate in place for immediate UI update
  Object.assign(lead, updates);
};
```

---

### 5.2 DialPad (components/dialer/DialPad.tsx)

**Purpose**: Manual number dialing interface.

**Features**:
- Number input with formatting
- Quick dial buttons
- Recent numbers list
- Validation (E.164 format)

**Props**:
```typescript
{
  onDial: (e164: string, raw: string) => void;
  disabled: boolean;
  disabledReason?: string;
  onDtmf: (digit: string) => void;
  dtmfEnabled: boolean;
}
```

---

### 5.3 DispositionPanel (components/dialer/DispositionPanel.tsx)

**Purpose**: Post-call disposition selection.

**Dispositions**:
- Appointment Booked → Opens AppointmentModal
- Callback → Opens CallbackModal
- DNC
- Wrong Number
- Voicemail
- No Answer
- Busy
- Not Interested
- Connected
- Already Customer

**Props**:
```typescript
{
  disabled: boolean;
  onDispose: (code: string) => void;
}
```

---

### 5.4 CallbackModal (components/dialer/CallbackModal.tsx)

**Purpose**: Schedule callback time.

**Features**:
- Date/time picker (respects contact timezone)
- Priority selection
- Notes field
- Prevents scheduling in the past

**Logic**:
```typescript
const handleSave = async () => {
  // Validate: callback must be in future
  if (callbackAt <= new Date()) {
    toast.error('Callback time must be in the future');
    return;
  }
  
  await supabase.from('callbacks').insert({
    contact_id: lead.contact_id,
    agent_id: user.id,
    callback_at: callbackAt.toISOString(),
    priority,
    notes
  });
  
  // Then dispose as 'callback'
  onDispose('callback');
};
```

---

### 5.5 AppointmentModal (components/dialer/AppointmentModal.tsx)

**Purpose**: Book in-home or virtual appointments.

**Form Fields**:
- Appointment type (in_home, virtual, phone_call)
- Date/time picker with timezone
- Address (pre-filled from contact, editable)
- Job type dropdown
- Urgency level
- Notes for technician
- Handoff notes for closer

**Save Logic**:
```typescript
const saveAppointment = async () => {
  const { data: appointment } = await supabase.from('appointments').insert({
    contact_id: lead.contact_id,
    agent_id: user.id,
    campaign_id: campaignId,
    appointment_at: form.dateTime,
    appointment_type: form.type,
    address: form.address,
    job_type: form.jobType,
    urgency: form.urgency,
    notes: form.notes,
    handoff_notes: form.handoffNotes
  }).select().single();
  
  // Link to call attempt
  await supabase.from('call_attempts').update({
    appointment_id: appointment.id
  }).eq('id', callAttemptId);
};
```

---

### 5.6 WrapUpModal (components/dialer/WrapUpModal.tsx)

**Purpose**: Post-call summary and next steps.

**Features**:
- Call duration display
- Quick disposition buttons
- Notes field
- Follow-up task creation

---

### 5.7 CallTimeline (components/dialer/CallTimeline.tsx)

**Purpose**: Visual timeline of current call events.

**Events Shown**:
- Call started
- Connected
- Muted/Unmuted
- Held/Unheld
- DTMF sent
- Call ended

---

### 5.8 ContactActivityTimeline (components/dialer/ContactActivityTimeline.tsx)

**Purpose**: Full history of contact interactions.

**Data Sources**:
- call_attempts (all calls)
- callbacks (scheduled callbacks)
- appointments (booked appointments)
- notes (agent notes)
- ai_summaries (call summaries)

**Display**: Chronological timeline with icons and filters.

---

### 5.9 ScriptDrawer (components/dialer/ScriptDrawer.tsx)

**Purpose**: Display campaign scripts and talking points.

**Features**:
- Campaign-specific scripts
- Objection handlers
- Searchable content
- Collapsible sections

---

### 5.10 AudioControls (components/dialer/AudioControls.tsx)

**Purpose**: Mute, hold, and volume controls.

**Props**:
```typescript
{
  muted: boolean;
  held: boolean;
  onToggleMute: () => void;
  onToggleHold: () => void;
  callActive: boolean;
}
```

---

## 6. Layout Components

### 6.1 AppLayout (components/layout/AppLayout.tsx)

**Structure**:
- Top navigation bar with logo, user menu
- Left sidebar with navigation links
- Main content area (renders child routes)
- Footer (optional)

**Responsive**: Sidebar collapses to hamburger menu on mobile.

---

### 6.2 RoleGuard (components/layout/RoleGuard.tsx)

**Usage**: Wrap routes to restrict access by role.

```tsx
<Route path="/admin" element={
  <RoleGuard allowedRoles={['admin']}>
    <AdminPage />
  </RoleGuard>
} />
```

---

## 7. Settings Components

### 7.1 Campaign Settings

**Components**:
- `DialModeSelector`: Click-to-call / Power / Auto / Predictive
- `PredictiveSettings`: Ratio, abandon rate limits
- `CallerIdPool`: Manage outbound numbers
- `CampaignScripts`: Training materials editor

---

### 7.2 User Management

**Components**:
- `UserList`: Table of users with roles
- `UserForm`: Create/edit user modal
- `RoleSelector`: Multi-select roles
- `CompanySelector`: Assign to company

---

### 7.3 Integration Settings

**Components**:
- `LiveKitConfig`: LiveKit URL, API key inputs
- `TelnyxConfig`: SIP trunk settings
- `RecordingSettings`: Enable/disable, retention
- `AISettings`: Summary generation toggle

---

## 8. Data Flow Patterns

### 8.1 Call Flow (User Action → Database)

```
Agent clicks "Call"
  ↓
Dialer.tsx calls dial(phone, from)
  ↓
useLiveKitClient calls supabase.functions.invoke('livekit-call-control')
  ↓
Edge function creates LiveKit room + SIP participant
  ↓
Edge function inserts call_sessions record
  ↓
LiveKit webhook sends participant_joined
  ↓
livekit-webhook edge function updates call_sessions.status = 'answered'
  ↓
UI reflects connected state
  ↓
Agent hangs up
  ↓
useLiveKitClient shows awaiting disposition
  ↓
Agent selects disposition
  ↓
handleDispose calls disposeLead()
  ↓
Database RPC complete_dial_attempt updates records
  ↓
Webhook triggers ai-call-summary
  ↓
AI summary stored in ai_summaries
```

### 8.2 Queue Refresh Flow

```
Component mounts or user clicks "Refresh"
  ↓
useDialerQueue.loadQueue() called
  ↓
Parallel queries:
  - campaign_contacts (today's assignments)
  - dnc_entries (suppression list)
  - call_attempts (recent dispositions)
  ↓
Client-side filtering removes suppressed leads
  ↓
Queue state updated
  ↓
LeadCard displays currentLead
```

---

## 9. Error Handling

### 9.1 Global Error Boundary

**ErrorBoundary.tsx**: Catches React errors, shows fallback UI.

### 9.2 Toast Notifications

**Usage**:
```typescript
import { toast } from 'sonner';

// Success
toast.success('Call completed');

// Error
toast.error('Failed to place call: ' + error.message);

// Loading
const promise = supabase.rpc('complete_dial_attempt');
toast.promise(promise, {
  loading: 'Saving...',
  success: 'Disposition saved',
  error: 'Failed to save'
});
```

### 9.3 Form Validation

**Pattern**:
```typescript
const validate = (): boolean => {
  const errors: string[] = [];
  
  if (!form.phone) errors.push('Phone is required');
  if (!isValidPhone(form.phone)) errors.push('Invalid phone format');
  
  if (errors.length > 0) {
    toast.error(errors.join(', '));
    return false;
  }
  return true;
};
```

---

## 10. Performance Optimizations

### 10.1 Code Splitting

**Route-based lazy loading**:
```typescript
const Dialer = lazy(() => import('@/pages/Dialer'));
const Campaigns = lazy(() => import('@/pages/Campaigns'));
```

### 10.2 Data Fetching

**TanStack Query patterns**:
```typescript
// Cache and deduplicate
const { data } = useQuery({
  queryKey: ['campaigns', companyId],
  queryFn: fetchCampaigns,
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 10 * 60 * 1000  // 10 minutes
});

// Real-time polling for live data
const { data: agentStatus } = useQuery({
  queryKey: ['agent-status'],
  queryFn: fetchAgentStatus,
  refetchInterval: 5000  // Poll every 5 seconds
});

// Optimistic updates
const mutation = useMutation({
  mutationFn: updateLead,
  onMutate: async (newLead) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['lead', newLead.id]);
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(['lead', newLead.id]);
    
    // Optimistically update
    queryClient.setQueryData(['lead', newLead.id], newLead);
    
    return { previous };
  },
  onError: (err, newLead, context) => {
    // Rollback on error
    queryClient.setQueryData(['lead', newLead.id], context?.previous);
  }
});
```

### 10.3 Virtual Scrolling

**For large lists** (contacts, call history):
```typescript
import { Virtualizer } from '@tanstack/react-virtual';

const ContactList = ({ contacts }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,  // Row height
  });
  
  return (
    <div ref={parentRef} style={{ height: 400, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <ContactRow key={item.key} contact={contacts[item.index]} />
        ))}
      </div>
    </div>
  );
};
```

---

## 11. State Management Summary

### Server State (TanStack Query)
- Campaigns list
- Contacts
- Call history
- Agent statuses
- Queue data

### Client State (React Context)
- Authentication (AuthProvider)
- LiveKit connection (useLiveKitClient internal state)
- Active call state

### Local Component State
- Form inputs
- Modal open/close
- Selected items
- UI toggles

### URL State (React Router)
- Current page
- Selected campaign (query params)
- Filters

---

## 12. Component Checklist for Reproduction

### Required Shadcn/UI Components
```bash
npx shadcn add button card input select dialog badge avatar
npx shadcn add table tabs scroll-area separator
npx shadcn add toast sonner alert alert-dialog
npx shadcn add dropdown-menu navigation-menu sheet
npx shadcn add calendar popover command
```

### Required Third-Party Libraries
```json
{
  "livekit-client": "^2.x",
  "@tanstack/react-query": "^5.x",
  "@supabase/supabase-js": "^2.x",
  "react-router-dom": "^6.x",
  "lucide-react": "latest",
  "sonner": "latest",
  "date-fns": "^3.x",
  "zod": "^3.x"
}
```

---

*Document Version: 1.0*
*Component Count: 100+*
*Generated: May 2026*

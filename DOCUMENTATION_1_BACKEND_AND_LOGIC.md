# Summit Voice CRM - Backend & Core Logic Documentation

## 1. System Overview

**Summit Voice CRM** is a full-featured power dialer and CRM system built for sales teams, call centers, and appointment-setting operations. The system handles lead management, campaign management, telephony (VoIP calling), appointment scheduling, and technician dispatch.

### Core Technology Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Telephony**: LiveKit WebRTC + Telnyx SIP Trunking
- **Mobile**: React Native (technician app)
- **Authentication**: Supabase Auth with JWT

---

## 2. Database Architecture

### 2.1 Core Tables

#### **profiles**
User profile data extending Supabase auth.users
- `id`, `user_id`, `email`, `display_name`, `avatar_url`
- `agent_status`: online/offline/ready/on_call/break/wrap_up
- `is_active`, `company_id`

#### **user_roles**
Role-based access control (RBAC)
- Roles: `admin`, `manager`, `team_leader`, `agent`, `technician`, `confirmer`, `client`
- Many-to-many: users can have multiple roles

#### **companies / client_accounts**
Multi-tenant company structure
- Company profiles for clients using the system
- `name`, `status`, `settings` (JSON)

#### **contacts**
Lead/contact database
- `first_name`, `last_name`, `phone_e164`, `phone_raw`
- `address`, `city`, `state`, `zip_code`, `county`
- `email`, `owner_renter`, `home_value`, `household_income`, `credit_rating`
- `lead_status`, `lead_source`, `cool_notes`
- `timezone`, `company_id`

#### **campaigns**
Outbound calling campaigns
- `name`, `status` (draft/active/paused/completed/archived)
- `dial_mode`: `click_to_call`, `power_dial`, `auto_dial`, `predictive`
- `predictive_ratio`, `max_abandon_rate`
- `company_id`, `client_account_id`

#### **campaign_contacts**
Many-to-many: campaigns to contacts
- `campaign_id`, `contact_id`
- `assigned_agent_id`, `assigned_date`, `assignment_status`
- `attempts`, `last_attempted_at`, `dial_status`
- `priority_band` (high/medium/low), `priority_score`

#### **call_attempts** (Primary call logging)
- `agent_id`, `contact_id`, `campaign_id`
- `started_at`, `answered_at`, `ended_at`, `duration_seconds`
- `outcome`: enum of call results
- `disposition`: string code (appointment_booked, dnc, wrong_number, etc.)
- `notes`, `call_source` (manual/campaign/predictive)
- `telnyx_call_control_id`, `telnyx_call_id`, `provider_used`
- `recording_url`, `manual_dialed_e164`

#### **call_sessions**
Active/live call tracking
- `agent_id`, `lead_id`, `campaign_id`
- `status` (initiated/answered/completed/ended)
- `telnyx_call_control_id`, `telnyx_call_leg_id` (maps to LiveKit room)
- `recording_id`, `recording_url`, `recording_status`
- `direction` (outbound/inbound)

#### **call_recordings**
Post-call recording metadata
- `call_session_id`, `call_attempt_id`
- `recording_url`, `download_url`, `duration_seconds`
- `status` (pending/processing/completed/failed)

#### **call_dispositions**
Disposition tracking with callbacks
- `lead_id`, `agent_id`, `campaign_id`, `call_session_id`
- `disposition`, `callback_datetime`, `notes`

#### **callbacks**
Scheduled callback queue
- `contact_id`, `agent_id`, `campaign_id`
- `callback_at`, `priority`, `status` (pending/completed/cancelled)

#### **appointments**
Booked appointments
- `contact_id`, `agent_id`, `campaign_id`, `closer_user_id`
- `appointment_at`, `appointment_type`, `status`
- `address`, `city`, `state`, `zip_code`
- `job_type`, `urgency`, `notes`, `handoff_notes`

#### **technicians**
Field technician profiles
- `user_id`, `name`, `phone`, `email`, `skills` (array)
- `service_regions`, `is_active`

#### **technician_availability**
Technician scheduling slots
- `technician_id`, `day_of_week`, `start_time`, `end_time`
- `is_available`, `timezone`

#### **caller_ids / campaign_outbound_numbers**
Outbound caller ID pool
- `phone_e164`, `company_id`, `campaign_id`, `user_id`
- `area_code`, `state`, `city`
- `is_active`, `health_status`, `cooldown_until`
- `times_used`, `last_used_at`
- Rate limiting: `max_calls_per_hour`, `max_calls_per_day`

#### **ai_summaries**
AI-generated call summaries
- `call_attempt_id`, `agent_id`, `contact_id`, `campaign_id`
- `summary`, `sentiment`, `objections` (JSON array)
- `next_action`, `recommended_action`, `lead_quality_score`
- `generation_status` (pending/completed/failed)

#### **ai_training_materials**
Training content for agents
- `company_id`, `campaign_id`, `title`, `content`
- `material_type` (script/objection_handler/knowledge_check)
- `difficulty`, `scenario`, `tags`, `sort_order`

#### **audit_events / admin_audit_log**
Compliance and audit logging
- `event_type`, `actor_id`, `actor_role`, `company_id`
- `entity_type`, `entity_id`, `metadata` (JSON)
- `ip_address`, `user_agent`, `occurred_at`

### 2.2 Database Enums

```sql
call_outcome: appointment_booked | callback_scheduled | connected | dnc_request | wrong_number | voicemail | no_answer | busy | not_interested | abandoned | unknown

appointment_status: scheduled | confirmed | completed | cancelled | no_show
appointment_type: in_home | virtual | phone_call

callback_status: pending | completed | cancelled
urgency_level: low | medium | high | emergency
training_material_type: script | objection_handler | knowledge_check | simulation
number_health_status: healthy | warning | suspended
```

### 2.3 Key Database Functions (RPC)

#### **get_next_lead_for_agent(_agent_id, _campaign_id)**
Returns the next eligible lead for an agent with:
- Priority scoring (high > medium > low)
- Exclusion of recently called contacts (60-minute window)
- Exclusion of DNC numbers
- Exclusion of suppressed dispositions (wrong_number, not_interested)
- Round-robin within priority bands

#### **complete_dial_attempt(_call_attempt_id, _disposition, _notes, _callback_at)**
Atomic disposition application that:
- Updates call_attempts with outcome
- Creates callback record if disposition=callback
- Updates campaign_contacts dial_status
- Inserts call_dispositions record
- Triggers follow-up task creation

#### **assign_leads_to_agent(_agent_id, _campaign_id, _count)**
Bulk lead assignment for daily queue building

#### **get_agent_daily_stats(_agent_id, _date)**
Returns contacted count, appointment count, time logged

---

## 3. Core Business Logic

### 3.1 Lead Queue Management

#### Daily Queue Build Process
1. Admin/trigger runs `assign_leads_to_agent` RPC
2. System selects leads from campaign_contacts where:
   - `assignment_status` = 'unassigned' OR previous assignment older than 1 day
   - Not in DNC list
   - Last disposition not in (wrong_number, not_interested, dnc)
   - Within agent's allowed states/regions (if configured)
3. Updates `assigned_agent_id`, `assigned_date`, `assignment_status`

#### Queue Filtering (useDialerQueue hook)
The frontend queue filters out:
- DNC numbers (checked against dnc_entries table)
- Leads with terminal dispositions on most recent attempt
- Leads contacted within last 60 minutes
- Already-completed leads

### 3.2 Dial Modes

#### Click-to-Call
- Agent manually clicks "Call" for each lead
- Full control over timing

#### Power Dial
- System auto-advances to next lead after disposition
- Auto-dials after 800ms delay when new lead loaded
- Agent can pause/resume

#### Auto Dial
- Similar to power dial but faster progression
- Shorter delays between calls

#### Predictive Dial
- Server-side pacing algorithm
- Calculates `target_calls = available_agents * pacing_ratio - active_calls`
- Connects answered calls to available agents
- Uses historical connect rate for ratio adjustment

### 3.3 Caller ID Selection Logic

The `resolveCaller` function in livekit-call-control:

1. **Explicit override**: If `from` number provided, use it
2. **Smart pool selection**:
   - Query campaign_outbound_numbers for user's active numbers
   - Score by: exact area code match (+100), state match (+35), city match (+10), campaign-specific (+20)
   - Sort by: score desc, last_used_at asc, times_used asc
3. **Update tracking**: Increment times_used, set last_used_at
4. **Fallback**: Return first available number

### 3.4 Call State Management

#### States
- `idle`: No active call
- `connecting`: Call initiated, room created
- `ringing`: SIP call in progress
- `active`: Call answered, participant joined
- `held`: Call on hold
- `ending`: Hangup initiated

#### State Transitions
```
idle → connecting: dial() called
connecting → ringing: SIP participant created
ringing → active: participant_joined webhook received
active → ending: hangUp() called
ending → idle: participant_left webhook or timeout
```

### 3.5 Disposition Handling

#### Valid Dispositions
- `appointment_booked`: Creates appointment record
- `callback`: Opens callback scheduler modal
- `dnc`: Adds to DNC list
- `wrong_number`: Marks number invalid
- `voicemail`, `no_answer`, `busy`: Retry scheduling
- `not_interested`: Terminal disposition
- `connected`: Positive contact, no appointment
- `already_customer`: Existing customer

#### Disposition Workflow
1. Agent selects disposition in UI
2. `handleDispose()` called in Dialer.tsx
3. Special dispositions (callback, appointment) open modals
4. `disposeLead()` from use-dialer-queue hook executes:
   - Updates campaign_contacts status
   - Creates call_dispositions record
   - If callback: creates callbacks record
   - Updates call_attempts with outcome
5. `advanceToNext()` loads next lead
6. If power dial active: sets `autoDialPendingRef` for auto-dial

### 3.6 Appointment Scheduling

#### Flow
1. Agent clicks "Add Appointment" or selects appointment_booked disposition
2. AppointmentModal opens with:
   - Date/time picker (respects contact timezone)
   - Address verification (pre-filled from contact)
   - Job type selection
   - Urgency level
   - Notes/handoff notes
3. On save:
   - Creates appointments record
   - Links to call_attempt via booked_from_call_id
   - Creates technician appointment if technician selected
4. Confirmer queue shows appointments needing confirmation

### 3.7 Technician Dispatch

#### Scheduling Algorithm (schedule-best-tech edge function)
1. Parse appointment requirements (skills, region, urgency)
2. Query available technicians matching criteria
3. Score by: availability fit, skill match %, distance/proximity
4. Return ranked list with confidence scores

#### Technician Mobile App
- React Native app for field technicians
- Views assigned appointments
- Updates appointment status (en_route, arrived, completed)
- Collects customer signature/photos

---

## 4. Telephony Architecture

### 4.1 LiveKit Integration

#### Components
- **LiveKit Cloud**: WebRTC signaling and media routing
- **Telnyx SIP Trunk**: PSTN connectivity
- **LiveKit SIP**: Bridges WebRTC to SIP

#### Call Flow
1. Agent loads dialer → `useLiveKitClient` connects to LiveKit room
2. Agent dials number → livekit-call-control edge function:
   - Creates LiveKit room
   - Creates SIP participant via Telnyx trunk
   - LiveKit calls Telnyx → Telnyx calls PSTN number
3. Call answered → SIP participant joins room
4. Audio flows: Agent WebRTC ↔ LiveKit ↔ Telnyx SIP ↔ PSTN

### 4.2 LiveKit Client Hook (useLiveKitClient)

#### Responsibilities
- Initialize LiveKit Room with token from livekit-token edge function
- Handle room events (connected, disconnected, reconnecting)
- Manage audio tracks (publish microphone, subscribe to remote)
- Call control: dial(), hangUp(), toggleMute(), toggleHold()
- DTMF sending via LiveKit data messages
- Track call state and expose to UI

#### State Tracking
- `isRegistered`: Connected to LiveKit
- `isCallActive`: Call in progress (not idle)
- `callState`: idle/connecting/ringing/active/held/ending
- `awaitingDisposition`: Call ended, need disposition
- `callDuration`: Active call timer
- `callTimeline`: Event log for UI display

### 4.3 Edge Function: livekit-token

#### Purpose
Generate JWT access tokens for browser LiveKit SDK

#### Logic
- Verify Supabase JWT from Authorization header
- Create LiveKit JWT with:
  - `identity`: agent_{user_id}
  - `video.grants`: roomJoin, canPublish, canSubscribe
  - Expiration: 1 hour
- Return: `{ token, identity, wsUrl }`

### 4.4 Edge Function: livekit-call-control

#### Actions

**dial**
1. Resolve caller ID via `resolveCaller()`
2. Create LiveKit room (5-min empty timeout, max 4 participants)
3. Create SIP participant via `/twirp/livekit.SIP/CreateSIPParticipant`
4. Optionally start Egress recording
5. Insert call_sessions record
6. Return: `{ success, call, session, selectedCallerId }`

**hangup**
1. Remove SIP participant from room
2. Delete LiveKit room
3. Update call_sessions status to 'ended'

**transfer**
1. Create new SIP participant for transfer target
2. Optionally remove original participant
3. Update call_sessions status to 'transferring'

**resolve-caller**
- Standalone caller ID selection without dialing

### 4.5 Edge Function: livekit-webhook

#### Purpose
Receive LiveKit server events, update database

#### Events Handled
- `participant_joined` (SIP): Update call_sessions status to 'answered'
- `participant_left` (SIP): Update status to 'completed'
- `room_finished`: Cleanup any incomplete sessions
- `egress_ended`: Recording complete
  - Update call_sessions with recording_url
  - Create call_recordings entry
  - Trigger ai-call-summary edge function

#### Signature Verification
- LiveKit signs webhooks with HS256
- Verify JWT signature using LIVEKIT_API_SECRET
- Verify payload sha256 matches request body

### 4.6 Recording

#### LiveKit Egress
- Server-side composite recording (audio only)
- OGG format stored to LiveKit Cloud
- Webhook provides download URL when complete
- Download URL saved to call_recordings table

#### Recording Lifecycle
1. Dial with `enable_recording=true` → Egress starts
2. Call ends → Egress stops automatically
3. `egress_ended` webhook received
4. Recording URL stored, linked to call_attempt
5. AI summary triggered

---

## 5. AI Features

### 5.1 AI Call Summary

#### Edge Function: ai-call-summary

**Trigger**: Webhook after recording complete, or manual invocation

**Process**:
1. Fetch call recording URL from call_recordings
2. If transcription exists, use it; else transcribe audio
3. Send to LLM with prompt for:
   - Call summary (2-3 sentences)
   - Sentiment (positive/neutral/negative)
   - Objections raised (array)
   - Recommended next action
   - Lead quality score (1-10)
4. Store results in ai_summaries table
5. Update generation_status

### 5.2 Training Materials

#### Structure
- Hierarchical: parent_id for organizing into courses/modules
- Types: script, objection_handler, knowledge_check, simulation
- Scoring: difficulty levels, tags for search
- Campaign-specific or company-wide

#### Training Simulation
- Edge function: training-simulation
- AI-powered role-play scenarios
- Evaluates agent responses against rubric
- Provides feedback and scoring

---

## 6. Security & Compliance

### 6.1 Authentication
- Supabase Auth with JWT
- Password policies enforced
- Session management with refresh tokens
- Email verification for new accounts

### 6.2 Authorization (RLS)

#### Row Level Security Policies
- **profiles**: Users see own profile; admins see all in company
- **contacts**: Users see contacts in assigned campaigns
- **campaigns**: Admin full access; agents see assigned campaigns
- **call_attempts**: Users see own calls; managers see team calls
- **call_recordings**: Same as call_attempts
- **appointments**: Based on agent_id, closer_user_id, or confirmer role

#### Role Hierarchy
```
admin: Full system access
manager: Company-level access, user management
  └── team_leader: Team management, QA functions
      └── agent: Own calls, assigned campaigns
          └── confirmer: Appointment confirmations
technician: Own appointments only
client: Client portal (own account data only)
```

### 6.3 Audit Logging

#### Tracked Events
- User login/logout
- Call started/completed
- Disposition applied
- Appointment created/modified
- Lead assignment changes
- Settings modifications
- Failed authentication attempts

#### Audit Event Structure
- Actor identification (id, role)
- Entity identification (type, id)
- Metadata (JSON of relevant data)
- IP address and user agent
- Timestamp

### 6.4 Data Retention
- Call recordings: Configurable (default 90 days)
- Audit logs: 1 year minimum
- Call attempts: Indefinite
- Soft deletes for contacts (preserve history)

---

## 7. Workflow Engine

### 7.1 Predictive Dialer Engine

#### Edge Function: predictive-dialer-engine

**Schedule**: Cron-triggered or manual tick

**Algorithm**:
1. Verify campaign active and dial_mode = 'predictive'
2. Count available agents (status = available/on_call)
3. Count active calls
4. Calculate connect rate from last 100 calls
5. Calculate abandon rate
6. Compute pacing ratio:
   ```
   pacing_ratio = min(configured_ratio, 1 / connect_rate)
   if abandon_rate >= max_abandon_rate:
       pacing_ratio *= 0.8  // Dial down 20%
   ```
7. target_calls = available_agents * pacing_ratio - active_calls
8. For each target call:
   - Get next lead via get_next_lead_for_agent
   - Place call via livekit-call-control
   - Place call in queue without agent assignment
9. When call answered:
   - Find available agent
   - Connect call to agent
   - Update call_sessions.agent_id

### 7.2 Follow-Up Tasks

#### Auto-Creation Rules
- `voicemail` disposition → Create callback task (retry in 2 hours)
- `no_answer` disposition → Create callback task (retry next day)
- `busy` disposition → Create callback task (retry in 30 minutes)
- `callback` disposition → Create callback at scheduled time

#### Task Assignment
- Round-robin among available agents
- Priority based on callback time and lead score
- Escalation if task ages beyond threshold

---

## 8. Integration Points

### 8.1 Telnyx SIP

#### Configuration
- SIP Trunk ID configured in environment
- Telnyx handles PSTN termination/origination
- Caller ID managed through Telnyx number pool

#### Webhooks
- Telnyx call events forwarded to LiveKit
- LiveKit translates to WebRTC events

### 8.2 LiveKit Cloud

#### Required Configuration
```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud (client-side)
```

### 8.3 Supabase

#### Required Configuration
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 9. Data Flow Diagrams

### 9.1 Outbound Call Flow
```
[Agent UI]
    ↓ clicks dial
[Dialer.tsx]
    ↓ calls dial()
[useLiveKitClient]
    ↓ requests token
[livekit-token edge fn]
    ↓ returns JWT
[useLiveKitClient]
    ↓ connects to LiveKit room
[livekit-call-control edge fn]
    ↓ POST /dial
    ├─ Creates LiveKit room
    ├─ Creates SIP participant (Telnyx trunk)
    └─ Inserts call_sessions record
[Telnyx SIP]
    ↓ calls PSTN number
[Lead Phone]
    ↓ answers
[LiveKit webhook]
    ↓ participant_joined event
[livekit-webhook edge fn]
    ↓ Updates call_sessions.status = 'answered'
[Agent UI]
    ↓ shows connected state
```

### 9.2 Disposition Flow
```
[Agent UI]
    ↓ selects disposition
[Dialer.tsx handleDispose]
    ├─ If callback/appointment: open modal
    └─ Else: proceed
[use-dialer-queue disposeLead]
    ├─ Update campaign_contacts
    ├─ Create call_dispositions record
    ├─ Create callback record (if callback)
    └─ Update call_attempts
[Dialer.tsx]
    ↓ advanceToNext()
[use-dialer-queue]
    ↓ fetchNextLead()
[Database]
    ↓ get_next_lead_for_agent RPC
[Agent UI]
    ↓ shows next lead
```

### 9.3 Recording Flow
```
[livekit-call-control]
    ↓ dial with enable_recording=true
[LiveKit Egress]
    ↓ starts recording
[Call ends]
    ↓ egress stops
[LiveKit webhook]
    ↓ egress_ended event
[livekit-webhook edge fn]
    ├─ Update call_sessions.recording_url
    ├─ Create call_recordings entry
    └─ Trigger ai-call-summary
[ai-call-summary edge fn]
    ├─ Fetch recording
    ├─ Transcribe
    ├─ Generate summary via LLM
    └─ Store in ai_summaries
```

---

## 10. Error Handling & Recovery

### 10.1 Call Failures

#### No Answer / Busy
- Automatic retry scheduling via follow-up tasks
- Exponential backoff (configurable)

#### Failed to Connect (Technical)
1. Retry dial up to 3 times
2. If still failing: mark campaign_contact.dial_status = 'failed'
3. Alert admin if failure rate exceeds threshold

#### WebSocket Disconnection
- LiveKit client auto-reconnects
- If during call: attempt to recover call state
- If recovery fails: prompt agent to disposition

### 10.2 Database Failures

#### Connection Loss
- Supabase client auto-retries
- Queue operations cached locally, sync on reconnect

#### Transaction Failures
- Disposition application is idempotent
- Can be re-applied without duplicate records

---

## 11. Performance Considerations

### 11.1 Database Optimization

#### Indexes
- campaign_contacts: (assigned_agent_id, assigned_date, assignment_status)
- call_attempts: (agent_id, created_at), (contact_id, created_at)
- contacts: (phone_e164), (company_id)
- callbacks: (callback_at, status)

#### Partitioning
- call_attempts: Range partition by created_at (monthly)
- call_recordings: Separate storage table

### 11.2 Caching Strategy
- Campaign list cached for 5 minutes
- Agent status in local state, synced to DB
- Queue pre-fetched, filtered client-side

---

## 12. Environment Variables Reference

### Required
```
# Supabase
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# LiveKit (Telephony)
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
VITE_LIVEKIT_URL

# Telnyx (PSTN)
TELNYX_API_KEY
TELNYX_SIP_TRUNK_ID

# AI (Optional)
OPENAI_API_KEY  # For call summaries
```

### Optional
```
# Feature Flags
VITE_ENABLE_RECORDING=true
VITE_ENABLE_AI_SUMMARY=true
VITE_ENABLE_PREDICTIVE_DIALER=true

# Limits
MAX_CALLS_PER_AGENT=50
MAX_CONCURRENT_CAMPAIGNS=10
RECORDING_RETENTION_DAYS=90
```

---

## 13. Known Issues & Bug Fixes Needed

### Critical
1. **Race condition in power dial**: Auto-dial can trigger before disposition is fully saved
2. **Call state desync**: WebSocket disconnect during call may leave orphan call_sessions
3. **Memory leak in useLiveKitClient**: Event listeners not cleaned up on unmount

### Medium
1. **Recording link expiration**: LiveKit recording URLs expire, need refresh mechanism
2. **Timezone handling**: Inconsistent timezone conversion in callback scheduling
3. **Queue pagination**: Large queues cause UI lag, need virtual scrolling

### Minor
1. **DTMF tones**: Not always transmitted reliably through Telnyx SIP
2. **Audio quality**: Krisp noise suppression not always enabled
3. **Mobile responsiveness**: Technician app layout issues on small screens

---

*Document Version: 1.0*
*Generated: May 2026*
*Project: Summit Voice CRM*

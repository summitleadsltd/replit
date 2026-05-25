# Summit Voice CRM - Edge Functions Documentation

## Complete Edge Function Reference

This document provides comprehensive specifications for all Supabase Edge Functions in the Summit Voice CRM system.

---

## 1. Authentication & User Management

### 1.1 create-user

**Path**: `supabase/functions/create-user/index.ts`

**Purpose**: Admin-only function to create new user accounts with role assignment.

**Authentication**: JWT required (Supabase auth)

**Authorization**: `admin` role only

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "display_name": "John Doe",
  "role": "agent",
  "company_id": "uuid",
  "send_invite": true
}
```

**Logic Flow**:
1. Verify caller is admin via user_roles table
2. Create user in Supabase Auth
3. Create profile record
4. Assign role in user_roles
5. If send_invite: trigger email invitation

**Response**:
```json
{
  "success": true,
  "user_id": "uuid",
  "profile_id": "uuid"
}
```

**Error Responses**:
- 401: Unauthorized (not logged in)
- 403: Forbidden (not admin)
- 400: Invalid email/password format
- 409: Email already exists

---

### 1.2 manage-user

**Path**: `supabase/functions/manage-user/index.ts`

**Purpose**: Update, deactivate, or delete user accounts.

**Authentication**: JWT required

**Authorization**: `admin` or `manager` (managers can only manage users in their company)

**Actions**: `update`, `deactivate`, `reactivate`, `delete`

**Request Body** (update):
```json
{
  "user_id": "uuid",
  "action": "update",
  "updates": {
    "display_name": "New Name",
    "email": "new@example.com",
    "role": "team_leader",
    "is_active": true,
    "company_id": "uuid"
  }
}
```

**Logic Flow**:
1. Verify caller has permission to modify target user
2. Apply updates:
   - Auth user: email, password
   - Profile: display_name, is_active, company_id
   - Roles: add/remove in user_roles
3. If deactivating: sign out all sessions

**Response**:
```json
{
  "success": true,
  "action": "update",
  "affected_tables": ["auth.users", "profiles", "user_roles"]
}
```

---

## 2. Telephony Functions

### 2.1 livekit-token

**Path**: `supabase/functions/livekit-token/index.ts`
**Verify JWT**: TRUE

**Purpose**: Generate LiveKit access tokens for browser WebRTC connection.

**Authentication**: Bearer token (Supabase JWT)

**Request Body** (optional):
```json
{
  "roomName": "specific_room_name"
}
```

**Logic Flow**:
1. Extract user from Supabase JWT
2. Generate LiveKit JWT with HS256:
   ```javascript
   {
     iss: LIVEKIT_API_KEY,
     sub: `agent_${user_id}`,
     iat: now,
     exp: now + 3600,
     video: {
       room: roomName || "",
       roomJoin: true,
       canPublish: true,
       canSubscribe: true,
       canPublishData: true
     }
   }
   ```
3. Return token, identity, and WebSocket URL

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "identity": "agent_550e8400_e29b_41d4",
  "wsUrl": "wss://your-project.livekit.cloud"
}
```

**Environment Variables Required**:
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_URL`

---

### 2.2 livekit-call-control

**Path**: `supabase/functions/livekit-call-control/index.ts`
**Verify JWT**: TRUE

**Purpose**: Primary telephony control function for dialing, hanging up, and transfers.

**Authentication**: Bearer token required

**Actions**: `dial`, `hangup`, `transfer`, `resolve-caller`, `register-session`

---

#### Action: dial

**Request Body**:
```json
{
  "action": "dial",
  "to": "+15551234567",
  "from": "+15559876543",
  "contactId": "uuid",
  "campaignId": "uuid"
}
```

**Logic Flow**:

1. **Resolve Caller ID** (if from not provided):
   ```
   resolveCaller() algorithm:
   - Query campaign_outbound_numbers for user's active numbers
   - Score by: exact area code match (+100), state match (+35), city match (+10)
   - Sort by: score desc, last_used_at asc, times_used asc
   - Update selected number: times_used++, last_used_at=now
   ```

2. **Create LiveKit Room**:
   ```javascript
   POST /twirp/livekit.RoomService/CreateRoom
   {
     name: `call_${user_id}_${timestamp}`,
     empty_timeout: 300,
     max_participants: 4
   }
   ```

3. **Create SIP Participant** (outbound call):
   ```javascript
   POST /twirp/livekit.SIP/CreateSIPParticipant
   {
     sip_trunk_id: TELNYX_SIP_TRUNK_ID,
     sip_call_to: normalized_phone,
     room_name: roomName,
     participant_identity: `sip_${contactId}_${timestamp}`,
     display_name: callerId,
     krisp_enabled: true
   }
   ```

4. **Start Recording** (if enabled):
   ```javascript
   POST /twirp/livekit.Egress/StartRoomCompositeEgress
   {
     room_name: roomName,
     audio_only: true,
     file_outputs: [{ file_type: "OGG", filepath: `recordings/${roomName}.ogg` }]
   }
   ```

5. **Create Database Record**:
   ```sql
   INSERT INTO call_sessions (
     agent_id, lead_id, campaign_id,
     telnyx_call_control_id: sipParticipantId,
     telnyx_call_leg_id: roomName,
     recording_id: egressId,
     direction: 'outbound',
     from_number, to_number,
     status: 'initiated'
   )
   ```

**Response**:
```json
{
  "success": true,
  "call": {
    "call_control_id": "sip_participant_id",
    "room_name": "call_userid_timestamp"
  },
  "session": { /* call_sessions row */ },
  "selectedCallerId": "+15559876543",
  "selectionReason": "Selected Campaign Pool Number"
}
```

---

#### Action: hangup

**Request Body**:
```json
{
  "action": "hangup",
  "callControlId": "sip_participant_id",
  "roomName": "call_userid_timestamp"
}
```

**Logic Flow**:
1. Remove SIP participant from room
2. Delete LiveKit room
3. Update call_sessions:
   ```sql
   UPDATE call_sessions
   SET status = 'ended', ended_at = NOW()
   WHERE telnyx_call_control_id = callControlId
   ```

---

#### Action: transfer

**Request Body**:
```json
{
  "action": "transfer",
  "callControlId": "current_sip_id",
  "roomName": "call_userid_timestamp",
  "transferTo": "+15551112222"
}
```

**Logic Flow**:
1. Create new SIP participant for transfer target
2. Remove original SIP participant
3. Update call_sessions status to 'transferring'

---

#### Action: resolve-caller

**Request Body**:
```json
{
  "action": "resolve-caller",
  "to": "+15551234567",
  "contactId": "uuid",
  "campaignId": "uuid",
  "from": null
}
```

**Logic Flow**: Same caller ID selection as dial action, but without placing call.

**Response**:
```json
{
  "success": true,
  "callerId": "+15559876543",
  "selectionReason": "Selected Campaign Pool Number",
  "numberId": "uuid",
  "source": "campaign_pool"
}
```

---

#### Action: register-session

**Request Body**:
```json
{
  "action": "register-session",
  "callControlId": "sip_id",
  "from": "+15559876543",
  "to": "+15551234567",
  "contactId": "uuid",
  "campaignId": "uuid",
  "status": "initiated"
}
```

**Logic Flow**: Creates or updates call_sessions record.

---

### 2.3 livekit-webhook

**Path**: `supabase/functions/livekit-webhook/index.ts`
**Verify JWT**: FALSE (LiveKit calls directly with webhook signature)

**Purpose**: Receive and process LiveKit server events.

**Security**: Webhook signature verification with HS256

**Signature Verification**:
```javascript
1. Extract JWT from Authorization header
2. Verify HMAC signature using LIVEKIT_API_SECRET
3. Verify payload.iss matches LIVEKIT_API_KEY
4. Verify payload.sha256 matches SHA-256 of request body
```

**Event Handlers**:

#### participant_joined (SIP)
```javascript
if (participant.identity.startsWith('sip_')) {
  await supabase.from('call_sessions').update({
    status: 'answered',
    answered_at: new Date().toISOString()
  }).eq('telnyx_call_leg_id', room.name);
}
```

#### participant_left (SIP)
```javascript
await supabase.from('call_sessions').update({
  status: 'completed',
  ended_at: new Date().toISOString()
}).eq('telnyx_call_leg_id', room.name);
```

#### room_finished
```javascript
await supabase.from('call_sessions').update({
  status: 'completed',
  ended_at: new Date().toISOString()
}).eq('telnyx_call_leg_id', room.name).is('ended_at', null);
```

#### egress_ended (Recording Complete)
```javascript
// 1. Update session with recording URL
await supabase.from('call_sessions').update({
  recording_url: egress_info.file_results[0].download_url,
  recording_status: 'completed'
}).eq('telnyx_call_leg_id', egress_info.room_name);

// 2. Create call_recordings entry
await supabase.from('call_recordings').insert({
  call_session_id: session.id,
  call_attempt_id: attempt?.id,
  agent_id: session.agent_id,
  lead_id: session.lead_id,
  recording_url,
  download_url: recording_url,
  duration_seconds,
  format: 'ogg',
  status: 'completed'
});

// 3. Update call_attempts
await supabase.from('call_attempts').update({
  recording_url
}).eq('id', attempt.id);

// 4. Trigger AI summary
await fetch(`${SUPABASE_URL}/functions/v1/ai-call-summary`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  body: JSON.stringify({ callAttemptId: attempt.id })
});
```

**Always Returns**: HTTP 200 (prevents LiveKit retries)

---

## 3. Dialer Functions

### 3.1 power-dialer-next

**Path**: `supabase/functions/power-dialer-next/index.ts`
**Verify JWT**: TRUE

**Purpose**: Get the next eligible lead for power dialing.

**Request Body**:
```json
{
  "campaign_id": "uuid"
}
```

**Logic Flow**:
1. Verify user authentication
2. Call database function:
   ```sql
   SELECT * FROM get_next_lead_for_agent(
     _agent_id := user.id,
     _campaign_id := campaign_id
   );
   ```
3. Return lead or null if queue exhausted

**Response**:
```json
{
  "contact": {
    "contact_id": "uuid",
    "campaign_contact_id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "phone_e164": "+15551234567",
    "state": "CA",
    "city": "Los Angeles",
    "zip_code": "90210",
    "attempts": 2,
    "priority_band": "high",
    "priority_score": 95
  }
}
```

**Database Function: get_next_lead_for_agent**

Logic:
```sql
-- 1. Find leads assigned to agent today
-- 2. Exclude: DNC numbers, recently called (60 min), terminal dispositions
-- 3. Order by: priority_band DESC, priority_score DESC, created_at ASC
-- 4. Lock row and return
```

---

### 3.2 predictive-dialer-engine

**Path**: `supabase/functions/predictive-dialer-engine/index.ts`
**Verify JWT**: TRUE

**Purpose**: Server-side predictive dialer pacing and call placement.

**Authorization**: `admin`, `manager`, or `team_leader`

**Request Body**:
```json
{
  "campaign_id": "uuid"
}
```

**Algorithm**:

1. **Get Campaign Settings**:
   ```sql
   SELECT dial_mode, predictive_ratio, max_abandon_rate
   FROM campaigns WHERE id = campaign_id;
   -- Must be 'predictive' mode and 'active' status
   ```

2. **Count Available Agents**:
   ```sql
   SELECT COUNT(*) FROM agent_sessions
   WHERE campaign_id = ? AND status IN ('available', 'on_call');
   ```

3. **Count Active Calls**:
   ```sql
   SELECT COUNT(*) FROM call_sessions
   WHERE campaign_id = ? AND status IN ('initiated', 'answered');
   ```

4. **Calculate Historical Rates** (last 100 calls):
   ```javascript
   connectRate = connectedCalls / totalCalls || 0.3;  // Default 30%
   abandonRate = (abandonedCalls / totalCalls) * 100;
   ```

5. **Compute Pacing Ratio**:
   ```javascript
   pacingRatio = Math.min(configuredRatio, 1 / Math.max(connectRate, 0.1));
   
   // Dial down if abandon rate too high
   if (abandonRate >= maxAbandonRate) {
     pacingRatio = Math.max(1, pacingRatio * 0.8);
   }
   ```

6. **Calculate Target Calls**:
   ```javascript
   targetCalls = Math.max(0, Math.ceil(availableAgents * pacingRatio) - activeCalls);
   ```

7. **Place Calls**:
   ```javascript
   for (let i = 0; i < targetCalls; i++) {
     // Get next lead
     const lead = await getNextLead(agentSessions[i].agent_id, campaignId);
     
     // Place call via livekit-call-control
     await fetch('/functions/v1/livekit-call-control', {
       body: JSON.stringify({
         action: 'dial',
         to: lead.phone_e164,
         contactId: lead.contact_id,
         campaignId: campaignId
       })
     });
   }
   ```

**Response**:
```json
{
  "success": true,
  "placed": 5,
  "target": 7,
  "available_agents": 10,
  "active_calls": 3,
  "pacing_ratio": 1.25,
  "connect_rate": 32.5,
  "abandon_rate": 2.1,
  "errors": []  // Any call placement failures
}
```

---

## 4. Recording Functions

### 4.1 get-recording-url

**Path**: `supabase/functions/get-recording-url/index.ts`
**Verify JWT**: TRUE

**Purpose**: Get fresh signed URL for call recording (handles expiration).

**Request Body**:
```json
{
  "recording_id": "uuid",
  "call_attempt_id": "uuid"
}
```

**Logic Flow**:
1. Look up recording by ID or call_attempt_id
2. Verify user has access (owns the call or is manager/admin)
3. If URL expired, request fresh URL from LiveKit API
4. Return download URL and metadata

**Response**:
```json
{
  "success": true,
  "download_url": "https://...",
  "duration_seconds": 245,
  "format": "ogg",
  "expires_at": "2026-05-20T12:00:00Z"
}
```

---

## 5. AI Functions

### 5.1 ai-call-summary

**Path**: `supabase/functions/ai-call-summary/index.ts`
**Verify JWT**: TRUE (or service role for webhook)

**Purpose**: Generate AI summary of call recording.

**Request Body**:
```json
{
  "callAttemptId": "uuid"
}
```

**Logic Flow**:

1. **Fetch Recording**:
   ```sql
   SELECT cr.recording_url, ca.agent_id, ca.contact_id, ca.campaign_id
   FROM call_recordings cr
   JOIN call_attempts ca ON ca.id = cr.call_attempt_id
   WHERE ca.id = callAttemptId;
   ```

2. **Get or Create Transcription**:
   - Check call_transcripts table
   - If not exists, transcribe audio (Whisper API or similar)

3. **Generate Summary** (LLM call):
   ```javascript
   const prompt = `
     Summarize this sales call transcript in 2-3 sentences.
     Identify: sentiment (positive/neutral/negative),
     objections raised,
     recommended next action,
     lead quality score (1-10).
     
     Transcript: ${transcript}
   `;
   ```

4. **Store Results**:
   ```sql
   INSERT INTO ai_summaries (
     call_attempt_id, agent_id, contact_id, campaign_id,
     summary, sentiment, objections, next_action,
     lead_quality_score, generation_status
   ) VALUES (...);
   ```

**Response**:
```json
{
  "success": true,
  "summary": {
    "summary": "Customer expressed interest in solar panels but concerned about upfront cost. Scheduled follow-up with financing options.",
    "sentiment": "positive",
    "objections": ["cost_concern"],
    "recommended_action": "send_financing_info",
    "lead_quality_score": 8,
    "generation_status": "completed"
  }
}
```

---

## 6. Technician Functions

### 6.1 schedule-best-tech

**Path**: `supabase/functions/schedule-best-tech/index.ts`
**Verify JWT**: TRUE

**Purpose**: Find best-matched technician for an appointment.

**Request Body**:
```json
{
  "appointment_id": "uuid",
  "required_skills": ["solar_install", "electrical"],
  "region": "Los Angeles",
  "urgency": "high",
  "preferred_date": "2026-05-25"
}
```

**Scoring Algorithm**:
```javascript
score = 0;

// Skill match (0-40 points)
const skillMatch = technician.skills.filter(s => 
  requiredSkills.includes(s)
).length / requiredSkills.length;
score += skillMatch * 40;

// Region match (0-30 points)
if (technician.service_regions.includes(region)) {
  score += 30;
}

// Availability (0-20 points)
if (availableOnDate) {
  score += 20;
} else if (availableWithin24Hours) {
  score += 10;
}

// Workload (0-10 points)
// Prefer less busy technicians
const workload = getTechnicianAppointmentCount(tech.id, week);
score += Math.max(0, 10 - workload);
```

**Response**:
```json
{
  "success": true,
  "recommendations": [
    {
      "technician_id": "uuid",
      "name": "Mike Johnson",
      "score": 92,
      "confidence": "high",
      "reason": "Full skill match, available on preferred date"
    },
    {
      "technician_id": "uuid",
      "name": "Sarah Chen",
      "score": 78,
      "confidence": "medium",
      "reason": "Partial skill match, available next day"
    }
  ]
}
```

---

## 7. Training Functions

### 7.1 training-simulation

**Path**: `supabase/functions/training-simulation/index.ts`
**Verify JWT**: TRUE

**Purpose**: AI-powered training simulation and evaluation.

**Request Body**:
```json
{
  "scenario_id": "uuid",
  "agent_response": "I'm calling about solar panels...",
  "conversation_history": [
    { "role": "customer", "content": "Hello?" },
    { "role": "agent", "content": "Hi, this is John..." }
  ]
}
```

**Logic Flow**:
1. Load scenario from ai_training_materials
2. Send to LLM with evaluation rubric:
   - Did agent follow script?
   - Proper objection handling?
   - Tone and professionalism?
   - Next steps suggested?
3. Return score and feedback

**Response**:
```json
{
  "success": true,
  "evaluation": {
    "score": 85,
    "max_score": 100,
    "breakdown": {
      "script_adherence": 20,
      "objection_handling": 18,
      "professionalism": 25,
      "next_steps": 22
    },
    "feedback": "Good job asking about current energy bills. Try to address the cost objection earlier by mentioning financing options.",
    "recommended_materials": ["uuid1", "uuid2"]
  }
}
```

---

## 8. Data Management Functions

### 8.1 delete-import

**Path**: `supabase/functions/delete-import/index.ts`
**Verify JWT**: TRUE

**Purpose**: Rollback a contact import by import_batch_id.

**Authorization**: Admin only

**Request Body**:
```json
{
  "import_batch_id": "uuid",
  "dry_run": false
}
```

**Logic Flow**:
1. Count contacts to be deleted
2. If dry_run: return counts only
3. Delete in order:
   - campaign_contacts (linking records)
   - call_dispositions
   - call_attempts
   - contacts (main records)
4. Log deletion in audit_events

**Response**:
```json
{
  "success": true,
  "deleted": {
    "contacts": 150,
    "campaign_contacts": 150,
    "call_attempts": 0,
    "call_dispositions": 0
  },
  "dry_run": false
}
```

---

### 8.2 delete-all-contacts

**Path**: `supabase/functions/delete-all-contacts/index.ts`
**Verify JWT**: TRUE

**Purpose**: Bulk delete contacts for a company (GDPR/data cleanup).

**Authorization**: Admin only

**Request Body**:
```json
{
  "company_id": "uuid",
  "confirm": "DELETE_ALL_CONTACTS",
  "preserve_recordings": true
}
```

**Logic Flow**:
1. Verify confirmation code
2. Archive call_recordings if preserve_recordings=true
3. Delete all related records in proper order (respecting FKs)
4. Log deletion in audit_events

---

## 9. Monitoring Functions

### 9.1 call-monitor

**Path**: `supabase/functions/call-monitor/index.ts`
**Verify JWT**: TRUE

**Purpose**: Real-time call monitoring for supervisors (barge/whisper modes).

**Authorization**: `admin`, `manager`, or `team_leader`

**Request Body** (start monitoring):
```json
{
  "action": "start_monitoring",
  "agent_id": "uuid",
  "mode": "barge"  // or "whisper", "listen"
}
```

**Logic Flow**:
1. Find agent's active call_session
2. Join supervisor to LiveKit room as hidden participant
3. Mode behaviors:
   - `listen`: Muted, agent unaware
   - `whisper`: Can talk to agent only, customer doesn't hear
   - `barge`: Full participant, both hear supervisor

**Response**:
```json
{
  "success": true,
  "monitoring_session_id": "uuid",
  "room_name": "call_agentid_timestamp",
  "livekit_token": "eyJhbG..."
}
```

---

## 10. Function Invocation Patterns

### From Frontend (Browser)
```typescript
const { data, error } = await supabase.functions.invoke('livekit-call-control', {
  body: { action: 'dial', to: '+15551234567', contactId: 'uuid' }
});
```

### From Edge Function to Edge Function
```typescript
await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/livekit-call-control`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ action: 'dial', ... })
});
```

### Scheduled/Cron
Configure in `config.toml`:
```toml
[functions.predictive-dialer-engine]
schedule = "*/30 * * * *"  # Every 30 seconds
```

---

## 11. Error Handling Standards

### Response Format
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { /* Additional context */ }
}
```

### HTTP Status Codes
- 200: Success
- 400: Bad Request (validation error)
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 409: Conflict (duplicate, etc.)
- 500: Internal Server Error

### Common Error Codes
| Code | Description |
|------|-------------|
| AUTH_REQUIRED | Missing authentication |
| INSUFFICIENT_PERMISSIONS | Role not authorized |
| INVALID_CAMPAIGN | Campaign not found or inactive |
| NO_CALLER_ID | No outbound number available |
| LIVEKIT_ERROR | LiveKit API call failed |
| DATABASE_ERROR | Database operation failed |
| RATE_LIMITED | Too many requests |

---

## 12. Environment Variables Reference

### All Edge Functions
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Telephony Functions
```
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
TELNYX_SIP_TRUNK_ID
```

### AI Functions
```
OPENAI_API_KEY
OPENAI_MODEL=gpt-4o
```

### Optional
```
VITE_ENABLE_RECORDING=true
LOG_LEVEL=debug
```

---

## 13. Testing Edge Functions

### Local Testing
```bash
supabase functions serve livekit-token --env-file .env
```

### HTTP Test
```bash
curl -X POST http://localhost:54321/functions/v1/livekit-token \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roomName": "test"}'
```

---

*Document Version: 1.0*
*Edge Functions Count: 14*
*Generated: May 2026*

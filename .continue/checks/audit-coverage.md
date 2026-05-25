---
name: Audit Coverage
description: Ensures high-signal actions call logEvent() for compliance and security auditing.
---

# Audit Coverage

## Context

The Summit CRM uses a centralized audit logging system via `src/lib/audit.ts`. High-signal actions must be logged for:
- Security compliance (who did what, when)
- Debugging production issues
- QA/coaching workflows
- Data integrity verification

Per `src/lib/audit.ts`: "audit failures should be silent for users" — but the events themselves must be captured.

## What to Check

### 1. Authentication Events

**REQUIRED** audit events for auth flows:
- `auth.login` — successful login
- `auth.logout` — explicit logout
- `auth.signup` — new account creation

**GOOD example:**
```typescript
// src/hooks/use-auth.tsx
import { logEvent } from "@/lib/audit";

await logEvent({
  type: "auth.login",
  entity_type: "user",
  entity_id: user.id,
  metadata: { method: "password" }
});
```

### 2. Contact Mutations

**REQUIRED** audit events for contact operations:
- `contact.created` — new contact added
- `contact.updated` — contact fields changed
- `contact.deleted` — single contact removed
- `contact.bulk_deleted` — mass deletion (especially critical)
- `contact.bulk_assigned` — reassignment operations
- `contact.imported` — CSV import completion

**CRITICAL PATTERN:** Bulk operations must log ONE event with metadata containing affected IDs, not N individual events.

```typescript
// GOOD: One event for bulk operation
await logEvent({
  type: "contact.bulk_deleted",
  metadata: { count: ids.length, ids: ids.slice(0, 100) }
});
```

### 3. Campaign Lifecycle

**REQUIRED** audit events:
- `campaign.created` — new campaign
- `campaign.updated` — settings changed
- `campaign.status_changed` — published/paused/archived
- `campaign.deleted` — campaign removal

### 4. Call Operations

**REQUIRED** audit events:
- `call.started` — agent initiates call
- `call.ended` — call completes
- `call.disposition_saved` — outcome recorded
- `call.skipped` — lead skipped in queue

**FROM CODEBASE:** `use-livekit-client.ts` has `submitDisposition()` — ensure it logs to audit.

### 5. Administrative Actions

**REQUIRED** and high-severity:
- `user.role_changed` — privilege escalation
- `user.deactivated` — account disabled
- `user.activated` — account re-enabled
- `telephony.provider_updated` — provider config changes

## Red Flags (FAIL)

These patterns indicate missing audit coverage:

1. **Direct Supabase mutations without logEvent:**
```typescript
// BAD: No audit trail
await supabase.from("contacts").delete().eq("id", contactId);
```

2. **Bulk operations without aggregate logging:**
```typescript
// BAD: Silent bulk delete
await Promise.all(ids.map(id => 
  supabase.from("campaign_contacts").delete().eq("id", id)
));
```

3. **Role changes not logged:**
```typescript
// BAD: Privilege escalation without audit
await supabase.from("user_roles").update({ role: "admin" }).eq("user_id", userId);
```

## Audit Event Types Reference

Complete list from `src/lib/audit.ts`:

**Auth:** `auth.login`, `auth.logout`, `auth.signup`

**Contacts:** `contact.created`, `contact.updated`, `contact.deleted`, `contact.bulk_deleted`, `contact.bulk_assigned`, `contact.imported`

**Campaigns:** `campaign.created`, `campaign.updated`, `campaign.status_changed`, `campaign.deleted`

**Calls:** `call.started`, `call.ended`, `call.disposition_saved`, `call.skipped`

**Appointments:** `appointment.booked`, `appointment.rescheduled`, `appointment.cancelled`, `appointment.completed`

**QA:** `qa.scored`, `feedback.given`

**DNC:** `dnc.added`, `dnc.removed`

**Admin:** `user.role_changed`, `user.deactivated`, `user.activated`, `telephony.provider_updated`, `telephony.number_added`, `telephony.number_removed`, `caller_id.activated`, `caller_id.deactivated`

**Predictive:** `predictive_engine.ticked`

## Key Files to Review

- `src/hooks/use-contacts.ts` — CRUD operations
- `src/hooks/use-dialer-queue.ts` — call lifecycle
- `src/hooks/use-auth.tsx` — authentication
- `src/components/settings/*` — admin configuration changes
- `src/pages/Campaign*.tsx` — campaign management
- `src/lib/csv-import.ts` — import operations

## Exclusions

Audit logging is NOT required for:
- Read-only operations (queries, fetches)
- UI state changes (modal open/close, filters)
- Navigation events
- Client-side caching operations

## Fix Guidance

When adding missing audit coverage:

```typescript
import { logEvent } from "@/lib/audit";

// After successful mutation
await logEvent({
  type: "contact.deleted",
  entity_type: "contact",
  entity_id: contactId,
  metadata: { reason: "user_request" }
});
```

Note: `logEvent()` never throws — failures are silent to avoid breaking user actions.

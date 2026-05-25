#!/bin/bash
# Spanish Agent Features Deployment Script
# Run these commands in order

echo "=== Step 1: Run Database Migration ==="
supabase db push

echo ""
echo "=== Step 2: Regenerate Supabase Types ==="
echo "Replace YOUR_PROJECT_ID with your actual Supabase project ID"
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts

echo ""
echo "=== Step 3: Deploy Edge Functions ==="
supabase functions deploy agent-presence
supabase functions deploy assign-daily-leads
supabase functions deploy check-appointments
supabase functions deploy livekit-call-control

echo ""
echo "=== Step 4: Enable Realtime for agent_presence ==="
echo "In Supabase Dashboard: Database > Replication > Realtime"
echo "Enable 'agent_presence' table for realtime updates"

echo ""
echo "=== Deployment Complete ==="
echo "Test the features using the manual test scripts provided."

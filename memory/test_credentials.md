# Test Credentials — Summit Leads CRM

These credentials were provided by the user during this session — they belong to the live
Supabase project (`wggmfykmabandkllqodc`). Treat as production secrets.

## Admin login (web app)
- URL: `https://e86eeddc-8326-471d-9978-31d7f2d67f57.preview.emergentagent.com`
- Email: `info@summitleadsltd.com`
- Password: `123456789`
- Role: `admin`

## Supabase project
- URL: `https://wggmfykmabandkllqodc.supabase.co`
- Project ref: `wggmfykmabandkllqodc`
- Anon key & publishable key: see `/app/.env`
- Service role key: managed by the user

## LiveKit
- URL: `wss://windsurf-crm-dialer-a8yh1c00.livekit.cloud`
- API key/secret: stored in Supabase Edge Function secrets

## Telnyx
- API key + SIP trunk ID: stored in Supabase Edge Function secrets

## NOT YET CONFIGURED
- `OPENAI_API_KEY` — required for Training Hub + AI Call Summary. Add via Supabase dashboard
  → Project Settings → Edge Functions → Secrets, then redeploy `training-simulation` and
  `ai-call-summary`.

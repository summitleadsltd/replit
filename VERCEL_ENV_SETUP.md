# Vercel Environment Variables Setup Guide

## Required Environment Variables

The following environment variables need to be configured in your Vercel project for the application to function properly:

### Frontend Variables (VITE_*)
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase publishable key
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_SUPABASE_PROJECT_ID` - Your Supabase project reference ID
- `VITE_LIVEKIT_URL` - Your LiveKit server URL (optional, for dialer features)

## Method 1: Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with its corresponding value:

### Production Environment
```
VITE_SUPABASE_URL = https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = your-supabase-publishable-key
VITE_SUPABASE_ANON_KEY = your-supabase-anon-key
VITE_SUPABASE_PROJECT_ID = your-project-ref
VITE_LIVEKIT_URL = wss://your-project.livekit.cloud (optional)
```

4. Make sure to select **Production**, **Preview**, and **Development** environments for each variable
5. Click **Save**

## Method 2: Vercel CLI

You can also add environment variables using the Vercel CLI:

```bash
# Add variables for all environments
npx vercel env add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
npx vercel env add VITE_SUPABASE_ANON_KEY
npx vercel env add VITE_SUPABASE_PROJECT_ID
npx vercel env add VITE_LIVEKIT_URL
```

When prompted, select which environments to add the variable to (Production, Preview, Development).

## Getting Your Credentials

### From Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the following:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **Project Reference** (the part after .supabase.co) → `VITE_SUPABASE_PROJECT_ID`

### For LiveKit (if using dialer features)
1. Go to your LiveKit Cloud dashboard
2. Copy your WebSocket URL
3. Format: `wss://your-project.livekit.cloud`

## After Adding Variables

Once you've added the environment variables:

1. **Redeploy the application:**
```bash
npx vercel --prod --yes
```

2. **Verify the deployment** by visiting your Vercel URL

## Current Deployment

Your application is currently deployed at:
- **Production:** https://summit-gnlx45tcl-summit-s-projects.vercel.app
- **Inspect:** https://vercel.com/summit-s-projects/summit-crm/87e4GUVYRhCcNtn1EiDqSv27dVgC

## Troubleshooting

### 401 Unauthorized Error
This error occurs when:
- Environment variables are not set
- Invalid Supabase credentials
- Supabase project is paused or deleted

### Next Steps
1. Add the environment variables using either method above
2. Redeploy the application
3. Test the landing page at your Vercel URL
4. Test the login functionality with valid Supabase credentials

## Custom Domain Setup (Optional)

Once environment variables are configured, you can add a custom domain:

1. In Vercel dashboard, go to **Settings** → **Domains**
2. Add your custom domain (e.g., crm.yourcompany.com)
3. Configure DNS records as instructed by Vercel
4. Update Supabase Authentication → URL Configuration with your new domain

## Security Notes

- Never commit `.env` files to version control
- Use different keys for development and production
- Rotate keys periodically if compromised
- The `VITE_` prefix is required for Vite to expose variables to the frontend
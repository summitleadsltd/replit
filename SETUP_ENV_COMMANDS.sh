# Run these commands one by one in your terminal
# Each command will prompt you to paste the value and select environments

cd "c:\Users\cyber sev3n\Downloads\Remix of Summit Voice CRM"

# Command 1: Add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_URL production
# When prompted, paste: https://wggmfykmabandkllqodc.supabase.co
# Select environments: Production, Preview, Development

# Command 2: Add VITE_SUPABASE_PUBLISHABLE_KEY
npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
# When prompted, paste: sb_publishable_UVm3bjywKtJGbtOygPVOCQ_NPHsxBEW
# Select environments: Production, Preview, Development

# Command 3: Add VITE_SUPABASE_ANON_KEY
npx vercel env add VITE_SUPABASE_ANON_KEY production
# When prompted, paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZ21meWttYWJhbmRrbGxxb2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzk4NjIsImV4cCI6MjA5MzY1NTg2Mn0.5flmKwkYT9IDMYlp3gZYnOqEZYC7p0oFGpRkRv_OizA
# Select environments: Production, Preview, Development

# Command 4: Add VITE_SUPABASE_PROJECT_ID
npx vercel env add VITE_SUPABASE_PROJECT_ID production
# When prompted, paste: wggmfykmabandkllqodc
# Select environments: Production, Preview, Development

# Command 5: Add VITE_LIVEKIT_URL
npx vercel env add VITE_LIVEKIT_URL production
# When prompted, paste: wss://windsurf-crm-dialer-a8yh1c00.livekit.cloud
# Select environments: Production, Preview, Development

# After adding all variables, redeploy:
npx vercel --prod --yes
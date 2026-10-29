// The ONE Supabase client of the app (browser only). The session lives in localStorage and is
// refreshed automatically. Everything it can read or write is limited by RLS in the database,
// and the publishable key in src/config/site.ts allows nothing more.

import { createClient } from '@supabase/supabase-js'
import { SUPABASE } from '@/config/site'

export const supabase = createClient(SUPABASE.url, SUPABASE.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'pkce',
    // Links from Supabase e-mails are handled explicitly by /auth/potwierdz (pages/auth/AuthConfirm.vue),
    // so the client must not consume ?code= on its own on random pages.
    detectSessionInUrl: false,
  },
})

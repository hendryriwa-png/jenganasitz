import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )
  
  const { email, password, isAdmin, isOAuth, provider, redirectTo } = await req.json()
  
  if (isOAuth && provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    })
    return new Response(JSON.stringify({ oauthUrl: data.url }), { headers: corsHeaders })
  }
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 401, headers: corsHeaders })
  
  // Check admin role
  if (isAdmin) {
    const { data: userData } = await supabase.auth.getUser(data.session.access_token)
    if (userData.user?.app_metadata?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Not admin' }), { status: 403, headers: corsHeaders })
    }
  }
  
  return new Response(JSON.stringify({ user: data.user, session: data.session }), { headers: corsHeaders })
})
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
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { email, password, name, role, ...extra } = await req.json()
  
  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role }
  })
  
  if (authError) return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: corsHeaders })
  
  const userId = authData.user.id
  
  // Insert into role-specific table
  const table = role === 'vendor' ? 'vendors' : 'customers'
  const profileData = { id: userId, email, name, ...extra }
  
  const { error: profileError } = await supabase.from(table).insert(profileData)
  if (profileError) {
    await supabase.auth.admin.deleteUser(userId)
    return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: corsHeaders })
  }
  
  return new Response(JSON.stringify({ user: authData.user }), { headers: corsHeaders })
})
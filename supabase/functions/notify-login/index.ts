import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  const { role, email, status } = await req.json()
  
  // Log to a table or send email/notification
  console.log('Login alert:', { role, email, status, at: new Date().toISOString() })
  
  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
})
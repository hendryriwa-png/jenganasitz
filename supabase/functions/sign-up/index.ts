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

  // Insert profile using RPC to bypass PostgREST schema cache
  let profileError = null

  if (role === 'vendor') {
    const { error } = await supabase.rpc('create_vendor_profile', {
      p_user_id: userId,
      p_email: email,
      p_name: name,
      p_role: 'vendor',
      p_store_name: extra.storeName || name,
      p_phone: extra.phone || '',
      p_brela: extra.brela || null,
      p_licence: extra.licence || null,
      p_national_id: extra.nationalId || null,
      p_tin: extra.tin || null,
      p_bank_account: extra.bankAccount || null,
      p_photo: extra.photo || null,
      p_region: extra.region || null,
      p_lat: extra.lat || null,
      p_lng: extra.lng || null,
      p_vendor_type: extra.vendorType || null
    })
    profileError = error
  } else {
    const { error } = await supabase.rpc('create_customer_profile', {
      p_user_id: userId,
      p_email: email,
      p_name: name,
      p_role: 'customer',
      p_phone: extra.phone || '',
      p_national_id: extra.nationalId || '',
      p_tin: extra.tin || '',
      p_payment_account: extra.paymentAccount || ''
    })
    profileError = error
  }

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId)
    return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ user: authData.user }), { headers: corsHeaders })
})
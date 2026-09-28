import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: corsHeaders })
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders })
  
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  
  if (action === 'get-products') {
    const { data, error } = await supabase.from('products').select('*').eq('vendor_email', user.email).eq('deleted', false)
    return new Response(JSON.stringify({ products: data }), { headers: corsHeaders })
  }
  
  if (action === 'get-orders') {
    const { data, error } = await supabase.from('orders').select('*').contains('items', [{ vendor_email: user.email }]).order('date', { ascending: false })
    return new Response(JSON.stringify({ orders: data }), { headers: corsHeaders })
  }
  
  if (action === 'get-earnings') {
    const { data: orders } = await supabase.from('orders').select('items, payment').contains('items', [{ vendor_email: user.email }])
    // Calculate earnings logic here
    let gross = 0, fees = 0, net = 0, released = 0, pending = 0
    orders?.forEach(o => {
      o.items?.forEach((i: any) => {
        if (i.vendor_email === user.email) {
          const amount = (i.variantPrice || i.price) * i.qty
          gross += amount
          if (o.payment?.payouts?.[user.email]) {
            const p = o.payment.payouts[user.email]
            if (p.paid) released += p.amount
            else pending += p.net || 0
          }
        }
      })
    })
    return new Response(JSON.stringify({ gross, fees, net, released, pending }), { headers: corsHeaders })
  }
  
  if (action === 'request-withdrawal' && req.method === 'POST') {
    // Handle withdrawal request
    return new Response(JSON.stringify({ requested: 0 }), { headers: corsHeaders })
  }
  
  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
})
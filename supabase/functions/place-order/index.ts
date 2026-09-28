import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  const authHeader = req.headers.get('Authorization')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  
  const { cart, delivery, paymentMethod, region } = await req.json()
  
  // Group by vendor
  const vendorGroups = cart.reduce((acc, item) => {
    const vEmail = item.vendorEmail || 'unknown'
    if (!acc[vEmail]) acc[vEmail] = { email: vEmail, name: item.vendor, items: [] }
    acc[vEmail].items.push(item)
    return acc
  }, {})
  
  const orders = []
  for (const [vendorEmail, group] of Object.entries(vendorGroups)) {
    const orderId = `JN-${Date.now()}-${Math.random().toString(36).substr(2,6)}`
    const total = group.items.reduce((s, i) => s + (i.variantPrice || i.price) * i.qty, 0)
    
    const { error } = await supabase.from('orders').insert({
      id: orderId,
      customer: { name: delivery.name, phone: delivery.phone, email: user.email },
      items: group.items,
      total,
      status: 'pending',
      delivery: { ...delivery, methodName: 'Standard Delivery', cost: 0, eta: '2-3 days' },
      payment: { method: paymentMethod, methodName: paymentMethod, paid: false },
      vendor_email: vendorEmail,
      vendor_count: Object.keys(vendorGroups).length
    })
    
    if (!error) orders.push({ id: orderId, vendorEmail, total })
  }
  
  return new Response(JSON.stringify({ orders, total: orders.reduce((s, o) => s + o.total, 0) }), { headers: corsHeaders })
})
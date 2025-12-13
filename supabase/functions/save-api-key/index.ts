import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { service, key, userEmail } = await req.json()

    // Validate input
    if (!service || !key || !userEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing service, key, or userEmail' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!['claude', 'gemini', 'stability'].includes(service)) {
      return new Response(
        JSON.stringify({ error: 'Invalid service' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Upsert API key (create or update) using email as identifier
    const { data: existingKey, error: selectError } = await supabaseAdmin
      .from('api_keys')
      .select('id')
      .eq('user_email', userEmail)
      .eq('service', service)
      .single()

    let upsertError = null

    if (existingKey) {
      // Update existing key
      const { error: updateError } = await supabaseAdmin
        .from('api_keys')
        .update({
          encrypted_key: key,
          updated_at: new Date().toISOString(),
        })
        .eq('user_email', userEmail)
        .eq('service', service)
      upsertError = updateError
    } else if (!selectError || selectError.code === 'PGRST116') {
      // Insert new key (PGRST116 means no rows found)
      const { error: insertError } = await supabaseAdmin
        .from('api_keys')
        .insert({
          user_email: userEmail,
          service,
          encrypted_key: key,
          key_valid: false,
          last_validated_at: null,
        })
      upsertError = insertError
    } else {
      upsertError = selectError
    }

    if (upsertError) {
      console.error('Database error:', upsertError)
      return new Response(
        JSON.stringify({ error: `Database error: ${upsertError.message}`, details: upsertError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Log to audit table
    const { error: auditError } = await supabaseAdmin
      .from('api_key_audit_log')
      .insert({
        user_email: userEmail,
        action: 'created',
        service,
        ip_address: req.headers.get('x-forwarded-for') || null,
      })

    if (auditError) {
      console.error('Audit log error:', auditError)
      // Don't fail the request if audit logging fails
    }

    return new Response(
      JSON.stringify({ success: true, message: `API key for ${service} saved successfully` }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

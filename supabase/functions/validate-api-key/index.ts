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
    const { service, userEmail } = await req.json()

    // Validate input
    if (!service || !userEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing service or userEmail' }),
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

    // Retrieve the encrypted API key using email
    const { data: keyData, error: selectError } = await supabaseAdmin
      .from('api_keys')
      .select('encrypted_key')
      .eq('user_email', userEmail)
      .eq('service', service)
      .single()

    if (selectError || !keyData) {
      return new Response(
        JSON.stringify({ error: 'API key not found', isValid: false }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // In production, decrypt the key here and validate it with the service
    const apiKey = keyData.encrypted_key

    let isValid = false
    let validationError = null

    try {
      if (service === 'claude') {
        // Test Claude API key
        const response = await fetch('https://api.anthropic.com/v1/models', {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        })
        isValid = response.status === 200
      } else if (service === 'gemini') {
        // Test Gemini API key
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
          { method: 'GET' }
        )
        isValid = response.status === 200
      } else if (service === 'stability') {
        // Test Stability API key
        const response = await fetch(
          'https://api.stability.ai/v1/engines/list',
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            },
          }
        )
        isValid = response.status === 200
      }
    } catch (error) {
      validationError = error.message
    }

    // Update the key validation status
    const { error: updateError } = await supabaseAdmin
      .from('api_keys')
      .update({
        key_valid: isValid,
        last_validated_at: new Date().toISOString(),
      })
      .eq('user_email', userEmail)
      .eq('service', service)

    if (updateError) {
      console.error('Update error:', updateError)
    }

    // Log to audit table
    await supabaseAdmin
      .from('api_key_audit_log')
      .insert({
        user_email: userEmail,
        action: 'validated',
        service,
        ip_address: req.headers.get('x-forwarded-for') || null,
      })

    return new Response(
      JSON.stringify({
        isValid,
        validationError,
        lastValidated: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message, isValid: false }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

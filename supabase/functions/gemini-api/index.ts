import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get userEmail from query parameter or header
    const url = new URL(req.url)
    let userEmail = url.searchParams.get('userEmail') || undefined

    // Also check x-user-email header as fallback
    if (!userEmail) {
      userEmail = req.headers.get('x-user-email') || undefined
    }

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'userEmail is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Read the request body before doing anything else
    const body = await req.text()

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
      .eq('service', 'gemini')
      .single()

    if (selectError || !keyData) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // In production, decrypt the key here
    const apiKey = keyData.encrypted_key

    // Build Gemini API URL with API key
    let geminiUrl = 'https://generativelanguage.googleapis.com' + url.pathname + url.search

    // Add API key to query parameters if not already present
    const separator = geminiUrl.includes('?') ? '&' : '?'
    if (!geminiUrl.includes('key=')) {
      geminiUrl += `${separator}key=${apiKey}`
    }

    // Forward the request to Gemini API
    const geminiResponse = await fetch(geminiUrl, {
      method: req.method,
      headers: {
        'content-type': 'application/json',
      },
      body: req.method !== 'GET' ? body : undefined,
    })

    // Get response body
    const responseBody = await geminiResponse.text()

    // Log to audit table
    await supabaseAdmin
      .from('api_key_audit_log')
      .insert({
        user_email: userEmail,
        action: 'api_call',
        service: 'gemini',
        ip_address: req.headers.get('x-forwarded-for') || null,
      })

    return new Response(responseBody, {
      status: geminiResponse.status,
      headers: {
        ...corsHeaders,
        'Content-Type': geminiResponse.headers.get('content-type') || 'application/json',
      },
    })
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

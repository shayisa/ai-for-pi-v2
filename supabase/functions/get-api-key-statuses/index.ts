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
    const { userEmail } = await req.json()

    // Validate input
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing userEmail' }),
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

    // Retrieve all API key statuses for the user
    const { data: keyStatuses, error: selectError } = await supabaseAdmin
      .from('api_keys')
      .select('service, key_valid, last_validated_at')
      .eq('user_email', userEmail)

    if (selectError) {
      console.error('Error retrieving API key statuses:', selectError)
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve API key statuses', details: selectError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Transform data to match frontend expectations
    const statuses = (keyStatuses || []).map((item: any) => ({
      service: item.service,
      isValid: item.key_valid || false,
      lastValidated: item.last_validated_at,
    }))

    return new Response(
      JSON.stringify({ statuses }),
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

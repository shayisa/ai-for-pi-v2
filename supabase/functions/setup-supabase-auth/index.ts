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
    const { email, name } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log('Supabase URL:', supabaseUrl ? 'SET' : 'NOT SET')
    console.log('Service Role Key:', serviceRoleKey ? 'SET' : 'NOT SET')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase environment variables not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create admin client using service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Generate a secure random password
    function generateSecurePassword(): string {
      const length = 32
      const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-='
      let password = ''
      const array = new Uint8Array(length)
      crypto.getRandomValues(array)
      for (let i = 0; i < length; i++) {
        password += charset[array[i] % charset.length]
      }
      return password
    }

    const password = generateSecurePassword()

    console.log(`Setting up Supabase auth for user: ${email}`)

    // Try to create the user with admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        name: name || 'Google User',
        auth_provider: 'google'
      }
    })

    if (error) {
      // Check if it's because user already exists
      if (error.message?.includes('already exists') || error.message?.includes('User already registered')) {
        console.log('User already exists')

        return new Response(
          JSON.stringify({
            success: true,
            message: 'User already registered',
            email
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      console.error('Error creating user:', error)
      return new Response(
        JSON.stringify({
          error: error.message || 'Failed to create user',
          details: error
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('User created and email confirmed:', data.user?.email)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User authenticated successfully',
        user: {
          id: data.user?.id,
          email: data.user?.email
        }
      }),
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

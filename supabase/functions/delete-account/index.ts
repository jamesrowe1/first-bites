import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'You must be signed in.' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    if (body?.confirmation !== 'DELETE') {
      return json({ error: 'Deletion was not confirmed.' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')
    const legacyServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl) throw new Error('SUPABASE_URL is unavailable.')

    let secretKey = legacyServiceRole || ''
    if (secretKeysRaw) {
      const secretKeys = JSON.parse(secretKeysRaw)
      secretKey = secretKeys.default || secretKey
    }
    if (!secretKey) throw new Error('Supabase secret key is unavailable.')

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const token = authHeader.slice('Bearer '.length)
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) {
      return json({ error: 'Your sign-in could not be verified.' }, 401)
    }

    const userId = userData.user.id
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return json({ deleted: true })
  } catch (error) {
    console.error('delete-account failed', error)
    return json({ error: error instanceof Error ? error.message : 'Account deletion failed.' }, 500)
  }
})

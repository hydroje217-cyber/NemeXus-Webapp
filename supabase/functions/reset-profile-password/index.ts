import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeRole(role?: string | null) {
  return role === 'general manager' ? 'general_manager' : role;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Password reset function is missing Supabase service credentials.' }, 500);
    }

    const authorization = request.headers.get('Authorization') || '';
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: {
        headers: { Authorization: authorization },
      },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { profileId, password } = await request.json();

    if (!profileId || typeof profileId !== 'string') {
      return jsonResponse({ error: 'Missing account id.' }, 400);
    }

    if (!password || typeof password !== 'string' || password.trim().length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400);
    }

    const { data: userData, error: userError } = await callerClient.auth.getUser();

    if (userError || !userData.user) {
      return jsonResponse({ error: 'You must be signed in to reset a password.' }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (callerProfileError) {
      return jsonResponse({ error: callerProfileError.message }, 500);
    }

    const callerRole = normalizeRole(callerProfile?.role);

    if (callerRole !== 'admin' && callerRole !== 'general_manager') {
      return jsonResponse({ error: 'Only admins and general managers can reset account passwords.' }, 403);
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', profileId)
      .maybeSingle();

    if (targetProfileError) {
      return jsonResponse({ error: targetProfileError.message }, 500);
    }

    if (callerRole === 'general_manager' && normalizeRole(targetProfile?.role) === 'admin') {
      return jsonResponse({ error: 'General managers cannot reset admin account passwords.' }, 403);
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(profileId, {
      password: password.trim(),
    });

    if (updateError) {
      return jsonResponse({ error: updateError.message || 'Failed to update account password.' }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Failed to reset password.' }, 500);
  }
});

const { createClient } = require('@supabase/supabase-js');

let client = null;

const getSupabase = () => {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url) throw new Error('SUPABASE_URL belum diatur di file .env');
  if (!key && process.env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'Backend memerlukan SUPABASE_SERVICE_ROLE_KEY atau SUPABASE_SECRET_KEY, bukan publishable key.',
    );
  }
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY atau SUPABASE_SECRET_KEY belum diatur di file .env');
  }

  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
};

module.exports = { getSupabase };

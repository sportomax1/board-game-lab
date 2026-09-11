export default function handler(req, res) {
  // Return Supabase configuration from environment variables
  const supabaseConfig = {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  };

  // Validate config exists
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    return res.status(500).json({ error: 'Supabase configuration not found' });
  }

  res.status(200).json(supabaseConfig);
}

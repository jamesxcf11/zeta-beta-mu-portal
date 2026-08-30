const SUPABASE_URL = 'https://voudkciacokytdectgqc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_o2y_z3pDKAlFBPFtKVByCg_eeBET1I6';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'zbm-auth'
  }
});

window.db = db;

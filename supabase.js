import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = "COLOQUE_SUA_URL_AQUI";   // ex: https://xyzxyz.supabase.co
const SUPABASE_ANON = "COLOQUE_SUA_ANON_KEY_AQUI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

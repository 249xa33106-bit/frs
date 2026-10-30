import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hubvdfqtqmtfmvczvacy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_eL_lMolq7KwFfAol4NIaAg_1pRF1zhc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

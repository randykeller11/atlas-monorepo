import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠ Supabase not configured - some features will use file storage fallback');
}

// Create Supabase client with service role key for server-side operations
export const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Health check function
export async function checkSupabaseHealth() {
  if (!supabase) {
    return { healthy: false, reason: 'not_configured' };
  }
  
  try {
    const { data, error } = await supabase
      .from('persona_cards')
      .select('count')
      .limit(1);
    
    if (error) {
      return { healthy: false, reason: error.message };
    }
    
    return { healthy: true };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
}

// Test connection
if (supabase) {
  checkSupabaseHealth().then(result => {
    if (result.healthy) {
      console.log('✓ Supabase connected successfully');
    } else {
      console.warn(`⚠ Supabase connection issue: ${result.reason}`);
    }
  });
}

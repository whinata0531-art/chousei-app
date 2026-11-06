import { createClient } from '@supabase/supabase-js';
import { generateId } from './utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 💡 通信のたびにスマホ内の deviceGuestId をヘッダー (x-guest-id) に自動付与する
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: (url, options = {}) => {
      const headers = new Headers(options.headers);
      if (typeof window !== 'undefined') {
        let guestId = localStorage.getItem('deviceGuestId');
        if (!guestId) {
          guestId = generateId();
          localStorage.setItem('deviceGuestId', guestId);
        }
        headers.set('x-guest-id', guestId);
      }
      return fetch(url, { ...options, headers });
    },
  },
});

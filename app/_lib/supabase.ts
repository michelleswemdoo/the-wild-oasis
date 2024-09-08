import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  // {
  //   global: {
  //     headers: {
  //       Authorization: `Bearer ${session?.accessToken}`,
  //       "X-User-Id": session?.user?.id,
  //     },
  //   },
  // }
);

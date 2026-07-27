import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';

export type UsageSummary = {
  plan: 'free' | 'pro';
  aiUsed: number;
  aiLimit: number;
  minUsed: number;
  minLimit: number;
};

export function useMyUsage(enabled = true) {
  return useQuery({
    queryKey: ['usage'],
    enabled,
    queryFn: async (): Promise<UsageSummary> => {
      const { data, error } = await supabase.rpc('my_usage');
      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? data[0] : data;
      return {
        plan: (row?.plan ?? 'free') as 'free' | 'pro',
        aiUsed: Number(row?.ai_used ?? 0),
        aiLimit: Number(row?.ai_limit ?? 0),
        minUsed: Number(row?.min_used ?? 0),
        minLimit: Number(row?.min_limit ?? 0),
      };
    },
  });
}

export function useIsPro(enabled = true) {
  const query = useMyUsage(enabled);
  return { isPro: query.data?.plan === 'pro', ...query };
}

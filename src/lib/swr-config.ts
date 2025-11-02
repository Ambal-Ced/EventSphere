/**
 * SWR Configuration for data fetching
 */
import { supabase } from '@/lib/supabase';

export const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000, // 5 seconds
  focusThrottleInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
};

/**
 * Fetcher function for SWR
 */
export const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch');
  }
  return response.json();
};

/**
 * Supabase query fetcher for SWR
 */
export const supabaseFetcher = async (table: string, filters?: any) => {
  let query = supabase.from(table).select('*');
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    });
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
};


/**
 * SWR Hooks for data fetching with caching
 */
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { swrConfig } from './swr-config';

/**
 * Hook to fetch events with SWR caching
 */
export function useEvents(userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `events-${userId}` : null,
    async () => {
      if (!userId) return null;
      
      const { data: ownEvents, error: ownError } = await supabase
        .from('events')
        .select('id,title,description,date,location,category,image_url,created_at,updated_at,status,user_id,is_public,max_participants,price,role')
        .eq('user_id', userId)
        .not('status', 'eq', 'cancelled')
        .order('date', { ascending: true });
      
      if (ownError) throw ownError;
      
      // Fetch collaborations
      const { data: collabRows } = await supabase
        .from('event_collaborators')
        .select('event_id, role')
        .eq('user_id', userId);
      
      const joinedEventIds = (collabRows || []).map((r: any) => r.event_id);
      
      if (joinedEventIds.length > 0) {
        const { data: joinedEvents } = await supabase
          .from('events')
          .select('id,title,description,date,location,category,image_url,created_at,updated_at,status,user_id,is_public,max_participants,price,role')
          .in('id', joinedEventIds)
          .not('status', 'eq', 'cancelled')
          .order('date', { ascending: true });
        
        // Merge and deduplicate
        const mapById = new Map();
        [...(ownEvents || []), ...(joinedEvents || [])].forEach((evt: any) => {
          if (!mapById.has(evt.id)) mapById.set(evt.id, evt);
        });
        return Array.from(mapById.values());
      }
      
      return ownEvents || [];
    },
    swrConfig
  );

  return {
    events: data || [],
    isLoading,
    error,
    mutate, // For manual revalidation
  };
}


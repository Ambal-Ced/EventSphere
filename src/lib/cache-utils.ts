import { cache } from 'react';

/**
 * React Cache API utility for query result caching
 * This caches queries at the request level
 */

export const getCachedEvents = cache(async (userId: string, supabase: any) => {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,description,date,location,category,image_url,created_at,updated_at,status,user_id,is_public,max_participants,price,role')
    .eq('user_id', userId)
    .not('status', 'eq', 'cancelled')
    .order('date', { ascending: true });
  
  if (error) throw error;
  return data;
});

export const getCachedCollaborations = cache(async (userId: string, supabase: any) => {
  const { data, error } = await supabase
    .from('event_collaborators')
    .select('event_id, role')
    .eq('user_id', userId);
  
  if (error) throw error;
  return data;
});


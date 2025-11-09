import { MetadataRoute } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://eventtria.com';
  
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faqs`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  try {
    const supabase = createServerSupabaseClient();
    
    // Fetch public events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, updated_at')
      .eq('is_public', true)
      .neq('status', 'cancelled')
      .limit(1000); // Limit to prevent sitemap from being too large
    
    const eventRoutes: MetadataRoute.Sitemap = [];
    if (!eventsError && events) {
      eventRoutes.push(...events.map((event) => ({
        url: `${baseUrl}/event/${event.id}`,
        lastModified: event.updated_at ? new Date(event.updated_at) : new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })));
    }

    // Fetch active checkin portals
    const { data: checkinPortals, error: checkinError } = await supabase
      .from('attendance_portals')
      .select('token, updated_at')
      .eq('is_active', true)
      .limit(500);
    
    const checkinRoutes: MetadataRoute.Sitemap = [];
    if (!checkinError && checkinPortals) {
      checkinRoutes.push(...checkinPortals.map((portal) => ({
        url: `${baseUrl}/checkin/${encodeURIComponent(portal.token)}`,
        lastModified: portal.updated_at ? new Date(portal.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })));
    }

    // Fetch active feedback portals
    const { data: feedbackPortals, error: feedbackError } = await supabase
      .from('feedback_portals')
      .select('token, updated_at')
      .eq('is_active', true)
      .limit(500);
    
    const feedbackRoutes: MetadataRoute.Sitemap = [];
    if (!feedbackError && feedbackPortals) {
      feedbackRoutes.push(...feedbackPortals.map((portal) => ({
        url: `${baseUrl}/feedback/${encodeURIComponent(portal.token)}`,
        lastModified: portal.updated_at ? new Date(portal.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })));
    }

    return [...staticRoutes, ...eventRoutes, ...checkinRoutes, ...feedbackRoutes];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return at least static routes if there's an error
    return staticRoutes;
  }
}


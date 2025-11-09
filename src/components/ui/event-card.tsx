import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDateTime } from '@/lib/date-utils';
import { CalendarDays, MapPin } from 'lucide-react';
import { Database } from '@/types/supabase';

type Event = Database["public"]["Tables"]["events"]["Row"];

interface EventCardProps {
  event: Event;
  getDefaultImage: (category: string | null) => string;
  getStatusBadge: (status: string) => { className: string };
}

/**
 * EventCard component with React.memo to prevent unnecessary re-renders
 */
export const EventCard = React.memo<EventCardProps>(({ event, getDefaultImage, getStatusBadge }) => {
  return (
    <Link
      href={`/event/${event.id}`}
      className="block group relative overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
      prefetch={true}
    >
      <div className="aspect-video relative">
        <Image
          src={event.image_url || getDefaultImage(event.category)}
          alt={event.title}
          width={800}
          height={450}
          className="object-cover brightness-90 transition-transform duration-300 group-hover:scale-105 w-full h-full"
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          quality={85}
        />
        <div className="absolute right-2 top-2 flex flex-col items-end gap-2">
          {event.status && (
            <div
              className={`rounded-full px-3 py-1 text-xs font-medium border shrink-0 ${getStatusBadge(event.status).className}`}
            >
              {event.status}
            </div>
          )}
          {event.category && (
            <div className="rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 text-xs font-medium shrink-0">
              {event.category}
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="mb-2 text-lg font-semibold line-clamp-1">{event.title}</h3>
        {event.description && (
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{event.description}</p>
        )}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {event.date && (
            <div className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              <span>{formatDateTime(event.date)}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});

EventCard.displayName = 'EventCard';


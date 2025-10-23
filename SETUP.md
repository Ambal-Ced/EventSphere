# EventTria Setup Guide

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Setup

1. **Create the events table** by running the migration:
   ```sql
   -- Run the migration file: supabase/migrations/20250420040000_create_events_table.sql
   ```

2. **Or manually create the tables**:
   ```sql
   -- Create events table
   CREATE TABLE public.events (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
     title TEXT NOT NULL,
     description TEXT NOT NULL,
     date TIMESTAMP WITH TIME ZONE NOT NULL,
     location TEXT NOT NULL,
     type TEXT NOT NULL,
     is_online BOOLEAN DEFAULT false NOT NULL,
     creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
     max_participants INTEGER,
     price DECIMAL(10,2),
     image_url TEXT
   );

   -- Create event_items table
   CREATE TABLE public.event_items (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
     event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
     item_name TEXT NOT NULL,
     item_description TEXT,
     item_quantity INTEGER DEFAULT 1 NOT NULL,
     is_completed BOOLEAN DEFAULT false NOT NULL
   );
   ```

## Features Implemented

- ✅ Homepage now fetches real events from database instead of placeholders
- ✅ Loading states and error handling
- ✅ Proper TypeScript types for database
- ✅ Marquee animation for featured events
- ✅ Fallback images for events without custom images

## Next Steps

1. Set up your Supabase project and get the credentials
2. Create the `.env.local` file with your credentials
3. Run the database migrations
4. Start the development server: `npm run dev`

## Notes

- The homepage will show a loading state while fetching events
- If no events exist, it will show a message encouraging users to create the first event
- Events are fetched from the database and displayed in a marquee animation
- Categories are dynamically generated from existing events

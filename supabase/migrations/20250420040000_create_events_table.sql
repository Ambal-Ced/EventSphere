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

-- Enable Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create policies for events
CREATE POLICY "Events are viewable by everyone" ON public.events
  FOR SELECT USING (true);

CREATE POLICY "Users can create events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update their own events" ON public.events
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete their own events" ON public.events
  FOR DELETE USING (auth.uid() = creator_id);

-- Create index for better performance
CREATE INDEX idx_events_creator_id ON public.events(creator_id);
CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_events_type ON public.events(type);

-- Create event_items table for event management
CREATE TABLE public.event_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  item_description TEXT,
  item_quantity INTEGER DEFAULT 1 NOT NULL,
  is_completed BOOLEAN DEFAULT false NOT NULL
);

-- Enable Row Level Security for event_items
ALTER TABLE public.event_items ENABLE ROW LEVEL SECURITY;

-- Create policies for event_items
CREATE POLICY "Event items are viewable by event participants" ON public.event_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_items.event_id 
      AND (events.creator_id = auth.uid() OR true) -- Allow viewing for now, can be restricted later
    )
  );

CREATE POLICY "Event creators can manage items" ON public.event_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_items.event_id 
      AND events.creator_id = auth.uid()
    )
  );

-- Create index for better performance
CREATE INDEX idx_event_items_event_id ON public.event_items(event_id);

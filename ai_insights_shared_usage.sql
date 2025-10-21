-- =====================================================
-- AI INSIGHTS SHARED USAGE FUNCTIONS
-- =====================================================
-- These functions enable shared insights usage across all event participants

-- =====================================================
-- 1. CREATE EVENT INSIGHTS USAGE TABLE (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS event_insights_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    total_insights_generated INTEGER DEFAULT 0,
    last_generation_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, week_start_date)
);

-- Enable RLS
ALTER TABLE event_insights_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_insights_usage
CREATE POLICY "Event participants can view insights usage" ON event_insights_usage
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM events WHERE id = event_id
            UNION
            SELECT user_id FROM event_collaborators WHERE event_id = event_insights_usage.event_id
        )
    );

CREATE POLICY "Event participants can update insights usage" ON event_insights_usage
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM events WHERE id = event_id
            UNION
            SELECT user_id FROM event_collaborators WHERE event_id = event_insights_usage.event_id
        )
    );

CREATE POLICY "Event participants can insert insights usage" ON event_insights_usage
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM events WHERE id = event_id
            UNION
            SELECT user_id FROM event_collaborators WHERE event_id = event_insights_usage.event_id
        )
    );

-- =====================================================
-- 2. FUNCTION: Get event insights weekly usage
-- =====================================================

CREATE OR REPLACE FUNCTION get_event_insights_weekly_usage(p_event_id UUID)
RETURNS TABLE (
    total_insights_generated INTEGER,
    week_start_date_return DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    week_start DATE;
BEGIN
    -- Calculate start of current week (Monday)
    week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
    
    -- Get or create usage record for this event and week
    INSERT INTO event_insights_usage (event_id, week_start_date, total_insights_generated)
    VALUES (p_event_id, week_start, 0)
    ON CONFLICT (event_id, week_start_date) DO NOTHING;
    
    -- Return the usage data
    RETURN QUERY
    SELECT 
        COALESCE(eiu.total_insights_generated, 0) as total_insights_generated,
        week_start as week_start_date_return
    FROM event_insights_usage eiu
    WHERE eiu.event_id = p_event_id 
    AND eiu.week_start_date = week_start;
END;
$$;

-- =====================================================
-- 3. FUNCTION: Increment event insights usage
-- =====================================================

CREATE OR REPLACE FUNCTION increment_event_insights_usage(
    p_event_id UUID,
    p_week_start_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Increment the usage count
    UPDATE event_insights_usage 
    SET 
        total_insights_generated = total_insights_generated + 1,
        last_generation_at = NOW(),
        updated_at = NOW()
    WHERE event_id = p_event_id 
    AND week_start_date = p_week_start_date;
    
    -- If no rows were updated, create a new record
    IF NOT FOUND THEN
        INSERT INTO event_insights_usage (event_id, week_start_date, total_insights_generated, last_generation_at)
        VALUES (p_event_id, p_week_start_date, 1, NOW())
        ON CONFLICT (event_id, week_start_date) 
        DO UPDATE SET 
            total_insights_generated = event_insights_usage.total_insights_generated + 1,
            last_generation_at = NOW(),
            updated_at = NOW();
    END IF;
END;
$$;

-- =====================================================
-- 4. GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_event_insights_weekly_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_event_insights_usage(UUID, DATE) TO authenticated;

-- =====================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_event_insights_usage_event_week 
ON event_insights_usage(event_id, week_start_date);

CREATE INDEX IF NOT EXISTS idx_event_insights_usage_week_start 
ON event_insights_usage(week_start_date);

-- =====================================================
-- 6. VERIFICATION QUERIES
-- =====================================================

-- Test the functions (uncomment to test)
-- SELECT * FROM get_event_insights_weekly_usage('your-event-id-here');
-- SELECT increment_event_insights_usage('your-event-id-here', CURRENT_DATE);
-- SELECT * FROM get_event_insights_weekly_usage('your-event-id-here');

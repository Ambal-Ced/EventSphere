import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Decode token from URL
    const rawToken = params.token;
    const token = decodeURIComponent(rawToken).trim();
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    console.log("🔵 API: Checking checkin portal with token:", token);

    // Create a Supabase client with service role (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseServiceKey) {
      console.error("❌ API: No service role key found");
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Fetch portal
    const { data: portal, error: portalError } = await supabase
      .from("attendance_portals")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (portalError) {
      console.error("Portal query error:", portalError);
      return NextResponse.json(
        { error: 'Failed to fetch portal', details: portalError.message },
        { status: 500 }
      );
    }

    if (!portal) {
      return NextResponse.json(
        { error: 'Portal not found' },
        { status: 404 }
      );
    }

    // Check if portal is active
    if (!portal.is_active) {
      return NextResponse.json(
        { error: 'Portal is not active' },
        { status: 403 }
      );
    }

    // Check expiration
    if (portal.expires_at) {
      const now = new Date();
      const expiresAt = new Date(portal.expires_at);
      if (expiresAt < now) {
        return NextResponse.json(
          { error: 'Portal has expired' },
          { status: 403 }
        );
      }
    }

    // Fetch event
    let event = null;
    if (portal.event_id) {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id,title,description,location,date")
        .eq("id", portal.event_id)
        .maybeSingle();

      if (eventError) {
        console.error("Event query error:", eventError);
        return NextResponse.json(
          { error: 'Failed to fetch event', details: eventError.message },
          { status: 500 }
        );
      }

      event = eventData;
    }

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      portal,
      event
    });

  } catch (error: any) {
    console.error("Portal checkin API error:", error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


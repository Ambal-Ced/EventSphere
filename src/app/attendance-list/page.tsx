"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Calendar, 
  User, 
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Mail,
  Phone,
  ArrowLeft
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";

interface AttendanceRecord {
  id: string;
  attendee_name: string;
  attendee_email: string | null;
  created_at: string;
  note: string | null;
  event_id: string;
  events?: {
    title: string;
    date: string;
    location: string;
  };
}

function AttendanceListContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [eventTitle, setEventTitle] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get user's events first
        const { data: userEvents, error: eventsError } = await supabase
          .from("events")
          .select("id, title")
          .eq("user_id", user.id);
          
        if (eventsError) throw eventsError;
        
        setEvents(userEvents || []);
        
        if (!userEvents || userEvents.length === 0) {
          setAttendance([]);
          return;
        }
        
        const eventIds = userEvents.map(e => e.id);
        
        // Fetch attendance records for user's events
        let query = supabase
          .from("attendance_records")
          .select(`
            *,
            events!inner(title, date, location)
          `)
          .in("event_id", eventIds)
          .order("created_at", { ascending: false });
          
        // If specific event is requested, filter by it
        if (eventId) {
          query = query.eq("event_id", eventId);
        }
        
        const { data: attendanceData, error: attendanceError } = await query;
          
        if (attendanceError) throw attendanceError;
        
        setAttendance(attendanceData || []);
        
        // Get event title if filtering by specific event
        if (eventId) {
          const { data: eventData } = await supabase
            .from("events")
            .select("title")
            .eq("id", eventId)
            .single();
          setEventTitle(eventData?.title || "");
        }
      } catch (error) {
        console.error("Error fetching attendance:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, eventId]);

  const filteredAttendance = attendance.filter(record => {
    const matchesSearch = 
      record.attendee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.attendee_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.events?.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEvent = 
      filterEvent === "all" || record.event_id === filterEvent;
    
    // If viewing specific event, only show attendance for that event
    const matchesSpecificEvent = !eventId || record.event_id === eventId;
    
    return matchesSearch && matchesEvent && matchesSpecificEvent;
  });

  const sortedAttendance = [...filteredAttendance].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "name":
        return a.attendee_name.localeCompare(b.attendee_name);
      default:
        return 0;
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatEventDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const exportToCSV = () => {
    if (sortedAttendance.length === 0) {
      alert("No attendance data to export");
      return;
    }

    const headers = [
      "Attendee Name",
      "Email",
      "Event Title", 
      "Event Date",
      "Location",
      "Note",
      "Check-in Time"
    ];

    const csvData = sortedAttendance.map(record => [
      record.attendee_name,
      record.attendee_email || "",
      record.events?.title || "Unknown Event",
      record.events?.date ? formatEventDate(record.events.date) : "",
      record.events?.location || "",
      record.note || "",
      formatDate(record.created_at)
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => 
        row.map(field => 
          typeof field === "string" && field.includes(",") 
            ? `"${field.replace(/"/g, '""')}"` 
            : field
        ).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance-${eventId ? `event-${eventId}` : 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate stats
  const totalAttendees = attendance.length;
  const uniqueAttendees = new Set(attendance.map(a => a.attendee_email || a.attendee_name)).size;
  const eventsWithAttendance = new Set(attendance.map(a => a.event_id)).size;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-300">Loading attendance records...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {eventId && eventTitle && (
            <div className="flex items-center gap-2 mb-2">
              <Link 
                href={`/event/${eventId}`}
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Event
              </Link>
            </div>
          )}
          <h1 className="text-3xl font-bold text-white">
            {eventId && eventTitle ? `Attendance for "${eventTitle}"` : "Attendance List"}
          </h1>
          <p className="text-slate-400 mt-1">
            {eventId ? "Attendance records for this specific event" : "View and manage attendance records from your events"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Records</p>
                <p className="text-2xl font-bold text-white">{totalAttendees}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Unique Attendees</p>
                <p className="text-2xl font-bold text-green-400">{uniqueAttendees}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Events with Attendance</p>
                <p className="text-2xl font-bold text-purple-400">{eventsWithAttendance}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Events</p>
                <p className="text-2xl font-bold text-orange-400">{events.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search attendees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-sm sm:text-base"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              {!eventId && (
                <select
                  value={filterEvent}
                  onChange={(e) => setFilterEvent(e.target.value)}
                  className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm w-full sm:w-auto"
                >
                  <option value="all">All Events</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              )}
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm w-full sm:w-auto"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance List */}
      <div className="space-y-4">
        {sortedAttendance.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No attendance records found</h3>
              <p className="text-slate-400">
                {searchTerm || filterEvent !== "all" 
                  ? "Try adjusting your search or filter criteria."
                  : "No attendance records have been created for your events yet."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedAttendance.map((record) => (
            <Card key={record.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-3 sm:gap-4">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-3">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                          <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          Present
                        </Badge>
                        
                        <div className="flex items-center gap-1 sm:gap-2 text-slate-400 text-xs sm:text-sm">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="truncate">{formatDate(record.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-300">
                        <User className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="font-medium text-sm sm:text-base">{record.attendee_name}</span>
                      </div>
                      
                      {record.attendee_email && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="text-xs sm:text-sm truncate">{record.attendee_email}</span>
                        </div>
                      )}
                      
                      <div className="text-slate-300 text-sm sm:text-base">
                        <span className="font-medium">Event: </span>
                        <span className="truncate">{record.events?.title || "Unknown Event"}</span>
                      </div>
                      
                      {record.events?.date && (
                        <div className="text-slate-400 text-xs sm:text-sm">
                          <span className="font-medium">Event Date: </span>
                          {formatEventDate(record.events.date)}
                        </div>
                      )}
                      
                      {record.events?.location && (
                        <div className="text-slate-400 text-xs sm:text-sm">
                          <span className="font-medium">Location: </span>
                          <span className="truncate">{record.events.location}</span>
                        </div>
                      )}
                      
                      {record.note && (
                        <div className="mt-3 p-2 sm:p-3 bg-slate-700 rounded-md">
                          <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                            <span className="font-medium">Note: </span>
                            {record.note}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-3 lg:mt-0">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                      <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default function AttendanceListPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-300">Loading...</div>
        </div>
      </div>
    }>
      <AttendanceListContent />
    </Suspense>
  );
}

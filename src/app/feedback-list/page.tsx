"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Star, 
  Calendar, 
  User, 
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowLeft
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";

interface FeedbackItem {
  id: string;
  title: string;
  description: string;
  rating: number | null;
  sentiment: string | null;
  comments: string | null;
  respondent_name: string | null;
  respondent_email: string | null;
  created_at: string;
  event_id: string;
  events?: {
    title: string;
  };
}

function FeedbackListContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "positive" | "neutral" | "negative">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rating">("newest");
  const [eventTitle, setEventTitle] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    
    const fetchFeedback = async () => {
      try {
        setLoading(true);
        
        // Get user's events first
        const { data: userEvents, error: eventsError } = await supabase
          .from("events")
          .select("id")
          .eq("user_id", user.id);
          
        if (eventsError) throw eventsError;
        
        if (!userEvents || userEvents.length === 0) {
          setFeedback([]);
          return;
        }
        
        const eventIds = userEvents.map(e => e.id);
        
        // Fetch feedback responses for user's events
        let query = supabase
          .from("feedback_responses")
          .select(`
            *,
            events!inner(title)
          `)
          .in("event_id", eventIds)
          .order("created_at", { ascending: false });
          
        // If specific event is requested, filter by it
        if (eventId) {
          query = query.eq("event_id", eventId);
        }
        
        const { data: feedbackData, error: feedbackError } = await query;
          
        if (feedbackError) throw feedbackError;
        
        setFeedback(feedbackData || []);
        
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
        console.error("Error fetching feedback:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [user, eventId]);

  const filteredFeedback = feedback.filter(item => {
    const matchesSearch = 
      item.respondent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.comments?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.events?.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterStatus === "all" ||
      (filterStatus === "positive" && item.sentiment === "positive") ||
      (filterStatus === "neutral" && item.sentiment === "neutral") ||
      (filterStatus === "negative" && item.sentiment === "negative");
    
    // If viewing specific event, only show feedback for that event
    const matchesEvent = !eventId || item.event_id === eventId;
    
    return matchesSearch && matchesFilter && matchesEvent;
  });

  const sortedFeedback = [...filteredFeedback].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "rating":
        return (b.rating || 0) - (a.rating || 0);
      default:
        return 0;
    }
  });

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case "positive": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "neutral": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "negative": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getSentimentIcon = (sentiment: string | null) => {
    switch (sentiment) {
      case "positive": return <CheckCircle className="w-4 h-4" />;
      case "neutral": return <Clock className="w-4 h-4" />;
      case "negative": return <AlertCircle className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const exportToCSV = () => {
    if (sortedFeedback.length === 0) {
      alert("No feedback data to export");
      return;
    }

    const headers = [
      "Respondent Name",
      "Email", 
      "Event Title",
      "Rating",
      "Sentiment",
      "Comments",
      "Created At"
    ];

    const csvData = sortedFeedback.map(item => [
      item.respondent_name || "Anonymous",
      item.respondent_email || "",
      item.events?.title || "Unknown Event",
      item.rating || "",
      item.sentiment || "",
      item.comments || "",
      formatDate(item.created_at)
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
    link.setAttribute("download", `feedback-${eventId ? `event-${eventId}` : 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-300">Loading feedback...</div>
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
            {eventId && eventTitle ? `Feedback for "${eventTitle}"` : "Feedback List"}
          </h1>
          <p className="text-slate-400 mt-1">
            {eventId ? "Feedback submitted for this specific event" : "View and manage feedback from your events"}
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
                <p className="text-sm text-slate-400">Total Feedback</p>
                <p className="text-2xl font-bold text-white">{feedback.length}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Positive</p>
                <p className="text-2xl font-bold text-green-400">
                  {feedback.filter(f => f.sentiment === "positive").length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Neutral</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {feedback.filter(f => f.sentiment === "neutral").length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Negative</p>
                <p className="text-2xl font-bold text-red-400">
                  {feedback.filter(f => f.sentiment === "negative").length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400" />
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
                  placeholder="Search feedback..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-sm sm:text-base"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm w-full sm:w-auto"
              >
                <option value="all">All Sentiment</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm w-full sm:w-auto"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="rating">Highest Rating</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback List */}
      <div className="space-y-4">
        {sortedFeedback.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No feedback found</h3>
              <p className="text-slate-400">
                {searchTerm || filterStatus !== "all" 
                  ? "Try adjusting your search or filter criteria."
                  : "No feedback has been submitted for your events yet."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedFeedback.map((item) => (
            <Card key={item.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-3 sm:gap-4">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-3">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <Badge className={`${getSentimentColor(item.sentiment)} border text-xs`}>
                          {getSentimentIcon(item.sentiment)}
                          <span className="ml-1 capitalize">{item.sentiment || "Unknown"}</span>
                        </Badge>
                        
                        {item.rating && (
                          <div className="flex items-center gap-1 text-yellow-400">
                            <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
                            <span className="text-xs sm:text-sm font-medium">{item.rating}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 sm:gap-2 text-slate-400 text-xs sm:text-sm">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="truncate">{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-slate-300">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="font-medium text-sm sm:text-base">
                            {item.respondent_name || "Anonymous"}
                          </span>
                        </div>
                        {item.respondent_email && (
                          <span className="text-slate-400 text-xs sm:text-sm truncate">({item.respondent_email})</span>
                        )}
                      </div>
                      
                      <div className="text-slate-300 text-sm sm:text-base">
                        <span className="font-medium">Event: </span>
                        <span className="truncate">{item.events?.title || "Unknown Event"}</span>
                      </div>
                      
                      {item.comments && (
                        <div className="mt-3 p-2 sm:p-3 bg-slate-700 rounded-md">
                          <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                            {item.comments}
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

export default function FeedbackListPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-300">Loading...</div>
        </div>
      </div>
    }>
      <FeedbackListContent />
    </Suspense>
  );
}

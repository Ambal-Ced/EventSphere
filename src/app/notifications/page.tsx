"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Calendar, 
  Users, 
  AlertCircle, 
  Info, 
  XCircle, 
  ExternalLink,
  Loader2,
  Filter,
  Search
} from "lucide-react";
import { toast } from "sonner";

type NotificationSource = 'notifications' | 'admin_notif';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'event' | 'event_joined' | 'event_created' | 'event_left' | 'invitation' | 'system' | 'account_deletion';
  level?: 'info' | 'success' | 'warning' | 'error'; // Optional level field for backward compatibility
  read_at: string | null;
  created_at: string;
  link_url: string | null;
  event_id: string | null;
  metadata: any;
  source: NotificationSource;
}

export default function NotificationsPage() {
  const router = useRouter();
  const themePreference = useThemePreference();
  const isLightTheme = themePreference === "light";
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const [core, admin] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('admin_notif')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (core.error) throw core.error;
      if (admin.error) throw admin.error;

      const combined: Notification[] = [
        ...((core.data ?? []).map((record: any) => ({
          ...record,
          title: record.title ?? '',
          message: record.message ?? '',
          type: (record.type ?? record.level ?? 'info') as Notification['type'],
          metadata: record.metadata ?? {},
          source: 'notifications' as NotificationSource,
        })) as Notification[]),
        ...((admin.data ?? []).map((record: any) => ({
          ...record,
          title: record.title ?? '',
          message: record.message ?? '',
          type: (record.type ?? record.level ?? 'info') as Notification['type'],
          metadata: record.metadata ?? {},
          source: 'admin_notif' as NotificationSource,
        })) as Notification[]),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(combined);
      
      // Debug: Log notification types to help with filtering
      if (combined.length > 0) {
        const types = [...new Set(combined.map(n => n.type || n.level || 'unknown'))];
        console.log('Available notification types:', types);
      }
    } catch (error: any) {
      console.error('Error loading notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notification: Notification) => {
    try {
      setMarkingRead(notification.id);

      if (notification.source === 'admin_notif') {
        const { error } = await supabase
          .from('admin_notif')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notification.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('mark_notification_read', { p_id: notification.id });
        if (error) throw error;
      }

      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)
      );
      
      // Trigger a custom event to update the header notification count
      window.dispatchEvent(new CustomEvent('notificationRead', { detail: { id: notification.id, source: notification.source } }));
      
      toast.success('Notification marked as read');
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    } finally {
      setMarkingRead(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAllRead(true);
      console.log('Marking all notifications as read...');
      
      // First try the RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('mark_all_notifications_read');
      console.log('RPC response:', { rpcData, rpcError });
      
      if (rpcError) {
        console.log('RPC failed, trying direct update...', rpcError);
        
        // Fallback: Direct update query (without updated_at since it doesn't exist)
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ 
            read_at: new Date().toISOString()
          })
          .is('read_at', null);
        
        if (updateError) {
          console.error('Direct update also failed:', updateError);
          throw updateError;
        }
        
        console.log('Direct update succeeded');
      }

      console.log('Successfully marked notifications as read, updating UI...');

      // Ensure admin notifications are marked as read as well
      const { error: adminUpdateError } = await supabase
        .from('admin_notif')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);

      if (adminUpdateError) {
        console.error('Error marking admin notifications as read:', adminUpdateError);
      }

      // Reload notifications to get the updated state from the database
      await loadNotifications();
      
      // Trigger a custom event to update the header notification count
      window.dispatchEvent(new CustomEvent('allNotificationsRead'));
      
      toast.success(`All notifications marked as read`);
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      toast.error(`Failed to mark all notifications as read: ${error.message}`);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const getNotificationIcon = (notification: Notification) => {
    const type = notification.type || notification.level || 'info';
    switch (type) {
      case 'success':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'event':
      case 'event_joined':
      case 'event_created':
      case 'event_left':
        return <Calendar className="w-5 h-5 text-blue-500" />;
      case 'invitation':
        return <Users className="w-5 h-5 text-purple-500" />;
      case 'system':
      case 'account_deletion':
        return <Bell className="w-5 h-5 text-gray-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return date.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter(notification => {
    // Filter by read status
    if (filter === 'unread' && notification.read_at) return false;
    if (filter === 'read' && !notification.read_at) return false;

    // Filter by type (check both type and level fields)
    if (typeFilter !== 'all') {
      const notificationType = notification.type || notification.level || 'info';
      if (notificationType !== typeFilter) return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const unreadCount = notifications.filter(n => !n.read_at).length;

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            Loading notifications...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`container mx-auto py-8 ${isLightTheme ? "notifications-light" : ""}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Notifications</h1>
              <p className="text-slate-400 text-sm sm:text-base">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
              </p>
            </div>
          </div>
          <Button
            onClick={markAllAsRead}
            disabled={markingAllRead || unreadCount === 0}
            className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto text-sm sm:text-base"
          >
            {markingAllRead ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="hidden sm:inline">Marking...</span>
                <span className="sm:hidden">Marking...</span>
              </>
            ) : (
              <>
                <CheckCheck className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Mark All Read</span>
                <span className="sm:hidden">Mark All</span>
              </>
            )}
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/60 border border-slate-600 rounded-lg p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                />
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
                className={`${filter === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''} w-full sm:w-auto text-xs sm:text-sm`}
              >
                All ({notifications.length})
              </Button>
              <Button
                variant={filter === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('unread')}
                className={`${filter === 'unread' ? 'bg-blue-600 hover:bg-blue-700' : ''} w-full sm:w-auto text-xs sm:text-sm`}
              >
                Unread ({unreadCount})
              </Button>
              <Button
                variant={filter === 'read' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('read')}
                className={`${filter === 'read' ? 'bg-blue-600 hover:bg-blue-700' : ''} w-full sm:w-auto text-xs sm:text-sm`}
              >
                Read ({notifications.length - unreadCount})
              </Button>
            </div>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto text-sm sm:text-base"
            >
              <option value="all">All Types</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="event">Event</option>
              <option value="invitation">Invitation</option>
              <option value="system">System</option>
              <option value="event_joined">Event Joined</option>
              <option value="event_created">Event Created</option>
              <option value="event_left">Event Left</option>
              <option value="account_deletion">Account Deletion</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">
              {searchQuery || filter !== 'all' || typeFilter !== 'all' 
                ? 'No notifications match your filters' 
                : 'No notifications yet'
              }
            </h3>
            <p className="text-slate-500">
              {searchQuery || filter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'You\'ll see notifications here when you receive them'
              }
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-slate-800/60 border rounded-lg p-4 transition-all hover:bg-slate-800/80 relative ${
                !notification.read_at 
                  ? 'border-blue-500/30 bg-blue-500/5' 
                  : 'border-slate-600'
              }`}
            >
              {/* Action buttons positioned absolutely in top right */}
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {!notification.read_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAsRead(notification)}
                    disabled={markingRead === notification.id}
                    className="text-xs px-2 py-1 h-6 w-6 p-0"
                  >
                    {markingRead === notification.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </Button>
                )}
                
                {notification.link_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(notification.link_url!)}
                    className="text-xs px-2 py-1 h-6 w-6 p-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
              </div>

              <div className="flex items-start gap-4 pr-16">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold mb-1 ${
                    !notification.read_at ? 'text-white' : 'text-slate-300'
                  }`}>
                    {notification.title}
                  </h3>
                  <p className="text-slate-400 text-sm mb-2 line-clamp-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span className="break-words">{formatTimeAgo(notification.created_at)}</span>
                    <span className="capitalize break-words">{notification.type || notification.level || 'info'}</span>
                    {notification.event_id && (
                      <span className="break-words">Event related</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

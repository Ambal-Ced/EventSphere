"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, X, Bot, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface AIChatProps {
  eventId: string;
  eventTitle: string;
  eventDescription: string;
  isEnabled: boolean;
}

export default function AIChat({ eventId, eventTitle, eventDescription, isEnabled }: AIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usageInfo, setUsageInfo] = useState<{
    questionsAsked: number;
    canAskMore: boolean;
    weekStart: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && isEnabled) {
      fetchUsageInfo();
    }
  }, [isOpen, isEnabled, eventId]);

  const fetchUsageInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_or_create_weekly_usage', {
        p_user_id: user.id,
        p_event_id: eventId
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const usage = data[0];
        setUsageInfo({
          questionsAsked: usage.questions_asked,
          canAskMore: usage.can_ask_more,
          weekStart: usage.week_start_date_return
        });
      }
    } catch (error) {
      console.error('Error fetching usage info:', error);
    }
  };

  const incrementUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('ai_chat_usage')
        .update({
          questions_asked: (usageInfo?.questionsAsked || 0) + 1,
          last_question_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .eq('week_start_date', usageInfo?.weekStart);

      if (error) throw error;

      // Update local state
      setUsageInfo(prev => prev ? {
        ...prev,
        questionsAsked: prev.questionsAsked + 1,
        canAskMore: prev.questionsAsked + 1 < 5
      } : null);
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !usageInfo?.canAskMore) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Increment usage counter
      await incrementUsage();

      // Prepare event context for AI
      const eventContext = `
Event: ${eventTitle}
Description: ${eventDescription}
Event ID: ${eventId}

Please provide helpful information about this event. You can help with:
- Event details and information
- Suggestions for event planning
- General event management advice
- Answering questions about the event

Keep responses concise and relevant to the event context.
      `;

      // Call Cohere API
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage.trim(),
          context: eventContext,
          eventId: eventId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || 'Sorry, I could not generate a response at this time.',
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again later.',
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isEnabled) return null;

  return (
    <>
      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg z-50 p-0 overflow-hidden"
        size="lg"
      >
        <img 
          src="/images/template/chatbot.png" 
          alt="AI Chat" 
          className="w-full h-full object-cover rounded-full"
        />
      </Button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg w-full max-w-md h-[500px] flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-600">
              <div className="flex items-center gap-2">
                <img 
                  src="/images/template/chatbot.png" 
                  alt="AI Assistant" 
                  className="w-6 h-6 object-contain"
                />
                <h3 className="text-white font-semibold">AI Assistant</h3>
              </div>
              <Button
                onClick={() => setIsOpen(false)}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Usage Info */}
            {usageInfo && (
              <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-600">
                <p className="text-xs text-slate-300">
                  Questions this week: {usageInfo.questionsAsked}/5
                  {!usageInfo.canAskMore && (
                    <span className="text-red-400 ml-2">(Limit reached)</span>
                  )}
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-slate-400 text-sm">
                  <img 
                    src="/images/template/chatbot.png" 
                    alt="AI Assistant" 
                    className="w-12 h-12 mx-auto mb-2 object-contain"
                  />
                  <p>Ask me anything about this event!</p>
                  <p className="text-xs mt-1">You have 5 questions per week.</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-700 text-slate-200 rounded-lg p-3 max-w-[80%]">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-600">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    usageInfo?.canAskMore 
                      ? "Ask about this event..." 
                      : "Weekly limit reached"
                  }
                  disabled={!usageInfo?.canAskMore || isLoading}
                  className="flex-1 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading || !usageInfo?.canAskMore}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

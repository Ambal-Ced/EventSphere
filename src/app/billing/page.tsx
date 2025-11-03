"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, CreditCard, Download, AlertTriangle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { SubscriptionService } from "@/lib/subscription";
import { EventCountManager } from "@/lib/event-count-manager";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Mock data removed - now using real transaction data

export default function BillingPage() {
  const { user } = useAuth();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCancelSuccessDialog, setShowCancelSuccessDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [wasCancelledWithinGracePeriod, setWasCancelledWithinGracePeriod] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [usageData, setUsageData] = useState<{
    aiInsightsOverall: { current: number; limit: number };
    aiChat: { current: number; limit: number };
    events: { current: number; limit: number };
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  // Generate PDF invoice
  const generateInvoicePDF = (transaction: any) => {
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice ${transaction.invoice_number}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: white;
              color: #333;
            }
            .invoice-header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 20px;
            }
            .invoice-title {
              font-size: 28px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 10px;
            }
            .invoice-number {
              font-size: 16px;
              color: #6b7280;
            }
            .invoice-details {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .company-info, .customer-info {
              flex: 1;
            }
            .company-info h3, .customer-info h3 {
              margin: 0 0 10px 0;
              color: #1f2937;
              font-size: 18px;
            }
            .company-info p, .customer-info p {
              margin: 5px 0;
              color: #6b7280;
              font-size: 14px;
            }
            .invoice-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .invoice-table th, .invoice-table td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
            }
            .invoice-table th {
              background-color: #f9fafb;
              font-weight: bold;
              color: #1f2937;
            }
            .invoice-table td {
              color: #374151;
            }
            .total-section {
              text-align: right;
              margin-top: 20px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .total-label {
              font-weight: bold;
              color: #1f2937;
            }
            .total-amount {
              font-weight: bold;
              color: #059669;
              font-size: 18px;
            }
            .invoice-footer {
              margin-top: 40px;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
              border-top: 1px solid #e5e7eb;
              padding-top: 20px;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .status-paid {
              background-color: #dcfce7;
              color: #166534;
            }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            <div class="invoice-title">EventTria</div>
            <div class="invoice-number">Invoice ${transaction.invoice_number}</div>
          </div>
          
          <div class="invoice-details">
            <div class="company-info">
              <h3>EventTria</h3>
              <p>Event Management Platform</p>
              <p>support@eventtria.com</p>
              <p>Invoice Date: ${new Date(transaction.created_at).toLocaleDateString()}</p>
            </div>
            <div class="customer-info">
              <h3>Bill To</h3>
              <p>${user?.email || 'Customer'}</p>
              <p>Payment Method: ${transaction.payment_method_brand} •••• ${transaction.payment_method_last4}</p>
              <p>Transaction ID: ${transaction.id}</p>
            </div>
          </div>
          
          <table class="invoice-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Subscription Payment</td>
                <td>${transaction.plan_name}</td>
                <td><span class="status-badge status-paid">${transaction.status}</span></td>
                <td>₱${(transaction.net_amount_cents / 1000).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="total-section">
            <div class="total-row">
              <span class="total-label">Total Amount:</span>
              <span class="total-amount">₱${(transaction.net_amount_cents / 1000).toFixed(2)}</span>
            </div>
          </div>
          
          <div class="invoice-footer">
            <p>Thank you for using EventTria!</p>
            <p>This invoice was generated on ${new Date().toLocaleDateString()}</p>
          </div>
        </body>
      </html>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      
      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Close the window after printing
          setTimeout(() => {
            printWindow.close();
          }, 1000);
        }, 500);
      };
    }
  };

  // Fetch subscription data
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Fetching subscription data for user:', user.id);
        const subscriptionData = await SubscriptionService.getUserSubscription(user.id);
        console.log('📊 Subscription data:', subscriptionData);
        setSubscription(subscriptionData);
      } catch (error) {
        console.error('❌ Error fetching subscription:', error);
        toast.error('Failed to load subscription data');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();

    // Listen for subscription updates (e.g., after payment)
    const handleSubscriptionUpdate = async () => {
      console.log('🔄 Subscription update detected, refreshing data...');
      await fetchSubscription();
      // Also refresh billing history
      if (user) {
        try {
          const history = await SubscriptionService.getBillingHistory(user.id);
          setBillingHistory(history);
        } catch (error) {
          console.error('❌ Error refreshing billing history:', error);
        }
      }
    };

    window.addEventListener('subscriptionUpdated', handleSubscriptionUpdate);
    
    return () => {
      window.removeEventListener('subscriptionUpdated', handleSubscriptionUpdate);
    };
  }, [user]);

  // Fetch usage data
  useEffect(() => {
    const fetchUsageData = async () => {
      if (!user) {
        setLoadingUsage(false);
        return;
      }

      try {
        setLoadingUsage(true);
        console.log('📊 Fetching usage data for user:', user.id);

        // Get subscription to determine plan limits
        const subscriptionData = await SubscriptionService.getUserSubscription(user.id);
        
        if (!subscriptionData || !subscriptionData.subscription_plans) {
          console.warn('⚠️ No subscription found, using default limits');
          setUsageData({
            aiInsightsOverall: { current: 0, limit: 5 },
            aiChat: { current: 0, limit: 5 },
            events: { current: 0, limit: 10 }
          });
          setLoadingUsage(false);
          return;
        }

        const planName = subscriptionData.subscription_plans.name || 'Free';
        const planFeatures = DefaultSubscriptionManager.getSubscriptionFeatures(planName);

        // Get AI Insights Overall usage (from analytics insights)
        let aiInsightsOverallCurrent = 0;
        try {
          const { data: insightsData } = await supabase.rpc('get_or_create_analytics_insights_weekly_usage', {
            p_user_id: user.id
          });
          if (insightsData && insightsData.length > 0) {
            aiInsightsOverallCurrent = insightsData[0].insights_generated || 0;
          }
        } catch (error) {
          console.error('❌ Error fetching AI insights overall usage:', error);
        }

        // Get AI Chat usage (sum of all chat usage records)
        let aiChatCurrent = 0;
        try {
          const { data: chatUsage } = await supabase
            .from('ai_chat_usage')
            .select('questions_asked')
            .eq('user_id', user.id);
          
          if (chatUsage && chatUsage.length > 0) {
            aiChatCurrent = chatUsage.reduce((sum, record) => sum + (record.questions_asked || 0), 0);
          }
        } catch (error) {
          console.error('❌ Error fetching AI chat usage:', error);
        }

        // Get Events count
        const eventCounts = await EventCountManager.getEventCounts(user.id);
        const eventsCurrent = eventCounts.eventsCreated;

        // Set limits (handle unlimited as -1)
        const aiInsightsLimit = planFeatures.max_ai_insights_overall === -1 ? 9999 : planFeatures.max_ai_insights_overall;
        const aiChatLimit = planFeatures.max_ai_chat === -1 ? 9999 : planFeatures.max_ai_chat;
        const eventsLimit = planFeatures.max_events_created === -1 ? 9999 : planFeatures.max_events_created;

        setUsageData({
          aiInsightsOverall: { 
            current: aiInsightsOverallCurrent, 
            limit: aiInsightsLimit 
          },
          aiChat: { 
            current: aiChatCurrent, 
            limit: aiChatLimit 
          },
          events: { 
            current: eventsCurrent, 
            limit: eventsLimit 
          }
        });

        console.log('✅ Usage data fetched:', {
          aiInsightsOverall: { current: aiInsightsOverallCurrent, limit: aiInsightsLimit },
          aiChat: { current: aiChatCurrent, limit: aiChatLimit },
          events: { current: eventsCurrent, limit: eventsLimit }
        });
      } catch (error) {
        console.error('❌ Error fetching usage data:', error);
        // Set default values on error
        setUsageData({
          aiInsightsOverall: { current: 0, limit: 5 },
          aiChat: { current: 0, limit: 5 },
          events: { current: 0, limit: 10 }
        });
      } finally {
        setLoadingUsage(false);
      }
    };

    fetchUsageData();

    // Refresh usage data when subscription updates
    const handleUsageUpdate = () => {
      fetchUsageData();
    };

    window.addEventListener('subscriptionUpdated', handleUsageUpdate);
    
    return () => {
      window.removeEventListener('subscriptionUpdated', handleUsageUpdate);
    };
  }, [user, subscription]);

  // Fetch billing history
  useEffect(() => {
    const fetchBillingHistory = async () => {
      if (!user) {
        setLoadingHistory(false);
        return;
      }

      try {
        console.log('🔍 Fetching billing history for user:', user.id);
        const history = await SubscriptionService.getBillingHistory(user.id);
        console.log('📊 Billing history:', history);
        setBillingHistory(history);
      } catch (error) {
        console.error('❌ Error fetching billing history:', error);
        toast.error('Failed to load billing history');
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchBillingHistory();
  }, [user]);

  const handleCancelSubscription = async () => {
    if (!user || !subscription) {
      toast.error('No subscription found to cancel');
      return;
    }

    setIsCancelling(true);
    
    try {
      console.log('🔄 Cancelling subscription for user:', user.id);
      
      // Check if cancellation is within grace period BEFORE cancelling
      const graceInfo = getGracePeriodInfo(subscription);
      const wasWithinGracePeriod = graceInfo?.isWithinGracePeriod || false;
      setWasCancelledWithinGracePeriod(wasWithinGracePeriod);
      
      console.log('📅 Grace period check:', {
        wasWithinGracePeriod,
        daysSinceActivation: graceInfo?.daysSinceActivation,
        daysRemaining: graceInfo?.daysRemaining
      });
      
      // Cancel the subscription
      const success = await SubscriptionService.cancelSubscription(user.id, true); // Cancel at period end
      
      if (success) {
        console.log('✅ Subscription cancelled successfully');
        
        if (wasWithinGracePeriod) {
          toast.success('Subscription cancelled successfully. You have been downgraded to Free tier immediately.');
        } else {
          toast.success('Subscription cancelled successfully. You will retain access until the end of your billing period.');
        }
        
        // ALWAYS close the cancel dialog first, regardless of subscription state
        setShowCancelDialog(false);
        
        // Small delay to ensure dialog closes properly before showing success
        setTimeout(() => {
          // Refresh subscription data
          SubscriptionService.getUserSubscription(user.id).then((updatedSubscription) => {
            setSubscription(updatedSubscription);
            
            // Dispatch event to refresh other components
            window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
            
            // Show success dialog after subscription is refreshed
            setShowCancelSuccessDialog(true);
          }).catch((error) => {
            console.error('❌ Error fetching updated subscription:', error);
            // Still show success dialog even if fetching subscription fails
            setShowCancelSuccessDialog(true);
          });
        }, 100);
      } else {
        console.error('❌ Failed to cancel subscription');
        toast.error('Failed to cancel subscription. Please try again or contact support.');
        // Close dialog on failure too
        setShowCancelDialog(false);
      }
    } catch (error) {
      console.error('❌ Error cancelling subscription:', error);
      toast.error('An error occurred while cancelling your subscription. Please contact support.');
      // ALWAYS close dialog on error
      setShowCancelDialog(false);
    } finally {
      setIsCancelling(false);
      // Ensure dialog is closed in finally block as well (defensive)
      if (showCancelDialog) {
        setShowCancelDialog(false);
      }
    }
  };

  const getStatusColor = (subscription: any) => {
    if (!subscription) return "bg-gray-500";
    
    // Check if subscription is cancelled based on cancelled_at field
    if (subscription.cancelled_at) {
      if (subscription.cancel_at_period_end) {
        return "bg-orange-500"; // Orange for cancelled but still has access
      } else {
        return "bg-red-500"; // Red for immediate cancellation
      }
    }
    
    // Regular status colors
    switch (subscription.status) {
      case "active": return "bg-green-500";
      case "past_due": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusText = (subscription: any) => {
    if (!subscription) return 'inactive';
    
    // Check if subscription is cancelled based on cancelled_at field
    if (subscription.cancelled_at) {
      if (subscription.cancel_at_period_end) {
        return 'cancelled (access until expiry)';
      } else {
        return 'cancelled (immediate)';
      }
    }
    
    return subscription.status;
  };

  const getGracePeriodInfo = (subscription: any) => {
    if (!subscription || subscription.cancelled_at) return null; // Don't show grace period for cancelled subscriptions
    
    // Don't show grace period for Free tier subscriptions
    if (subscription.subscription_plans?.name === 'Free') return null;
    
    const activationDate = new Date(subscription.current_period_start);
    const now = new Date();
    const daysSinceActivation = Math.floor((now.getTime() - activationDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      daysSinceActivation,
      isWithinGracePeriod: daysSinceActivation < 7,
      daysRemaining: Math.max(0, 7 - daysSinceActivation)
    };
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view invoices, and update payment methods.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Subscription */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  {loading ? "Loading..." : subscription?.subscription_plans?.name || "No subscription"}
                </h3>
                <p className="text-muted-foreground">
                  {loading ? "Loading..." : subscription ? 
                    subscription.subscription_plans?.name === 'Free' ? 
                      'Free (No expiry)' : 
                      `₱${(subscription.subscription_plans?.price_cents || 0) / 1000} per 30 days` 
                    : "No subscription"}
                </p>
              </div>
                     <Badge className={`${getStatusColor(subscription)} text-white w-fit`}>
                       {loading ? "Loading..." : getStatusText(subscription)}
                     </Badge>
                     {(() => {
                       const graceInfo = getGracePeriodInfo(subscription);
                       if (graceInfo?.isWithinGracePeriod) {
                         return (
                           <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                             Grace Period: {graceInfo.daysRemaining} days left
              </Badge>
                         );
                       }
                       return null;
                     })()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Next Billing Date</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {loading ? "Loading..." : 
                    subscription?.cancelled_at ? 
                      'No further billing (cancelled)' :
                      subscription?.subscription_plans?.name === 'Free' ? 
                        'No expiry' : 
                        subscription?.current_period_end ? 
                          new Date(subscription.current_period_end).toLocaleDateString() : 
                          "N/A"}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Payment Method</h4>
                <p className="text-sm text-muted-foreground">
                  {loading ? "Loading..." : subscription?.stripe_subscription_id ? "Card" : "No payment method"}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/payment?plan=small">
                  Update Payment Method
                </Link>
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/pricing">
                  Upgrade Plan
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full">
              <Link href="/pricing">
                Upgrade Plan
              </Link>
            </Button>
            <Dialog 
              open={showCancelDialog} 
              onOpenChange={(open) => {
                setShowCancelDialog(open);
                // If dialog is closed (e.g., by clicking outside or ESC), reset canceling state
                if (!open) {
                  setIsCancelling(false);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Cancel Subscription
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Cancel Subscription
                  </DialogTitle>
                  <DialogDescription className="space-y-3">
                    <div>Are you sure you want to cancel your subscription?</div>
                    {(() => {
                      const graceInfo = getGracePeriodInfo(subscription);
                      if (graceInfo?.isWithinGracePeriod) {
                        return (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                              <div className="text-sm text-red-800">
                                <div className="font-medium">Immediate Cancellation:</div>
                                <ul className="mt-1 space-y-1 text-xs">
                                  <li>• You're within the 7-day grace period ({graceInfo.daysRemaining} days remaining)</li>
                                  <li>• Cancellation will downgrade you to Free tier immediately</li>
                                  <li>• You'll lose access to paid features right away</li>
                                  <li>• Refund may be possible by contacting our support team</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                              <div className="text-sm text-yellow-800">
                                <div className="font-medium">Cancellation After Grace Period:</div>
                                <ul className="mt-1 space-y-1 text-xs">
                                  <li>• You'll keep access until {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'the end of your billing period'}</li>
                                  <li>• After expiry, you'll be automatically downgraded to Free tier</li>
                                  <li>• You can reactivate anytime before then</li>
                                  <li>• All your data will be preserved</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCancelDialog(false)}
                    className="w-full sm:w-auto"
                    disabled={isCancelling}
                  >
                    Keep Subscription
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleCancelSubscription}
                    disabled={isCancelling}
                    className="w-full sm:w-auto"
                  >
                    {isCancelling ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Cancelling...
                      </>
                    ) : (
                      "Cancel Subscription"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Billing History */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>
            Download invoices and view your payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading billing history...</p>
              </div>
            </div>
          ) : billingHistory.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No billing history found.</p>
            </div>
          ) : (
          <div className="space-y-4">
              {billingHistory.map((transaction) => (
                <div key={transaction.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                        <p className="font-medium">{transaction.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.plan_name} • {transaction.payment_method_brand} •••• {transaction.payment_method_last4}
                      </p>
                    </div>
                  </div>
                </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="text-left sm:text-right">
                      <p className="font-medium">₱{(transaction.net_amount_cents / 1000).toFixed(2)}</p>
                    <Badge variant="secondary" className="text-green-600 bg-green-50">
                        {transaction.status}
                    </Badge>
                  </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full sm:w-auto"
                      onClick={() => generateInvoicePDF(transaction)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                </div>
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Information */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Current Usage</CardTitle>
          <CardDescription>
            Track your usage against your plan limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsage ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading usage data...</p>
              </div>
            </div>
          ) : usageData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>AI Insights Overall</span>
                  <span>
                    {usageData.aiInsightsOverall.current} / {usageData.aiInsightsOverall.limit === 9999 ? 'Unlimited' : usageData.aiInsightsOverall.limit}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ 
                      width: usageData.aiInsightsOverall.limit === 9999 
                        ? '0%' 
                        : `${Math.min((usageData.aiInsightsOverall.current / usageData.aiInsightsOverall.limit) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>AI Chat</span>
                  <span>
                    {usageData.aiChat.current} / {usageData.aiChat.limit === 9999 ? 'Unlimited' : usageData.aiChat.limit}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ 
                      width: usageData.aiChat.limit === 9999 
                        ? '0%' 
                        : `${Math.min((usageData.aiChat.current / usageData.aiChat.limit) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Events</span>
                  <span>
                    {usageData.events.current} / {usageData.events.limit === 9999 ? 'Unlimited' : usageData.events.limit}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ 
                      width: usageData.events.limit === 9999 
                        ? '0%' 
                        : `${Math.min((usageData.events.current / usageData.events.limit) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No usage data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Success Dialog */}
      <Dialog 
        open={showCancelSuccessDialog} 
        onOpenChange={(open) => {
          setShowCancelSuccessDialog(open);
          // If success dialog closes, ensure cancel dialog is also closed
          if (!open) {
            setShowCancelDialog(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              Subscription Cancelled
            </DialogTitle>
            <DialogDescription className="text-center py-4">
              <div className="space-y-3">
                <div className="text-lg font-medium">Your subscription has been cancelled successfully!</div>
                {(() => {
                  if (wasCancelledWithinGracePeriod) {
                    return (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                          <div className="text-sm text-red-800">
                            <div className="font-medium">Immediate Downgrade:</div>
                            <ul className="mt-1 space-y-1 text-xs">
                              <li>• You've been downgraded to Free tier immediately</li>
                              <li>• Paid features are no longer available</li>
                              <li>• You can upgrade again anytime</li>
                              <li>• All your data has been preserved</li>
                              <li>• Refund may be possible by contacting our support team</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          <div className="text-sm text-green-800">
                            <div className="font-medium">Access Until Expiry:</div>
                            <ul className="mt-1 space-y-1 text-xs">
                              <li>• You'll keep access until {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'the end of your billing period'}</li>
                              <li>• After expiry, you'll be automatically downgraded to Free tier</li>
                              <li>• No further charges will be made</li>
                              <li>• You can reactivate anytime before expiry</li>
                              <li>• All your data will be preserved</li>
                              <li>• No refund will be provided (grace period has expired)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-center">
            <Button 
              onClick={() => setShowCancelSuccessDialog(false)}
              className="w-full"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

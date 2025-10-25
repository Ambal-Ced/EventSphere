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
        
        // Refresh subscription data
        const updatedSubscription = await SubscriptionService.getUserSubscription(user.id);
        setSubscription(updatedSubscription);
        
        // Dispatch event to refresh other components
        window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
        
        setShowCancelDialog(false);
        setShowCancelSuccessDialog(true);
      } else {
        console.error('❌ Failed to cancel subscription');
        toast.error('Failed to cancel subscription. Please try again or contact support.');
      }
    } catch (error) {
      console.error('❌ Error cancelling subscription:', error);
      toast.error('An error occurred while cancelling your subscription. Please contact support.');
    } finally {
      setIsCancelling(false);
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
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
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
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Download
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>AI Insights Overall</span>
                <span>12 / 40</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '30%' }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>AI Chat</span>
                <span>8 / 30</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '27%' }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Events</span>
                <span>5 / 30</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '17%' }}></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Success Dialog */}
      <Dialog open={showCancelSuccessDialog} onOpenChange={setShowCancelSuccessDialog}>
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

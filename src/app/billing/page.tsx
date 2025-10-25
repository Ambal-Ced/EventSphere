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
  const [isCancelling, setIsCancelling] = useState(false);
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
    setIsCancelling(true);
    // Simulate API call
    setTimeout(() => {
      setIsCancelling(false);
      setShowCancelDialog(false);
      alert("Subscription cancelled successfully. This is a placeholder.");
    }, 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "cancelled": return "bg-red-500";
      case "past_due": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
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
              <Badge className={`${getStatusColor(subscription?.status || 'inactive')} text-white w-fit`}>
                {loading ? "Loading..." : (subscription?.status || 'inactive').charAt(0).toUpperCase() + (subscription?.status || 'inactive').slice(1)}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Next Billing Date</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {loading ? "Loading..." : 
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
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/pricing">
                  Change Plan
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
            <Button asChild className="w-full" variant="outline">
              <Link href="/pricing">
                Upgrade Plan
              </Link>
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link href="/payment?plan=small">
                Update Payment
              </Link>
            </Button>
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Cancel Subscription
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Cancel Subscription
                  </DialogTitle>
                  <DialogDescription>
                    Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your current billing period.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                    Keep Subscription
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleCancelSubscription}
                    disabled={isCancelling}
                  >
                    {isCancelling ? "Cancelling..." : "Cancel Subscription"}
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
                      <p className="text-xs text-muted-foreground">
                        Original: ₱{(transaction.original_amount_cents / 1000).toFixed(2)}
                      </p>
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
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, CreditCard, Download, AlertTriangle, CheckCircle } from "lucide-react";
import Link from "next/link";

// Mock data - in real app this would come from API
const mockSubscription = {
  plan: "Small Event Org",
  price: "₱159",
  period: "per month",
  status: "active",
  nextBilling: "2024-02-15",
  cardLast4: "4242",
  cardBrand: "Visa"
};

const mockInvoices = [
  {
    id: "INV-001",
    date: "2024-01-15",
    amount: "₱159.00",
    status: "paid",
    downloadUrl: "#"
  },
  {
    id: "INV-002", 
    date: "2023-12-15",
    amount: "₱159.00",
    status: "paid",
    downloadUrl: "#"
  },
  {
    id: "INV-003",
    date: "2023-11-15", 
    amount: "₱159.00",
    status: "paid",
    downloadUrl: "#"
  }
];

export default function BillingPage() {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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
                <h3 className="text-xl font-semibold">{mockSubscription.plan}</h3>
                <p className="text-muted-foreground">
                  {mockSubscription.price} {mockSubscription.period}
                </p>
              </div>
              <Badge className={`${getStatusColor(mockSubscription.status)} text-white w-fit`}>
                {mockSubscription.status.charAt(0).toUpperCase() + mockSubscription.status.slice(1)}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Next Billing Date</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(mockSubscription.nextBilling).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Payment Method</h4>
                <p className="text-sm text-muted-foreground">
                  {mockSubscription.cardBrand} •••• {mockSubscription.cardLast4}
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
          <div className="space-y-4">
            {mockInvoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">{invoice.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="text-left sm:text-right">
                    <p className="font-medium">{invoice.amount}</p>
                    <Badge variant="secondary" className="text-green-600 bg-green-50">
                      {invoice.status}
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

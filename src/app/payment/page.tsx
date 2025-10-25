"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, CreditCard, Lock, AlertCircle, CheckCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { clientPaymongoService } from "@/lib/client-paymongo";
import { supabase } from "@/lib/supabase";
import { SubscriptionService } from "@/lib/subscription";

const plans = {
  small: {
    name: "Small Event Org",
    price: "₱159",
    amount: 159000, // Amount in centavos (₱159.00)
    period: "per 30 days",
    planId: "small", // This should match your database plan ID
    features: [
      "40 AI insights overall",
      "50 AI insights per event", 
      "30 AI chat",
      "30 invite people",
      "30 events",
      "30 joinable events",
      "Fast AI accessibility"
    ]
  },
  large: {
    name: "Large Event Org", 
    price: "₱300",
    amount: 300000, // Amount in centavos (₱300.00)
    period: "per 30 days",
    planId: "large", // This should match your database plan ID
    features: [
      "85 AI insights overall",
      "85 AI insights per event",
      "75 AI chat", 
      "Unlimited invite people",
      "Unlimited events",
      "Unlimited joinable events",
      "Higher AI priority speed"
    ]
  }
};

function PaymentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planParam = searchParams.get('plan') as keyof typeof plans;
  
  // State for selected plan (can be changed on the page)
  const [selectedPlanKey, setSelectedPlanKey] = useState<keyof typeof plans>(planParam || 'small');
  const selectedPlan = plans[selectedPlanKey];
  
  const [formData, setFormData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardholderName: "",
    email: "",
    country: "PH"
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Debug logging function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugInfo(prev => [...prev, logMessage]);
  };

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          addDebugLog(`❌ Error getting session: ${error.message}`);
          return;
        }
        
        if (session?.user) {
          setUser(session.user);
          addDebugLog(`✅ User authenticated: ${session.user.email}`);
        } else {
          addDebugLog('❌ No user session found');
          router.push('/auth/login');
        }
      } catch (error) {
        addDebugLog(`❌ Error in getUser: ${error}`);
      }
    };

    getUser();
  }, [router]);

  // Add debug info on component mount
  useEffect(() => {
    addDebugLog('🚀 Payment form initialized');
    addDebugLog(`📋 Selected plan: ${selectedPlan.name} (${selectedPlan.price})`);
    addDebugLog(`💰 Amount: ${selectedPlan.amount} centavos`);
    addDebugLog(`🔧 Environment: ${process.env.NODE_ENV}`);
    addDebugLog(`🧪 Test mode: ${process.env.NEXT_PUBLIC_PAYMONGO_TEST_MODE}`);
    addDebugLog(`🔗 URL plan param: ${planParam || 'none'}`);
    addDebugLog(`🎯 Initial plan key: ${selectedPlanKey}`);
    addDebugLog(`🌐 Using client-side PayMongo service (API route)`);
  }, [selectedPlan, planParam, selectedPlanKey]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      addDebugLog('❌ No user found, but allowing payment for testing');
      // For testing purposes, we'll continue with a mock user ID
      // In production, you should redirect to login
      toast.warning('No user session found - using test mode');
    }

    setIsProcessing(true);
    setPaymentStatus('processing');
    setErrorMessage('');
    addDebugLog('🚀 Starting payment process...');

    try {
      // Validate form data
      addDebugLog('📝 Validating form data...');
      if (!formData.cardNumber || !formData.expiryDate || !formData.cvv || !formData.cardholderName) {
        throw new Error('Please fill in all required fields');
      }

      // Parse expiry date
      const [month, year] = formData.expiryDate.split('/');
      const expiryMonth = parseInt(month);
      const expiryYear = parseInt('20' + year); // Convert YY to YYYY

      addDebugLog(`💳 Card details: ${formData.cardNumber.replace(/\d(?=\d{4})/g, '*')} | ${expiryMonth}/${expiryYear} | ${formData.cardholderName}`);

      // Process payment with PayMongo
      addDebugLog('💳 Calling PayMongo service...');
      const paymentResult = await clientPaymongoService.processPayment({
        amount: selectedPlan.amount,
        currency: 'PHP',
        cardNumber: formData.cardNumber,
        expiryMonth,
        expiryYear,
        cvc: formData.cvv,
        cardholderName: formData.cardholderName,
        email: formData.email || (user?.email || 'test@example.com'),
        country: formData.country,
        metadata: {
          user_id: user?.id || 'test-user-id',
          plan: selectedPlan.planId,
          plan_name: selectedPlan.name,
          amount: selectedPlan.amount.toString(),
          currency: 'PHP'
        }
      });

      addDebugLog(`📊 Payment result: ${JSON.stringify(paymentResult)}`);

      if (paymentResult.success) {
        addDebugLog('✅ Payment successful!');
        
        if (user) {
          addDebugLog('✅ Creating subscription for authenticated user...');
          // Create subscription in database
          try {
            addDebugLog(`🔍 Attempting to create subscription for plan: "${selectedPlan.name}"`);
            // Extract transaction details from PayMongo response
            const paymentData = paymentResult.data?.data?.attributes;
            const paymentDetails = paymentData?.payments?.[0]?.attributes;
            
            addDebugLog(`💰 Payment details: ${JSON.stringify(paymentDetails)}`);
            
            const transactionDetails = {
              netAmountCents: paymentDetails?.net_amount || selectedPlan.amount,
              paymentMethodBrand: paymentDetails?.source?.brand,
              paymentMethodLast4: paymentDetails?.source?.last4,
              paymongoPaymentId: paymentDetails?.id,
              paymongoPaymentIntentId: paymentResult.paymentIntentId,
              originalAmountCents: selectedPlan.amount
            };
            
            addDebugLog(`📊 Transaction details: ${JSON.stringify(transactionDetails)}`);

            const subscription = await SubscriptionService.createSubscription(
              user.id,
              selectedPlan.name, // Use plan name instead of planId
              paymentResult.paymentIntentId,
              paymentResult.paymentMethodId,
              transactionDetails
            );

            if (subscription) {
              addDebugLog('✅ Subscription created successfully');
              addDebugLog(`📊 Subscription details: ${JSON.stringify(subscription)}`);
              setPaymentStatus('success');
              toast.success('Payment successful! Your subscription is now active.');
              
              // Dispatch event to refresh subscription data on other pages
              window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
              
              // Show success dialog instead of redirecting
              setShowSuccessDialog(true);
            } else {
              addDebugLog('❌ Subscription creation returned null');
              throw new Error('Failed to create subscription - returned null');
            }
          } catch (subError) {
            addDebugLog(`❌ Subscription creation failed: ${subError}`);
            addDebugLog(`❌ Error details: ${JSON.stringify(subError)}`);
            toast.error('Payment successful but failed to create subscription. Please contact support.');
            setPaymentStatus('error');
            setErrorMessage('Payment successful but subscription creation failed. Please contact support.');
          }
            } else {
              addDebugLog('✅ Payment successful! (Test mode - no subscription created)');
              setPaymentStatus('success');
              toast.success('Payment successful! (Test mode)');
              setShowSuccessDialog(true);
            }
      } else {
        addDebugLog(`❌ Payment failed: ${paymentResult.error}`);
        setPaymentStatus('error');
        setErrorMessage(paymentResult.error || 'Payment failed');
        toast.error(paymentResult.error || 'Payment failed');
      }

    } catch (error) {
      addDebugLog(`❌ Payment process error: ${error}`);
      setPaymentStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
      toast.error(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsProcessing(false);
      addDebugLog('🏁 Payment process completed');
    }
  };

  const formatCardNumber = (value: string) => {
    // Remove all spaces and format in groups of 4
    const cleaned = value.replace(/\s/g, '');
    return cleaned.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiryDate = (value: string) => {
    return value.replace(/\D/g, '').replace(/(\d{2})(\d{2})/, '$1/$2');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Pricing
        </Link>
      </div>

      {/* Debug Panel - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertCircle className="h-5 w-5" />
              Debug Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm">
                <strong>Environment:</strong> {process.env.NODE_ENV}
              </div>
              <div className="text-sm">
                <strong>Test Mode:</strong> {process.env.NEXT_PUBLIC_PAYMONGO_TEST_MODE || 'Not set'}
              </div>
              <div className="text-sm">
                <strong>User:</strong> {user ? `${user.email} (${user.id})` : 'Not authenticated'}
              </div>
              <div className="text-sm">
                <strong>Button Status:</strong> {isProcessing ? 'Processing...' : user ? 'Enabled (User authenticated)' : 'Enabled (Test mode)'}
              </div>
              <div className="text-sm">
                <strong>Selected Plan:</strong> {selectedPlan.name} - {selectedPlan.price} ({selectedPlan.amount} centavos)
              </div>
              <div className="text-sm">
                <strong>Plan Key:</strong> {selectedPlanKey}
              </div>
              <div className="text-sm">
                <strong>URL Plan Param:</strong> {planParam || 'none'}
              </div>
              <div className="text-sm">
                <strong>Payment Status:</strong> {paymentStatus}
              </div>
              {errorMessage && (
                <div className="text-sm text-red-600">
                  <strong>Error:</strong> {errorMessage}
                </div>
              )}
            </div>
            
            {/* Debug Logs */}
            <div className="mt-4">
              <h4 className="font-medium mb-2">Debug Logs:</h4>
              <div className="bg-black text-green-400 p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                {debugInfo.length === 0 ? (
                  <div className="text-gray-500">No debug logs yet...</div>
                ) : (
                  debugInfo.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Selection Switcher */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Select Your Plan
          </CardTitle>
          <CardDescription>
            Choose the plan that best fits your needs. You can change your selection here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(plans).map(([key, plan]) => (
              <div
                key={key}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedPlanKey === key
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => {
                  setSelectedPlanKey(key as keyof typeof plans);
                  addDebugLog(`🔄 Plan changed to: ${plan.name}`);
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{plan.price}</div>
                    <div className="text-sm text-muted-foreground">{plan.period}</div>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {plan.features.slice(0, 3).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-primary"></div>
                      {feature}
                    </li>
                  ))}
                  {plan.features.length > 3 && (
                    <li className="text-xs text-primary">+{plan.features.length - 3} more features</li>
                  )}
                </ul>
                {selectedPlanKey === key && (
                  <div className="mt-3 flex items-center gap-2 text-primary text-sm font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Selected Plan
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Status Messages */}
      {paymentStatus === 'success' && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Payment Successful!</span>
            </div>
            <p className="text-green-700 mt-2">Your subscription is now active. Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      )}

      {paymentStatus === 'error' && errorMessage && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Payment Failed</span>
            </div>
            <p className="text-red-700 mt-2">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Information
            </CardTitle>
            <CardDescription>
              Enter your payment details to complete your subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input
                    id="cardNumber"
                    name="cardNumber"
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    value={formData.cardNumber}
                    onChange={(e) => {
                      const formatted = formatCardNumber(e.target.value);
                      setFormData(prev => ({ ...prev, cardNumber: formatted }));
                    }}
                    maxLength={19}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      name="expiryDate"
                      type="text"
                      placeholder="MM/YY"
                      value={formData.expiryDate}
                      onChange={(e) => {
                        const formatted = formatExpiryDate(e.target.value);
                        setFormData(prev => ({ ...prev, expiryDate: formatted }));
                      }}
                      maxLength={5}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      name="cvv"
                      type="text"
                      placeholder="123"
                      value={formData.cvv}
                      onChange={handleInputChange}
                      maxLength={4}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="cardholderName">Cardholder Name</Label>
                  <Input
                    id="cardholderName"
                    name="cardholderName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.cardholderName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select value={formData.country} onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PH">Philippines</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="SG">Singapore</SelectItem>
                      <SelectItem value="MY">Malaysia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={isProcessing}>
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing Payment...
                  </div>
                ) : paymentStatus === 'success' ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Payment Successful!
                  </div>
                ) : (
                  `Pay ${selectedPlan.price}/${selectedPlan.period}`
                )}
              </Button>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Your payment information is secure and encrypted
              </div>

              {/* Test Card Information - Only show in development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">🧪 Test Cards (Development Only)</h4>
                  <div className="text-xs text-blue-700 space-y-1">
                    <div><strong>Visa:</strong> 4343434343434345</div>
                    <div><strong>Mastercard:</strong> 5555444444444457</div>
                    <div><strong>Expiry:</strong> Any future date (e.g., 12/25)</div>
                    <div><strong>CVC:</strong> Any 3-digit number (e.g., 123)</div>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{selectedPlan.name}</h3>
                  <p className="text-sm text-muted-foreground">Billed every 30 days</p>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{selectedPlan.price}</div>
                  <div className="text-sm text-muted-foreground">/{selectedPlan.period}</div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">What's included:</h4>
                <ul className="space-y-2 text-sm">
                  {selectedPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center font-semibold">
                <span>Total</span>
                <span>{selectedPlan.price}/{selectedPlan.period}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                You'll be charged every 30 days. Cancel anytime.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              Payment Successful!
            </DialogTitle>
            <DialogDescription className="text-center py-4">
              <div className="space-y-2">
                <p className="text-lg font-medium">Your subscription is now active!</p>
                <p className="text-sm text-muted-foreground">
                  You can now enjoy all the features of your {selectedPlan.name} plan.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-center">
            <Button 
              onClick={() => {
                setShowSuccessDialog(false);
                router.push('/billing');
              }}
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

function PaymentLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading payment form...</p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentLoading />}>
      <PaymentForm />
    </Suspense>
  );
}
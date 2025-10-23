"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CreditCard, Lock } from "lucide-react";
import Link from "next/link";

const plans = {
  small: {
    name: "Small Event Org",
    price: "₱159",
    period: "per month",
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
    period: "per month",
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
  const planParam = searchParams.get('plan') as keyof typeof plans;
  const selectedPlan = plans[planParam] || plans.small;
  
  const [formData, setFormData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardholderName: "",
    email: "",
    country: "PH"
  });
  
  const [isProcessing, setIsProcessing] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      alert("Payment processing would happen here. This is a placeholder page.");
    }, 2000);
  };

  const formatCardNumber = (value: string) => {
    return value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiryDate = (value: string) => {
    return value.replace(/\D/g, '').replace(/(\d{2})(\d{2})/, '$1/$2');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Pricing
        </Link>
      </div>

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
                {isProcessing ? "Processing..." : `Pay ${selectedPlan.price}/${selectedPlan.period}`}
              </Button>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Your payment information is secure and encrypted
              </div>
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
                  <p className="text-sm text-muted-foreground">Billed monthly</p>
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
                You'll be charged monthly. Cancel anytime.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
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
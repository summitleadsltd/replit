import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { CheckCircle, CreditCard, Lock } from "lucide-react";

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  plan?: {
    name: string;
    price: number;
  };
}

const SUBSCRIPTION_PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 299,
    interval: "monthly",
    features: [
      "Up to 5 users",
      "Basic CRM",
      "Email marketing",
      "Appointment scheduling",
      "Mobile technician app",
      "Basic reporting",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 599,
    interval: "monthly",
    features: [
      "Up to 20 users",
      "Predictive dialer",
      "SMS & WhatsApp automation",
      "Lead qualification scoring",
      "Sales pipeline management",
      "Digital proposals",
      "Advanced analytics",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 1299,
    interval: "monthly",
    features: [
      "Unlimited users",
      "Multi-location management",
      "Custom integrations",
      "AI automation suite",
      "Contract management",
      "Installation scheduling",
      "Customer portal",
      "Dedicated account manager",
    ],
  },
];

export default function SubscriptionModal({ open, onClose, plan }: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState(plan?.name || "professional");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<"plan" | "payment" | "success">("plan");

  const selectedPlanData = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan) || SUBSCRIPTION_PLANS[1];

  const handleContinue = () => {
    if (step === "plan") {
      setStep("payment");
    } else if (step === "payment") {
      handlePayment();
    }
  };

  const handlePayment = async () => {
    if (!cardNumber || !expiryDate || !cvc || !name) {
      toast.error("Please fill in all payment details");
      return;
    }

    setProcessing(true);

    // Simulate payment processing
    setTimeout(() => {
      setProcessing(false);
      setStep("success");
      toast.success("Subscription activated successfully!");
    }, 2000);
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(" ");
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  const getAnnualPrice = (monthlyPrice: number) => {
    return Math.round(monthlyPrice * 12 * 0.8); // 20% discount for yearly
  };

  const getCurrentPrice = () => {
    return billingCycle === "monthly" 
      ? selectedPlanData.price 
      : getAnnualPrice(selectedPlanData.price);
  };

  const getCurrentInterval = () => {
    return billingCycle === "monthly" ? "month" : "year";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {step === "success" ? "Welcome to Summit Voice CRM!" : "Choose Your Plan"}
          </DialogTitle>
        </DialogHeader>

        {step === "plan" && (
          <div className="space-y-6">
            {/* Billing Cycle Toggle */}
            <div className="flex justify-center">
              <div className="inline-flex bg-muted rounded-lg p-1">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    billingCycle === "monthly"
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    billingCycle === "yearly"
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Yearly <span className="text-green-600 ml-1">Save 20%</span>
                </button>
              </div>
            </div>

            {/* Plan Selection */}
            <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
              <div className="space-y-4">
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    } ${plan.popular ? "relative" : ""}`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 right-4">
                        <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <div className="mt-2">
                            <span className="text-3xl font-bold">
                              ${billingCycle === "monthly" ? plan.price : getAnnualPrice(plan.price)}
                            </span>
                            <span className="text-muted-foreground">
                              /{billingCycle === "monthly" ? "month" : "year"}
                            </span>
                          </div>
                        </div>
                        <RadioGroupItem value={plan.id} id={plan.id} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </RadioGroup>

            <Button
              onClick={handleContinue}
              className="w-full"
              size="lg"
            >
              Continue to Payment
            </Button>
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-6">
            {/* Order Summary */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{selectedPlanData.name} Plan</div>
                    <div className="text-sm text-muted-foreground">
                      Billed {billingCycle === "monthly" ? "monthly" : "yearly"}
                    </div>
                  </div>
                  <div className="font-bold">
                    ${getCurrentPrice()}/{getCurrentInterval()}
                  </div>
                </div>
                <div className="border-t border-border pt-3 flex justify-between items-center">
                  <span className="font-medium">Total due today</span>
                  <span className="font-bold text-xl">${getCurrentPrice()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Cardholder Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={formatCardNumber(cardNumber)}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, ""))}
                    maxLength={19}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input
                      id="expiry"
                      placeholder="MM/YY"
                      value={formatExpiryDate(expiryDate)}
                      onChange={(e) => setExpiryDate(e.target.value.replace(/\//g, ""))}
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvc">CVC</Label>
                    <Input
                      id="cvc"
                      placeholder="123"
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/[^0-9]/g, ""))}
                      maxLength={4}
                    />
                  </div>
                </div>

                <div className="flex items-center text-xs text-muted-foreground">
                  <Lock className="w-3 h-3 mr-1" />
                  Your payment information is secure and encrypted
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("plan")} className="flex-1">
                Back
              </Button>
              <Button onClick={handlePayment} className="flex-1" disabled={processing}>
                {processing ? "Processing..." : `Pay $${getCurrentPrice()}`}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            
            <div>
              <h3 className="text-2xl font-bold mb-2">You're all set!</h3>
              <p className="text-muted-foreground">
                Your {selectedPlanData.name} plan is now active. You can start using all features immediately.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{selectedPlanData.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Billing cycle</span>
                <span className="font-medium">
                  {billingCycle === "monthly" ? "Monthly" : "Yearly"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">${getCurrentPrice()}/{getCurrentInterval()}</span>
              </div>
            </div>

            <Button onClick={onClose} className="w-full" size="lg">
              Go to Dashboard
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
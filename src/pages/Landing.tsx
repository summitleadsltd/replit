import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import summitLogo from "@/assets/summit-logo.webp";
import SubscriptionModal from "@/components/payment/SubscriptionModal";
import {
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  Users,
  Wrench,
  FileText,
  CheckCircle,
  Check,
  X,
  ArrowRight,
  Star,
  ChevronRight,
  Menu,
  X as XIcon,
  CalendarClock,
  Route,
  Sparkles,
  TrendingUp,
  Zap,
  Shield,
  Smartphone,
  Globe,
  BarChart,
  Users as UsersIcon,
  Navigation,
  CheckSquare,
  Radio,
  DollarSign,
  Building2,
  Clock as ClockIcon,
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ name: string; price: number } | undefined>();
  const [showComparison, setShowComparison] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const handleGetStarted = () => {
    if (email) {
      navigate("/auth", { state: { email } });
    } else {
      setShowComparison(true);
    }
  };

  const handleLogin = () => {
    navigate("/auth");
  };

  const handleSubscribe = (planName?: string, planPrice?: number) => {
    setSelectedPlan(planName ? { name: planName, price: planPrice || 0 } : undefined);
    setSubscriptionModalOpen(true);
  };

  const toggleFAQ = (index: number) => {
    setActiveFAQ(activeFAQ === index ? null : index);
  };

  const getAnnualPrice = (monthlyPrice: number) => {
    return Math.round(monthlyPrice * 12 * 0.8); // 20% discount for yearly
  };

  const getCurrentPrice = (price: number) => {
    return billingCycle === "monthly" ? price : getAnnualPrice(price);
  };

  const starterFeatures = [
    "Lead Management",
    "Contact Management",
    "Import Leads",
    "Campaign Management",
    "Calendar Scheduling",
    "Technician Assignment",
    "Dispatch Center",
    "Route Optimization",
    "Customer Appointment Confirmations",
    "Technician Mobile App",
    "GPS Navigation Button",
    "Photo Uploads",
    "Inspection Outcomes",
    "Dashboard Reporting",
  ];

  const professionalFeatures = [
    ...starterFeatures,
    "Power Dialer",
    "Predictive Dialer",
    "Call Recording",
    "Dispositions",
    "Callbacks",
    "Opportunity Pipeline",
    "Inspection-to-Sales Handoff",
    "Lead Qualification Scoring",
    "Proposal Tracking",
    "Activity Timeline",
    "AI Call Summaries",
    "Team Performance Dashboard",
    "Sales Forecasting",
  ];

  const enterpriseFeatures = [
    ...professionalFeatures,
    "SMS Campaigns",
    "SMS Inbox",
    "Email Campaigns",
    "Email Automation",
    "WhatsApp Messaging",
    "WhatsApp Campaigns",
    "Chatwoot Unified Inbox",
    "n8n Workflow Automation",
    "AI Inspection Summaries",
    "AI Lead Scoring",
    "AI Route Optimization",
    "Multi-Provider Telephony",
    "Client Portal",
    "Customer Tracking Links",
    "Installation Management",
    "Crew Management",
    "API Access",
    "White Label Options",
    "Priority Support",
  ];

  const pricingPlans = [
    {
      name: "Starter",
      title: "Appointment Scheduling",
      price: 299,
      users: 5,
      description: "Perfect for appointment setters, solar lead generation companies, call centers, and small home-service businesses.",
      features: starterFeatures,
      excluded: ["Dialer", "SMS", "Email", "WhatsApp", "Sales Pipeline"],
      popular: false,
    },
    {
      name: "Professional",
      title: "Appointment Scheduling + Sales Workflow",
      price: 599,
      users: 10,
      description: "Everything in Starter plus sales workflow and communication tools.",
      features: professionalFeatures,
      excluded: ["WhatsApp", "Omnichannel Inbox", "Advanced Automation"],
      popular: true,
    },
    {
      name: "Enterprise",
      title: "Complete Revenue Operations Platform",
      price: 1299,
      users: null,
      description: "Everything in Professional plus complete communication and automation.",
      features: enterpriseFeatures,
      excluded: [],
      popular: false,
    },
  ];

  const faqs = [
    {
      question: "Why is Summit Leads different?",
      answer: "Unlike competitors who force you to buy features you don't need, Summit Leads lets you start with appointment scheduling and grow into a complete sales operation. You can upgrade into a full field-service + communication platform as your business grows, paying only for what you use.",
    },
    {
      question: "Do I need multiple systems?",
      answer: "No. Summit Leads replaces the need for multiple systems like JobNibus + Dialer + SMS Tool + Email Tool + Automation Tool. One platform handles everything from appointment scheduling to customer communication.",
    },
    {
      question: "Can I import my existing leads?",
      answer: "Yes. Summit Leads supports CSV import with column mapping, validation, and bulk assignment. You can import your existing leads from any CRM or spreadsheet.",
    },
    {
      question: "Can technicians use mobile devices?",
      answer: "Absolutely. Our technician mobile app includes GPS navigation, inspection forms, photo uploads, and real-time job updates. Technicians can manage their entire workflow from their smartphones.",
    },
    {
      question: "Does it support SMS and WhatsApp?",
      answer: "Yes, SMS and WhatsApp are included in the Professional and Enterprise plans. You can send campaigns, manage conversations, and automate customer communication across all channels.",
    },
    {
      question: "Can I white-label the platform?",
      answer: "Yes, white-label options are available in the Enterprise plan. You can customize branding, domain, and appearance to match your company identity.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <img src={summitLogo} alt="Summit Leads" className="h-8 w-8" />
              <span className="font-bold text-xl">Summit Leads</span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => setShowComparison(true)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Compare
              </button>
              <button onClick={() => setShowFAQ(true)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </button>
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Button variant="ghost" onClick={handleLogin}>
                Sign In
              </Button>
              <Button onClick={() => setShowComparison(true)}>
                Start Free Trial
              </Button>
            </div>

            <button
              className="md:hidden p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <XIcon size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-4 py-4 space-y-4">
              <button onClick={() => setShowComparison(true)} className="block text-sm text-muted-foreground hover:text-foreground">
                Compare
              </button>
              <button onClick={() => setShowFAQ(true)} className="block text-sm text-muted-foreground hover:text-foreground">
                FAQ
              </button>
              <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground">
                Features
              </a>
              <a href="#pricing" className="block text-sm text-muted-foreground hover:text-foreground">
                Pricing
              </a>
              <div className="pt-4 space-y-2">
                <Button variant="ghost" className="w-full" onClick={handleLogin}>
                  Sign In
                </Button>
                <Button className="w-full" onClick={() => setShowComparison(true)}>
                  Start Free Trial
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Stop Paying For 5 Different Systems.
            </h1>
            <p className="text-xl text-muted-foreground mb-4">
              Schedule Appointments, Manage Technicians, Close More Sales, And Automate Customer Communication From One Platform.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Built specifically for solar, roofing, home improvement, HVAC, and field service businesses.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <div className="flex w-full sm:w-auto max-w-md">
                <Input
                  type="email"
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-r-none border-r-0"
                />
                <Button onClick={handleGetStarted}>
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={handleLogin}>
                Book Demo
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                No credit card required
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                14-day free trial
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                Cancel anytime
              </div>
            </div>
          </div>

          {/* Social Proof */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">10,000+</div>
              <div className="text-sm text-muted-foreground">Appointments Managed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">$50M+</div>
              <div className="text-sm text-muted-foreground">Revenue Tracked</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">500+</div>
              <div className="text-sm text-muted-foreground">High-Performance Teams</div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Summit Leads?</h2>
            <p className="text-lg text-muted-foreground">Built specifically for field service businesses, not generic platforms.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full bg-background rounded-lg overflow-hidden">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium">Feature</th>
                  <th className="text-center p-4 font-medium">Summit Leads</th>
                  <th className="text-center p-4 font-medium">JobNimbus</th>
                  <th className="text-center p-4 font-medium">ServiceTitan</th>
                  <th className="text-center p-4 font-medium">Housecall Pro</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-4">Predictive Dialer</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4">SMS Campaigns</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center">Limited</td>
                  <td className="p-4 text-center">Limited</td>
                  <td className="p-4 text-center">Limited</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4">WhatsApp</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4">AI Call Summaries</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4">Dispatch Center</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4">Route Optimization</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center">Limited</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center">Limited</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4">Technician GPS Tracking</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center">Limited</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center">Limited</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4">Inspection Workflow</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center">Partial</td>
                  <td className="p-4 text-center">Partial</td>
                  <td className="p-4 text-center">Partial</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4">Customer Portal</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center">Limited</td>
                </tr>
                <tr>
                  <td className="p-4">Multi-Tenant SaaS</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
n      {/* Detailed Comparisons */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Detailed Competitor Comparisons</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See how Summit Leads compares to other field service and CRM platforms in detail.
            </p>
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Link to="/compare/jobnimbus" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="font-semibold mb-2">JobNimbus</div>
                  <div className="text-sm text-muted-foreground">Field Service CRM</div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/compare/servicetitan" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="font-semibold mb-2">ServiceTitan</div>
                  <div className="text-sm text-muted-foreground">Enterprise FSM</div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/compare/housecall-pro" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="font-semibold mb-2">Housecall Pro</div>
                  <div className="text-sm text-muted-foreground">Small Business FSM</div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/compare/gohighlevel" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="font-semibold mb-2">GoHighLevel</div>
                  <div className="text-sm text-muted-foreground">Marketing Platform</div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/compare/hubspot" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="font-semibold mb-2">HubSpot</div>
                  <div className="text-sm text-muted-foreground">B2B CRM</div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">One Platform, Complete Operations</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start with appointment scheduling, grow into sales operations, upgrade into complete field-service platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-border hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <CalendarClock className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Scheduling</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Appointment scheduling optimized by technician availability, travel time and territory.</p>
              </CardContent>
            </Card>

            <Card className="border-border hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Convert inspections into opportunities automatically with our sales handoff engine.</p>
              </CardContent>
            </Card>

            <Card className="border-border hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Communication</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Call, SMS, Email and WhatsApp from one platform. Reach customers where they are.</p>
              </CardContent>
            </Card>

            <Card className="border-border hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Route className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Field Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Dispatch, inspections, GPS tracking and installation management in one system.</p>
              </CardContent>
            </Card>

            <Card className="border-border hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Automation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Automate follow-ups, reminders and customer journeys with AI-powered workflows.</p>
              </CardContent>
            </Card>

            <Card className="border-border hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">AI-Powered</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">AI call summaries, inspection reports, and predictive analytics to close more deals.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple Pricing, Clear Upgrade Path</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start with what you need, upgrade as you grow. No forced feature bundles.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingCycle === "monthly"
                    ? "bg-background text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingCycle === "yearly"
                    ? "bg-background text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yearly <span className="text-green-600 ml-1">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative border-2 ${
                  plan.popular
                    ? "border-primary shadow-lg scale-105"
                    : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.title}</CardTitle>
                  <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${getCurrentPrice(plan.price)}</span>
                    <span className="text-muted-foreground">/{billingCycle === "monthly" ? "month" : "year"}</span>
                    {plan.users && <span className="text-sm text-muted-foreground ml-2">({plan.users} users included)</span>}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.slice(0, 8).map((feature, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.features.length > 8 && (
                      <li className="flex items-start text-sm text-muted-foreground">
                        +{plan.features.length - 8} more features
                      </li>
                    )}
                  </ul>
                  {plan.excluded.length > 0 && (
                    <div className="border-t border-border pt-3 mb-6">
                      <p className="text-sm text-muted-foreground mb-2">Upgrade for:</p>
                      <ul className="space-y-2">
                        {plan.excluded.map((feature, index) => (
                          <li key={index} className="flex items-start text-sm text-muted-foreground">
                            <X className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.name, plan.price)}
                  >
                    {plan.popular ? "Start Free Trial" : "Get Started"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Upgrade Strategy */}
          <div className="mt-16 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-center mb-8">Clear Upgrade Path</h3>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-primary">Starter</div>
                <div className="text-2xl font-bold">$299</div>
                <div className="text-sm text-muted-foreground">Scheduling</div>
              </div>
              <ArrowRight className="text-muted-foreground" />
              <div className="text-center">
                <div className="text-lg font-semibold text-primary">Professional</div>
                <div className="text-2xl font-bold">$599</div>
                <div className="text-sm text-muted-foreground">+ Sales</div>
              </div>
              <ArrowRight className="text-muted-foreground" />
              <div className="text-center">
                <div className="text-lg font-semibold text-primary">Enterprise</div>
                <div className="text-2xl font-bold">$1,299</div>
                <div className="text-sm text-muted-foreground">+ Everything</div>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6">
              Need a dialer? Upgrade to Professional. Need SMS/WhatsApp? Upgrade to Enterprise.
            </p>
          </div>
        </div>
      </section>

      {/* Enterprise Value Proposition */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Replace Multiple Systems with One Platform</h2>
            <p className="text-lg text-muted-foreground">
              Stop paying for separate systems. Summit Leads Enterprise replaces them all.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="p-6 bg-muted rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-red-500">Before: Multiple Systems</h3>
              <ul className="space-y-3">
                <li className="flex justify-between"><span>JobNimbus</span><span>$300+</span></li>
                <li className="flex justify-between"><span>Dialer</span><span>$200+</span></li>
                <li className="flex justify-between"><span>SMS Tool</span><span>$100+</span></li>
                <li className="flex justify-between"><span>Email Tool</span><span>$100+</span></li>
                <li className="flex justify-between"><span>Automation</span><span>$150+</span></li>
                <li className="flex justify-between"><span>Scheduling</span><span>$50+</span></li>
                <li className="flex justify-between border-t border-border pt-3 mt-3 font-semibold">
                  <span>Total</span>
                  <span className="text-red-500">$900+/month</span>
                </li>
              </ul>
            </div>

            <div className="p-6 bg-primary/10 rounded-lg border-2 border-primary">
              <h3 className="text-lg font-semibold mb-4 text-primary">After: Summit Leads Enterprise</h3>
              <div className="text-4xl font-bold text-primary mb-2">$1,299</div>
              <p className="text-muted-foreground mb-4">/month for everything</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center"><Check className="w-4 h-4 text-green-500 mr-2" />One login</li>
                <li className="flex items-center"><Check className="w-4 h-4 text-green-500 mr-2" />One platform</li>
                <li className="flex items-center"><Check className="w-4 h-4 text-green-500 mr-2" />One support team</li>
                <li className="flex items-center"><Check className="w-4 h-4 text-green-500 mr-2" />One bill to manage</li>
              </ul>
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">Save $600+/month</div>
            <p className="text-muted-foreground">Get more features for less money</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full text-left flex items-center justify-between"
                  >
                    <span className="font-medium">{faq.question}</span>
                    <ChevronRight
                      className={`transition-transform ${
                        activeFAQ === index ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  {activeFAQ === index && (
                    <div className="mt-4 text-muted-foreground">
                      {faq.answer}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Stop Paying for Multiple Systems?</h2>
          <p className="text-xl text-primary-foreground/80 mb-8">
            Start with appointment scheduling, grow into a complete sales operation, and upgrade into a full field-service platform. One platform, one bill, unlimited growth.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setShowComparison(true)}
              className="bg-background text-foreground hover:bg-background/90"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
              onClick={handleLogin}
            >
              Book Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src={summitLogo} alt="Summit Leads" className="h-8 w-8" />
                <span className="font-bold text-lg">Summit Leads</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Appointment scheduling, sales workflow, and field service management in one platform.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground">Comparisons</a></li>
                <li><a href="#" className="hover:text-foreground">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Blog</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
                <li><a href="#" className="hover:text-text-foreground">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 Summit Leads. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Comparison Modal */}
      {showComparison && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Choose Your Plan</h2>
                <button onClick={() => setShowComparison(false)} className="text-muted-foreground hover:text-foreground">
                  <XIcon size={24} />
                </button>
              </div>
              <p className="text-muted-foreground mb-6">
                Start with scheduling, upgrade as you grow. No forced features.
              </p>
              <div className="space-y-4">
                {pricingPlans.map((plan) => (
                  <Card key={plan.name} className={plan.popular ? "border-2 border-primary" : "border-border"}>
                    <CardHeader>
                      <CardTitle className="text-xl">{plan.title}</CardTitle>
                      <CardTitle className="text-2xl">${getCurrentPrice(plan.price)}/{billingCycle === "monthly" ? "month" : "year"}</CardTitle>
                      {plan.users && <p className="text-sm text-muted-foreground">{plan.users} users included</p>}
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                        onClick={() => {
                          setShowComparison(false);
                          handleSubscribe(plan.name, plan.price);
                        }}
                      >
                        {plan.popular ? "Start Free Trial" : "Get Started"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {showFAQ && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
                <button onClick={() => setShowFAQ(false)} className="text-muted-foreground hover:text-foreground">
                  <XIcon size={24} />
                </button>
              </div>
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">{faq.question}</h3>
                      <p className="text-muted-foreground text-sm">{faq.answer}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      <SubscriptionModal
        open={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        plan={selectedPlan}
      />
    </div>
  );
}
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Zap,
  BarChart3,
  Shield,
  Clock,
  MapPin,
  Smartphone,
  TrendingUp,
  Target,
  Workflow,
  Sparkles,
  ArrowRight,
  Star,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ name: string; price: number } | undefined>();

  const handleGetStarted = () => {
    if (email) {
      navigate("/auth", { state: { email } });
    } else {
      navigate("/auth");
    }
  };

  const handleLogin = () => {
    navigate("/auth");
  };

  const handleSubscribe = (planName?: string, planPrice?: number) => {
    setSelectedPlan(planName ? { name: planName, price: planPrice || 0 } : undefined);
    setSubscriptionModalOpen(true);
  };

  const features = [
    {
      icon: Phone,
      title: "Predictive Dialer",
      description: "AI-powered dialing that connects agents with leads 3x faster. Skip voicemas, maximize talk time.",
    },
    {
      icon: MessageSquare,
      title: "Multi-Channel Communication",
      description: "SMS, Email, and WhatsApp automation in one platform. Reach leads where they are.",
    },
    {
      icon: Calendar,
      title: "Smart Appointment Scheduling",
      description: "Automated booking, technician assignment, and route optimization. No more scheduling conflicts.",
    },
    {
      icon: Users,
      title: "Complete CRM",
      description: "Lead management, contact history, and activity tracking from first contact to final sale.",
    },
    {
      icon: Wrench,
      title: "Technician Mobile App",
      description: "GPS tracking, on-route mode, arrival verification, and inspection workflows in the field.",
    },
    {
      icon: FileText,
      title: "Digital Proposals & Contracts",
      description: "PDF generation, e-signature integration, and contract workflow automation.",
    },
    {
      icon: Target,
      title: "Lead Qualification Scoring",
      description: "AI-powered scoring based on inspection data. Automatically identify hot leads.",
    },
    {
      icon: Workflow,
      title: "Sales Pipeline Management",
      description: "Visual pipeline from lead to close. Track every opportunity through automated stages.",
    },
    {
      icon: Sparkles,
      title: "AI Automation",
      description: "Call summaries, inspection reports, and predictive analytics powered by artificial intelligence.",
    },
  ];

  const workflowSteps = [
    {
      step: "1",
      title: "Lead Generation",
      description: "Import from Facebook, Google Ads, website forms, or CSV. Automatic lead capture and distribution.",
    },
    {
      step: "2",
      title: "Intelligent Outreach",
      description: "Predictive dialer calls agents while SMS sequences nurture leads. AI prioritizes best prospects.",
    },
    {
      step: "3",
      title: "Appointment Booking",
      description: "Automated scheduling with technician assignment. Route optimization and customer notifications.",
    },
    {
      step: "4",
      title: "On-Site Inspection",
      description: "Technician mobile app with GPS verification. Multi-step inspection wizard with photo uploads.",
    },
    {
      step: "5",
      title: "Auto Qualification",
      description: "AI scores leads based on property, electrical, and customer data. Hot leads auto-assigned to closers.",
    },
    {
      step: "6",
      title: "Proposal & Contract",
      description: "Digital proposals sent instantly. E-signature contracts. Automated installation scheduling.",
    },
    {
      step: "7",
      title: "Installation Management",
      description: "Crew scheduling, materials tracking, and installation status updates. Customer portal for transparency.",
    },
    {
      step: "8",
      title: "Completion & Referral",
      description: "Automatic review requests, referral tracking, and customer satisfaction monitoring.",
    },
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: 299,
      description: "Perfect for small teams getting started",
      features: [
        "Up to 5 users",
        "Basic CRM",
        "Email marketing",
        "Appointment scheduling",
        "Mobile technician app",
        "Basic reporting",
        "Email support",
      ],
      popular: false,
    },
    {
      name: "Professional",
      price: 599,
      description: "For growing businesses with full sales teams",
      features: [
        "Up to 20 users",
        "Everything in Starter",
        "Predictive dialer",
        "SMS & WhatsApp automation",
        "Lead qualification scoring",
        "Sales pipeline management",
        "Digital proposals",
        "Advanced analytics",
        "Priority support",
      ],
      popular: true,
    },
    {
      name: "Enterprise",
      price: 1299,
      description: "For large-scale operations with multiple locations",
      features: [
        "Unlimited users",
        "Everything in Professional",
        "Multi-location management",
        "Custom integrations",
        "AI automation suite",
        "Contract management",
        "Installation scheduling",
        "Customer portal",
        "Dedicated account manager",
        "SLA guarantee",
      ],
      popular: false,
    },
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "CEO, SolarMax Solutions",
      content: "We increased our close rate by 40% in the first month. The automated lead scoring alone was worth the investment.",
      avatar: "SJ",
    },
    {
      name: "Michael Chen",
      role: "Operations Director, RoofRight",
      content: "The technician app transformed our field operations. GPS tracking and route optimization saved us 20 hours per week.",
      avatar: "MC",
    },
    {
      name: "Emily Rodriguez",
      role: "Sales Manager, Home Improvement Pros",
      content: "Finally, a platform that connects our entire lifecycle from lead to installation. No more disconnected systems.",
      avatar: "ER",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <img src={summitLogo} alt="Summit Voice CRM" className="h-8 w-8" />
              <span className="font-bold text-xl">Summit Voice CRM</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#workflow" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Testimonials
              </a>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Button variant="ghost" onClick={handleLogin}>
                Sign In
              </Button>
              <Button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
                Get Started
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-4 py-4 space-y-4">
              <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground">
                Features
              </a>
              <a href="#workflow" className="block text-sm text-muted-foreground hover:text-foreground">
                How It Works
              </a>
              <a href="#pricing" className="block text-sm text-muted-foreground hover:text-foreground">
                Pricing
              </a>
              <a href="#testimonials" className="block text-sm text-muted-foreground hover:text-foreground">
                Testimonials
              </a>
              <div className="pt-4 space-y-2">
                <Button variant="ghost" className="w-full" onClick={handleLogin}>
                  Sign In
                </Button>
                <Button className="w-full" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
                  Get Started
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
            <div className="inline-flex items-center space-x-2 bg-primary/10 rounded-full px-4 py-1.5 mb-8">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Field Service Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              One Platform. Complete
              <span className="text-primary"> Lifecycle</span> Management.
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              From lead generation to installation completion. Automate your entire field service operation 
              with AI-powered dialing, intelligent scheduling, and seamless technician management.
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
                <Button onClick={handleGetStarted} className="rounded-l-none">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={handleLogin}>
                <Clock className="mr-2 h-4 w-4" />
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

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">3x</div>
              <div className="text-sm text-muted-foreground">Faster Lead Response</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">40%</div>
              <div className="text-sm text-muted-foreground">Higher Close Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">20h</div>
              <div className="text-sm text-muted-foreground">Saved Per Week</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">98%</div>
              <div className="text-sm text-muted-foreground">Customer Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to Scale
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A complete platform built for field service businesses. Stop juggling multiple tools.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-border hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From first contact to final installation. Automate every step of your customer lifecycle.
            </p>
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 transform -translate-y-1/2" />

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {workflowSteps.map((step, index) => (
                <div key={index} className="relative">
                  <Card className="border-border hover:border-primary/50 transition-colors h-full">
                    <CardHeader>
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mb-4">
                        {step.step}
                      </div>
                      <CardTitle className="text-lg">{step.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </CardContent>
                  </Card>

                  {/* Arrow for mobile */}
                  {index < workflowSteps.length - 1 && (
                    <div className="lg:hidden flex justify-center my-4">
                      <ChevronRight className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your business. All plans include a 14-day free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card
                key={index}
                className={`relative border-2 ${
                  plan.popular
                    ? "border-primary shadow-lg scale-105"
                    : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <p className="text-muted-foreground text-sm">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
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

          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Need a custom enterprise solution? 
            </p>
            <Button variant="outline" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
              Contact Sales
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Trusted by Field Service Leaders
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See why businesses choose Summit Voice CRM to transform their operations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6">{testimonial.content}</p>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">{testimonial.avatar}</span>
                    </div>
                    <div>
                      <div className="font-medium">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-8">
            Join hundreds of field service businesses already using Summit Voice CRM to scale their operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="secondary"
              onClick={handleGetStarted}
              className="bg-background text-foreground hover:bg-background/90"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
            >
              Schedule a Demo
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
                <img src={summitLogo} alt="Summit Voice CRM" className="h-8 w-8" />
                <span className="font-bold text-lg">Summit Voice CRM</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The complete field service management platform from lead to installation.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground">Integrations</a></li>
                <li><a href="#" className="hover:text-foreground">API</a></li>
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
                <li><a href="#" className="hover:text-foreground">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 Summit Voice CRM. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Subscription Modal */}
      <SubscriptionModal
        open={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        plan={selectedPlan}
      />
    </div>
  );
}
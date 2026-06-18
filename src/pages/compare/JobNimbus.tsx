import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, ArrowRight, Home, Phone, Zap, BarChart } from "lucide-react";
import summitLogo from "@/assets/summit-logo.webp";

export default function JobNimbusComparison() {
  const summitFeatures = [
    { feature: "Predictive Dialer", summit: true, jobnimbus: false, highlight: true },
    { feature: "Power Dialer", summit: true, jobnimbus: false },
    { feature: "Call Recording", summit: true, jobnimbus: false },
    { feature: "SMS Campaigns", summit: true, jobnimbus: true },
    { feature: "SMS Inbox", summit: true, jobnimbus: "limited" },
    { feature: "Email Campaigns", summit: true, jobnimbus: true },
    { feature: "WhatsApp Messaging", summit: true, jobnimbus: false, highlight: true },
    { feature: "WhatsApp Campaigns", summit: true, jobnimbus: false, highlight: true },
    { feature: "Omnichannel Inbox", summit: true, jobnimbus: false, highlight: true },
    { feature: "AI Call Summaries", summit: true, jobnimbus: false, highlight: true },
    { feature: "AI Inspection Reports", summit: true, jobnimbus: false, highlight: true },
    { feature: "Lead Qualification Scoring", summit: true, jobnimbus: false },
    { feature: "Inspection-to-Sales Handoff", summit: true, jobnimbus: false },
    { feature: "Route Optimization", summit: true, jobnimbus: "limited" },
    { feature: "GPS Technician Tracking", summit: true, jobnimbus: "limited" },
    { feature: "Technician Mobile App", summit: true, jobnimbus: true },
    { feature: "Customer Portal", summit: true, jobnimbus: true },
    { feature: "Installation Management", summit: true, jobnimbus: true },
    { feature: "Crew Management", summit: true, jobnimbus: true },
    { feature: "Pipeline Management", summit: true, jobnimbus: true },
    { feature: "Workflow Automation", summit: true, jobnimbus: true },
    { feature: "API Access", summit: true, jobnimbus: "limited" },
    { feature: "White Label", summit: true, jobnimbus: false },
    { feature: "Multi-Tenant SaaS", summit: true, jobnimbus: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <img src={summitLogo} alt="Summit Leads" className="h-8 w-8" />
              <span className="font-bold text-xl">Summit Leads</span>
            </Link>
            <Link to="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Summit Leads vs JobNimbus
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Why field service businesses are switching to Summit Leads for better communication, AI features, and lower total cost.
            </p>
          </div>

          {/* Comparison Table */}
          <Card className="mb-12">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-4 font-semibold">Feature</th>
                      <th className="text-center p-4 font-semibold text-primary">Summit Leads</th>
                      <th className="text-center p-4 font-semibold">JobNimbus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summitFeatures.map((item, index) => (
                      <tr key={index} className={`border-b border-border ${item.highlight ? "bg-primary/5" : ""}`}>
                        <td className="p-4 font-medium">{item.feature}</td>
                        <td className="p-4 text-center">
                          {item.summit === true ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground text-sm">{item.summit}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {item.jobnimbus === true ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : item.jobnimbus === false ? (
                            <X className="w-5 h-5 text-red-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground text-sm">{item.jobnimbus}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Key Differences */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Summit Leads Advantages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Built-in predictive dialer saves 3+ hours per agent daily</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>WhatsApp and omnichannel communication included</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>AI call summaries and inspection reports automate documentation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Multi-tenant SaaS - perfect for agencies and call centers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Transparent upgrade path - pay only for what you need</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-orange-500" />
                  JobNimbus Limitations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No built-in dialer - requires third-party integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Limited SMS functionality, no WhatsApp support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No AI features for call summaries or automation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Single-tenant only - not suitable for multi-tenant operations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Higher total cost when adding required third-party tools</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Pricing Comparison */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Total Cost of Ownership</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="p-6 bg-muted rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">JobNimbus Stack</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>JobNimbus CRM</span>
                      <span className="font-medium">$300/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Dialer Integration</span>
                      <span className="font-medium">$200/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>SMS Platform</span>
                      <span className="font-medium">$100/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Email Marketing</span>
                      <span className="font-medium">$100/mo</span>
                    </li>
                    <li className="flex justify-between border-t border-border pt-2 mt-2 font-semibold">
                      <span>Total</span>
                      <span className="text-red-500">$700+/mo</span>
                    </li>
                  </ul>
                </div>

                <div className="p-6 bg-primary/10 rounded-lg border-2 border-primary">
                  <h3 className="text-lg font-semibold mb-4 text-primary">Summit Leads Enterprise</h3>
                  <div className="text-4xl font-bold text-primary mb-2">$1,299</div>
                  <p className="text-muted-foreground text-sm mb-4">/month for everything included</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Dialer included
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      SMS & WhatsApp included
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Email campaigns included
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      AI features included
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Make the Switch?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Start with a 14-day free trial. Import your existing leads, train your team, and see why field service businesses are choosing Summit Leads.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline">
                Book Demo
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
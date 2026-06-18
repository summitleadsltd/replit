import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, ArrowRight, Zap, BarChart, Users, DollarSign } from "lucide-react";
import summitLogo from "@/assets/summit-logo.webp";

export default function ServiceTitanComparison() {
  const summitFeatures = [
    { feature: "Predictive Dialer", summit: true, servicetitan: false, highlight: true },
    { feature: "Power Dialer", summit: true, servicetitan: false },
    { feature: "Call Recording", summit: true, servicetitan: false },
    { feature: "SMS Campaigns", summit: true, servicetitan: true },
    { feature: "SMS Inbox", summit: true, servicetitan: true },
    { feature: "Email Campaigns", summit: true, servicetitan: true },
    { feature: "WhatsApp Messaging", summit: true, servicetitan: false, highlight: true },
    { feature: "WhatsApp Campaigns", summit: true, servicetitan: false, highlight: true },
    { feature: "Omnichannel Inbox", summit: true, servicetitan: false, highlight: true },
    { feature: "AI Call Summaries", summit: true, servicetitan: false, highlight: true },
    { feature: "AI Inspection Reports", summit: true, servicetitan: false, highlight: true },
    { feature: "Lead Qualification Scoring", summit: true, servicetitan: false },
    { feature: "Inspection-to-Sales Handoff", summit: true, servicetitan: false },
    { feature: "Route Optimization", summit: true, servicetitan: true },
    { feature: "GPS Technician Tracking", summit: true, servicetitan: true },
    { feature: "Technician Mobile App", summit: true, servicetitan: true },
    { feature: "Customer Portal", summit: true, servicetitan: true },
    { feature: "Installation Management", summit: true, servicetitan: true },
    { feature: "Crew Management", summit: true, servicetitan: true },
    { feature: "Pipeline Management", summit: true, servicetitan: true },
    { feature: "Workflow Automation", summit: true, servicetitan: true },
    { feature: "API Access", summit: true, servicetitan: true },
    { feature: "White Label", summit: true, servicetitan: false },
    { feature: "Multi-Tenant SaaS", summit: true, servicetitan: false },
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
              Summit Leads vs ServiceTitan
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              A modern, AI-powered alternative that includes communication features ServiceTitan lacks, at a fraction of the cost.
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
                      <th className="text-center p-4 font-semibold">ServiceTitan</th>
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
                          {item.servicetitan === true ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : item.servicetitan === false ? (
                            <X className="w-5 h-5 text-red-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground text-sm">{item.servicetitan}</span>
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
                    <span>Built-in predictive dialer with AI-powered call features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>WhatsApp and omnichannel inbox for modern communication</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>AI call summaries automate documentation and CRM updates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Multi-tenant SaaS for agencies and call centers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>70% lower cost with more communication features</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-orange-500" />
                  ServiceTitan Limitations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No built-in dialer - requires separate telephony platform</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No WhatsApp support - missing modern communication channel</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No AI features for automation or insights</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Enterprise pricing with high minimums and long contracts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Complex implementation requiring significant training</span>
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
                  <h3 className="text-lg font-semibold mb-4">ServiceTitan Stack</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>ServiceTitan Platform</span>
                      <span className="font-medium">$1,500+/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Dialer Integration</span>
                      <span className="font-medium">$300/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>WhatsApp Integration</span>
                      <span className="font-medium">$150/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Implementation Fees</span>
                      <span className="font-medium">$5,000+</span>
                    </li>
                    <li className="flex justify-between border-t border-border pt-2 mt-2 font-semibold">
                      <span>Monthly Total</span>
                      <span className="text-red-500">$1,950+/mo</span>
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
                      All communication included
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      No implementation fees
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Monthly billing, no long contract
                    </li>
                    <li className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <span className="font-semibold text-green-600">Save $650+/month</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ideal For */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Who Should Switch to Summit Leads?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Growing Businesses
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Companies scaling from 10-50 technicians who need modern communication tools without enterprise pricing.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Solar & Home Improvement
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Solar, roofing, and home improvement companies who need strong dialer capabilities for lead generation.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Budget-Conscious Teams
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Teams who want ServiceTitan-level features but at 70% lower cost with better communication tools.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-primary" />
                    Fast Implementation
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Companies who need to be up and running in days, not months, without expensive implementation projects.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Save $650+ Per Month?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Start with a 14-day free trial. Experience modern field service management with AI-powered communication.
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
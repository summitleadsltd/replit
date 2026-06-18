import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, ArrowRight, Zap, BarChart, Building2, Wrench, TrendingUp } from "lucide-react";
import summitLogo from "@/assets/summit-logo.webp";

export default function HubSpotComparison() {
  const summitFeatures = [
    { feature: "Predictive Dialer", summit: true, hubspot: "limited", highlight: true },
    { feature: "Power Dialer", summit: true, hubspot: "limited" },
    { feature: "Call Recording", summit: true, hubspot: true },
    { feature: "SMS Campaigns", summit: true, hubspot: "limited" },
    { feature: "SMS Inbox", summit: true, hubspot: "limited" },
    { feature: "Email Campaigns", summit: true, hubspot: true },
    { feature: "WhatsApp Messaging", summit: true, hubspot: "limited" },
    { feature: "WhatsApp Campaigns", summit: true, hubspot: false },
    { feature: "Omnichannel Inbox", summit: true, hubspot: "limited" },
    { feature: "AI Call Summaries", summit: true, hubspot: false, highlight: true },
    { feature: "AI Inspection Reports", summit: true, hubspot: false, highlight: true },
    { feature: "Lead Qualification Scoring", summit: true, hubspot: true },
    { feature: "Inspection-to-Sales Handoff", summit: true, hubspot: false },
    { feature: "Route Optimization", summit: true, hubspot: false, highlight: true },
    { feature: "GPS Technician Tracking", summit: true, hubspot: false, highlight: true },
    { feature: "Technician Mobile App", summit: true, hubspot: false, highlight: true },
    { feature: "Customer Portal", summit: true, hubspot: true },
    { feature: "Installation Management", summit: true, hubspot: false, highlight: true },
    { feature: "Crew Management", summit: true, hubspot: false, highlight: true },
    { feature: "Pipeline Management", summit: true, hubspot: true },
    { feature: "Workflow Automation", summit: true, hubspot: true },
    { feature: "API Access", summit: true, hubspot: true },
    { feature: "White Label", summit: true, hubspot: false },
    { feature: "Multi-Tenant SaaS", summit: true, hubspot: false },
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
              Summit Leads vs HubSpot
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              HubSpot is excellent for B2B SaaS and marketing, but Summit Leads is purpose-built for field service businesses with technician management.
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
                      <th className="text-center p-4 font-semibold">HubSpot</th>
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
                          {item.hubspot === true ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : item.hubspot === false ? (
                            <X className="w-5 h-5 text-red-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground text-sm">{item.hubspot}</span>
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
                  <Wrench className="w-5 h-5 text-primary" />
                  Summit Leads: Field Service Focus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Built-in technician management and dispatch</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Route optimization and GPS tracking for field teams</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Technician mobile app for on-site inspections</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Installation and crew management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>AI-powered field service workflows</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-orange-500" />
                  HubSpot: B2B Marketing Focus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No technician management or dispatch features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No route optimization or GPS tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No technician mobile app for field work</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No installation or crew management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Limited SMS and no WhatsApp campaigns</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Use Case Section */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Choose the Right Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-orange-500" />
                    Choose HubSpot For
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li>• B2B SaaS companies and software businesses</li>
                    <li>• Marketing-focused organizations</li>
                    <li>• Content marketing and inbound strategies</li>
                    <li>• Businesses with no field operations</li>
                    <li>• Enterprise sales teams without field service</li>
                  </ul>
                </div>

                <div className="p-6 bg-primary/10 rounded-lg border-2 border-primary">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-primary">
                    <Wrench className="w-5 h-5 text-primary" />
                    Choose Summit Leads For
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Field service businesses with technicians</li>
                    <li>• Solar, roofing, HVAC, home improvement</li>
                    <li>• Companies needing dispatch and routing</li>
                    <li>• Businesses with on-site service delivery</li>
                    <li>• Operations requiring installation management</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Comparison */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Cost Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="p-6 bg-muted rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">HubSpot Stack</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>HubSpot Sales Hub Pro</span>
                      <span className="font-medium">$1,200/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Marketing Hub Pro</span>
                      <span className="font-medium">$1,200/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Service Hub Pro</span>
                      <span className="font-medium">$1,200/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Dialer Add-on</span>
                      <span className="font-medium">$300/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>SMS/WhatsApp Add-ons</span>
                      <span className="font-medium">$200/mo</span>
                    </li>
                    <li className="flex justify-between border-t border-border pt-2 mt-2 font-semibold">
                      <span>Monthly Total</span>
                      <span className="text-red-500">$4,100+/mo</span>
                    </li>
                  </ul>
                </div>

                <div className="p-6 bg-primary/10 rounded-lg border-2 border-primary">
                  <h3 className="text-lg font-semibold mb-4 text-primary">Summit Leads Enterprise</h3>
                  <div className="text-4xl font-bold text-primary mb-2">$1,299</div>
                  <p className="text-muted-foreground text-sm mb-4">/month for everything included</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="font-semibold text-green-600">Save $2,800+/month</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Field service features included
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      All communication channels included
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

          {/* Feature Focus */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Feature Focus Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold mb-4 text-orange-500">HubSpot Strengths</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Content marketing and blogging</li>
                    <li>• SEO and website optimization</li>
                    <li>• Social media management</li>
                    <li>• B2B lead scoring and nurturing</li>
                    <li>• Marketing automation workflows</li>
                    <li>• Enterprise CRM features</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-4 text-primary">Summit Leads Strengths</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Technician dispatch and scheduling</li>
                    <li>• Route optimization and GPS tracking</li>
                    <li>• Field service mobile app</li>
                    <li>• Installation and crew management</li>
                    <li>• AI inspection and sales handoff</li>
                    <li>• Field-specific workflows</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Field Service Business?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              HubSpot is excellent for marketing, but Summit Leads is purpose-built for field service operations. Save $2,800+/month with features HubSpot doesn't have.
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
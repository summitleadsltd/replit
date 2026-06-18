import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, ArrowRight, Zap, BarChart, Home, Smartphone } from "lucide-react";
import summitLogo from "@/assets/summit-logo.webp";

export default function HousecallProComparison() {
  const summitFeatures = [
    { feature: "Predictive Dialer", summit: true, housecallpro: false, highlight: true },
    { feature: "Power Dialer", summit: true, housecallpro: false },
    { feature: "Call Recording", summit: true, housecallpro: false },
    { feature: "SMS Campaigns", summit: true, housecallpro: true },
    { feature: "SMS Inbox", summit: true, housecallpro: "limited" },
    { feature: "Email Campaigns", summit: true, housecallpro: true },
    { feature: "WhatsApp Messaging", summit: true, housecallpro: false, highlight: true },
    { feature: "WhatsApp Campaigns", summit: true, housecallpro: false, highlight: true },
    { feature: "Omnichannel Inbox", summit: true, housecallpro: false, highlight: true },
    { feature: "AI Call Summaries", summit: true, housecallpro: false, highlight: true },
    { feature: "AI Inspection Reports", summit: true, housecallpro: false, highlight: true },
    { feature: "Lead Qualification Scoring", summit: true, housecallpro: false },
    { feature: "Inspection-to-Sales Handoff", summit: true, housecallpro: false },
    { feature: "Route Optimization", summit: true, housecallpro: "limited" },
    { feature: "GPS Technician Tracking", summit: true, housecallpro: "limited" },
    { feature: "Technician Mobile App", summit: true, housecallpro: true },
    { feature: "Customer Portal", summit: true, housecallpro: "limited" },
    { feature: "Installation Management", summit: true, housecallpro: true },
    { feature: "Crew Management", summit: true, housecallpro: true },
    { feature: "Pipeline Management", summit: true, housecallpro: true },
    { feature: "Workflow Automation", summit: true, housecallpro: true },
    { feature: "API Access", summit: true, housecallpro: "limited" },
    { feature: "White Label", summit: true, housecallpro: false },
    { feature: "Multi-Tenant SaaS", summit: true, housecallpro: false },
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
              Summit Leads vs Housecall Pro
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Why growing field service businesses choose Summit Leads for better sales workflows, AI features, and professional communication.
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
                      <th className="text-center p-4 font-semibold">Housecall Pro</th>
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
                          {item.housecallpro === true ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : item.housecallpro === false ? (
                            <X className="w-5 h-5 text-red-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground text-sm">{item.housecallpro}</span>
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
                    <span>Built-in predictive dialer for outbound sales calls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>WhatsApp and omnichannel communication included</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>AI-powered call summaries and inspection reports</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Advanced lead qualification and sales handoff</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Multi-tenant support for agencies and call centers</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-orange-500" />
                  Housecall Pro Limitations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No built-in dialer - limited to basic phone calls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No WhatsApp or modern messaging channels</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No AI features for automation or insights</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Limited sales workflow and lead management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Single-tenant only, not suitable for multi-tenant</span>
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
                  <h3 className="text-lg font-semibold mb-4">Housecall Pro Stack</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>Housecall Pro</span>
                      <span className="font-medium">$59/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Dialer Integration</span>
                      <span className="font-medium">$200/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Advanced SMS</span>
                      <span className="font-medium">$100/mo</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Email Marketing Tool</span>
                      <span className="font-medium">$100/mo</span>
                    </li>
                    <li className="flex justify-between border-t border-border pt-2 mt-2 font-semibold">
                      <span>Total</span>
                      <span className="text-red-500">$459+/mo</span>
                    </li>
                  </ul>
                </div>

                <div className="p-6 bg-primary/10 rounded-lg border-2 border-primary">
                  <h3 className="text-lg font-semibold mb-4 text-primary">Summit Leads Professional</h3>
                  <div className="text-4xl font-bold text-primary mb-2">$599</div>
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

          {/* Use Case Comparison */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Best For Different Use Cases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Home className="w-5 h-5 text-primary" />
                    Housecall Pro is Best For
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Solo technicians and very small teams (1-3)</li>
                    <li>• Basic scheduling and invoicing needs</li>
                    <li>• Businesses without active sales teams</li>
                    <li>• Simple field service operations</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    Summit Leads is Best For
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Growing teams with 5+ technicians</li>
                    <li>• Active outbound sales and dialer needs</li>
                    <li>• Solar, roofing, home improvement companies</li>
                    <li>• Businesses needing modern communication channels</li>
                    <li>• Agencies and call centers (multi-tenant)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Scale Your Business?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Start with a 14-day free trial. Get the communication and sales features Housecall Pro lacks.
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
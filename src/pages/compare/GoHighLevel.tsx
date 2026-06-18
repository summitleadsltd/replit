import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, ArrowRight, Zap, BarChart, Building2, Wrench } from "lucide-react";
import summitLogo from "@/assets/summit-logo.webp";

export default function GoHighLevelComparison() {
  const summitFeatures = [
    { feature: "Predictive Dialer", summit: true, gohighlevel: "limited", highlight: true },
    { feature: "Power Dialer", summit: true, gohighlevel: "limited" },
    { feature: "Call Recording", summit: true, gohighlevel: true },
    { feature: "SMS Campaigns", summit: true, gohighlevel: true },
    { feature: "SMS Inbox", summit: true, gohighlevel: true },
    { feature: "Email Campaigns", summit: true, gohighlevel: true },
    { feature: "WhatsApp Messaging", summit: true, gohighlevel: true },
    { feature: "WhatsApp Campaigns", summit: true, gohighlevel: true },
    { feature: "Omnichannel Inbox", summit: true, gohighlevel: true },
    { feature: "AI Call Summaries", summit: true, gohighlevel: false, highlight: true },
    { feature: "AI Inspection Reports", summit: true, gohighlevel: false, highlight: true },
    { feature: "Lead Qualification Scoring", summit: true, gohighlevel: false },
    { feature: "Inspection-to-Sales Handoff", summit: true, gohighlevel: false },
    { feature: "Route Optimization", summit: true, gohighlevel: false, highlight: true },
    { feature: "GPS Technician Tracking", summit: true, gohighlevel: false, highlight: true },
    { feature: "Technician Mobile App", summit: true, gohighlevel: false, highlight: true },
    { feature: "Customer Portal", summit: true, gohighlevel: true },
    { feature: "Installation Management", summit: true, gohighlevel: false, highlight: true },
    { feature: "Crew Management", summit: true, gohighlevel: false, highlight: true },
    { feature: "Pipeline Management", summit: true, gohighlevel: true },
    { feature: "Workflow Automation", summit: true, gohighlevel: true },
    { feature: "API Access", summit: true, gohighlevel: true },
    { feature: "White Label", summit: true, gohighlevel: true },
    { feature: "Multi-Tenant SaaS", summit: true, gohighlevel: true },
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
              Summit Leads vs GoHighLevel
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              GoHighLevel is great for marketing agencies, but Summit Leads is built specifically for field service operations with technician management.
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
                      <th className="text-center p-4 font-semibold">GoHighLevel</th>
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
                          {item.gohighlevel === true ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : item.gohighlevel === false ? (
                            <X className="w-5 h-5 text-red-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground text-sm">{item.gohighlevel}</span>
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
                    <span>Technician mobile app for on-site work</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Installation and crew management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>AI inspection reports and sales handoff</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-orange-500" />
                  GoHighLevel: Marketing Focus
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
                    <span>Limited dialer compared to dedicated systems</span>
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
                    Choose GoHighLevel For
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Marketing agencies managing client campaigns</li>
                    <li>• Pure digital marketing businesses</li>
                    <li>• Lead generation companies without field operations</li>
                    <li>• Businesses focused solely on online sales</li>
                    <li>• Multi-tenant agency operations</li>
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
                    <li>• Companies needing dispatch and route optimization</li>
                    <li>• Businesses with on-site service delivery</li>
                    <li>• Operations requiring installation management</li>
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
                  <h3 className="font-semibold mb-4 text-orange-500">GoHighLevel Strengths</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Marketing automation</li>
                    <li>• Funnel building</li>
                    <li>• Website builder</li>
                    <li>• Social media scheduling</li>
                    <li>• Review management</li>
                    <li>• Agency white-labeling</li>
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
            <h2 className="text-2xl font-bold mb-4">Have Field Operations?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              If you have technicians, dispatch operations, or field service needs, Summit Leads is the purpose-built solution. Start with a 14-day free trial.
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
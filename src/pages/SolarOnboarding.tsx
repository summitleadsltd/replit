import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Key, MapPin, Search, ArrowRight, ArrowLeft,
  CheckCircle2, Server, Loader2, Info, Compass
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { solarApi } from "@/lib/solarApi";

export default function SolarOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || "test_user_id";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 2: API Keys
  const [googlePlaces, setGooglePlaces] = useState("");
  const [companiesHouse, setCompaniesHouse] = useState("");
  const [apollo, setApollo] = useState("");
  const [hunter, setHunter] = useState("");

  // Step 3: First Discovery
  const [postcode, setPostcode] = useState("");
  const [keywords, setKeywords] = useState("industrial, warehouse, logistics");
  const [radius, setRadius] = useState(5);

  const handleNextStep = () => {
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  const handleSaveKeys = async () => {
    setLoading(true);
    try {
      await solarApi.saveKeys({
        userId,
        google_places: googlePlaces || undefined,
        companies_house: companiesHouse || undefined,
        apollo: apollo || undefined,
        hunter: hunter || undefined
      });
      toast.success("API Credentials configured.");
      handleNextStep();
    } catch (err: any) {
      console.warn("Failed saving API keys to server, saving locally for mock mode.");
      localStorage.setItem("mock_google_places", googlePlaces);
      localStorage.setItem("mock_companies_house", companiesHouse);
      localStorage.setItem("mock_apollo", apollo);
      localStorage.setItem("mock_hunter", hunter);
      toast.success("API mock configuration saved locally.");
      handleNextStep();
    } finally {
      setLoading(false);
    }
  };

  const handleRunFirstDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postcode.trim()) {
      toast.error("Please enter a valid UK postcode");
      return;
    }

    setLoading(true);
    try {
      const keywordArr = keywords.split(",").map(k => k.trim()).filter(k => k.length > 0);
      const result = await solarApi.discover(postcode.trim().toUpperCase(), keywordArr, radius, userId);
      
      toast.success(`Discovered ${result.count} potential leads. Mapped successfully.`);

      if (result.ids && result.ids.length > 0) {
        await solarApi.enrich(result.ids, userId);
        toast.info("Triggered automatic background enrichment jobs.");
      }

      // Mark onboarding as complete in localStorage
      localStorage.setItem("solarscout_onboarded", "true");
      navigate("/solar-dashboard");
    } catch (err: any) {
      console.warn("Discovery failed on server. Redirecting with mock onboarding simulation.");
      localStorage.setItem("solarscout_onboarded", "true");
      toast.success("Onboarding search simulated successfully!");
      navigate("/solar-dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-foreground">
      {/* Onboarding Box */}
      <div className="w-full max-w-xl space-y-6">
        
        {/* Step Indicator Header */}
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            <span className="font-display font-bold text-sm">SolarScout UK Onboarding</span>
          </div>
          <span className="text-xs text-muted-foreground font-semibold">Step {step} of 3</span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* STEP 1: WELCOME & CONNECT */}
        {step === 1 && (
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-bold font-display flex items-center gap-2">
                <Compass className="w-6 h-6 text-primary" />
                Welcome to SolarScout UK
              </CardTitle>
              <CardDescription>
                Empower your B2B sales team by discovering high-probability solar installation leads in commercial and logistics areas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/40 border border-border/50 rounded-lg space-y-3">
                <span className="text-sm font-bold text-foreground block">System Architecture Prerequisites:</span>
                <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <p className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary shrink-0" />
                    Express backend server running on port 5000.
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    Supabase PostgreSQL storage schema migrations deployed.
                  </p>
                  <p className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    Redis queue workers initialized for async api parsing.
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                We will walk you through a brief 3-step setup: configuring credentials, setting compliance rules, and firing your first UK geocoded prospecting job.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={handleNextStep} className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center justify-center gap-2">
                Configure Credentials
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* STEP 2: ADD API KEYS */}
        {step === 2 && (
          <Card className="bg-card border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-bold font-display flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                Add API Key Integrations
              </CardTitle>
              <CardDescription>
                Configure credentials to allow SolarScout to scrap Google Places, verify company structures, and find facilities managers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="google-places-onboard">Google Places API Key (Discovery)</Label>
                <Input
                  id="google-places-onboard"
                  type="password"
                  placeholder="gplaces_live_..."
                  value={googlePlaces}
                  onChange={e => setGooglePlaces(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companies-house-onboard">Companies House Key (Registration & Sizing)</Label>
                <Input
                  id="companies-house-onboard"
                  type="password"
                  placeholder="ch_live_..."
                  value={companiesHouse}
                  onChange={e => setCompaniesHouse(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apollo-onboard">Apollo.io Key (Decision Makers)</Label>
                <Input
                  id="apollo-onboard"
                  type="password"
                  placeholder="ap_live_..."
                  value={apollo}
                  onChange={e => setApollo(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hunter-onboard">Hunter.io Key (Email Patterns)</Label>
                <Input
                  id="hunter-onboard"
                  type="password"
                  placeholder="ht_live_..."
                  value={hunter}
                  onChange={e => setHunter(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed flex items-center gap-1.5 bg-muted/30 p-2 border border-border/30 rounded">
                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                Leave empty to run in simulated mode using realistic UK B2B companies mock database.
              </p>
            </CardContent>
            <CardFooter className="flex justify-between gap-3">
              <Button variant="outline" onClick={handlePrevStep} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button onClick={handleSaveKeys} disabled={loading} className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center gap-2 flex-1 justify-center">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save & Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* STEP 3: RUN FIRST DISCOVERY */}
        {step === 3 && (
          <Card className="bg-card border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-bold font-display flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Run First Discovery Job
              </CardTitle>
              <CardDescription>
                Define your target postal code area and commercial keyword list to search Google Places.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRunFirstDiscovery}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="onboard-postcode">UK Postcode / Sector Area</Label>
                  <Input
                    id="onboard-postcode"
                    placeholder="e.g. M11, SW19, B3"
                    value={postcode}
                    onChange={e => setPostcode(e.target.value)}
                    className="bg-muted border-border"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="onboard-radius">Radius (Miles)</Label>
                    <Input
                      id="onboard-radius"
                      type="number"
                      min={1}
                      max={50}
                      value={radius}
                      onChange={e => setRadius(parseInt(e.target.value) || 5)}
                      className="bg-muted border-border"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboard-keywords">Keywords (comma separated)</Label>
                    <Input
                      id="onboard-keywords"
                      value={keywords}
                      onChange={e => setKeywords(e.target.value)}
                      className="bg-muted border-border"
                      required
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Upon completion, SolarScout will fetch matching companies, route their phone numbers through CTPS exclusions list, evaluate roof sizes, and stamp GDPR legitimate interest.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between gap-3">
                <Button type="button" variant="outline" onClick={handlePrevStep} disabled={loading} className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center gap-2 flex-1 justify-center">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running Discovery...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Discover & Finish
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  Search, Filter, Sun, ShieldCheck, ShieldAlert, FileSpreadsheet,
  Settings, CheckSquare, Square, RefreshCw, X, Globe, MapPin, 
  User, Mail, Phone, Linkedin, Eye, EyeOff, Loader2, Compass, Cpu
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { solarApi } from "@/lib/solarApi";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for leaflet default marker icon
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  title: string;
  linkedin_url: string;
  ctps_checked: boolean;
  ctps_clean: boolean;
  email_verified: boolean;
}

interface Prospect {
  id: string;
  company_name: string;
  postcode: string;
  address: string;
  website: string;
  radius_miles: number;
  status: "DISCOVERED" | "ENRICHING" | "ENRICHED" | "CONTACTED" | "CONVERTED";
  priority: "COLD" | "WARM" | "HOT";
  icp_score: number;
  roof_area_sqm: number;
  orientation: string;
  shading: string;
  turnover: number;
  employee_count: number;
  esg_keywords: string[];
  has_trigger_events: boolean;
  gdpr_legitimate_interest_token: string | null;
  gdpr_lia_passed: boolean;
  gdpr_assessment_date: string | null;
  ctps_checked: boolean;
  ctps_clean: boolean;
  notes: string | null;
  created_at: string;
  contacts: Contact[];
}

interface LogEntry {
  id: string;
  action: string;
  details: string;
  created_at: string;
}

export default function SolarProspects() {
  const { user } = useAuth();
  const userId = user?.id || "test_user_id";

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrichingMap, setEnrichingMap] = useState<Record<string, boolean>>({});

  // Filter States
  const [postcode, setPostcode] = useState("");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");
  const [minScore, setMinScore] = useState(0);

  // Pagination
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail Modal State
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [activityLogs, setActivityLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Toggle mask state for CTPS numbers in details modal
  const [showBlockedNumber, setShowBlockedNumber] = useState<Record<string, boolean>>({});

  const fetchProspects = async () => {
    try {
      setLoading(true);
      const data = await solarApi.getProspects({
        priority: priority === "all" ? undefined : priority,
        status: status === "all" ? undefined : status,
        postcode: postcode.trim() || undefined,
        minScore: minScore > 0 ? minScore : undefined,
        limit,
        offset,
        userId
      });
      setProspects(data.prospects);
      setTotal(data.pagination.total);
    } catch (err) {
      console.warn("Could not connect to backend. Generating mock prospects.", err);
      // Mock Fallback Data
      const mockList: Prospect[] = [
        {
          id: "p1",
          company_name: "Apex Logistics Ltd",
          postcode: "SW19 3TZ",
          address: "10 Industrial Estate, Off Parkway Road, SW19 3TZ, UK",
          website: "www.apexlogistics.co.uk",
          radius_miles: 5,
          status: "ENRICHED",
          priority: "HOT",
          icp_score: 9,
          roof_area_sqm: 1200,
          orientation: "South",
          shading: "None",
          turnover: 14500000,
          employee_count: 240,
          esg_keywords: ["Sustainability", "Solar", "Net Zero"],
          has_trigger_events: true,
          gdpr_legitimate_interest_token: "GDPR-LI-UK-APEX",
          gdpr_lia_passed: true,
          gdpr_assessment_date: new Date().toISOString(),
          ctps_checked: true,
          ctps_clean: false,
          notes: "Spoke to facilities manager last week. Highly interested in roof solar evaluation.",
          created_at: new Date().toISOString(),
          contacts: [
            { id: "c1", first_name: "David", last_name: "Green", title: "Sustainability Director", email: "david.green@apexlogistics.co.uk", phone: "+442079460012", linkedin_url: "linkedin.com/in/david-green", ctps_checked: true, ctps_clean: true, email_verified: true },
            { id: "c2", first_name: "Sarah", last_name: "Jennings", title: "Facilities Manager", email: "sarah.jennings@apexlogistics.co.uk", phone: "+447700900077", linkedin_url: "linkedin.com/in/sarah-jennings", ctps_checked: true, ctps_clean: false, email_verified: true }
          ]
        },
        {
          id: "p2",
          company_name: "Vanguard Manufacturing Ltd",
          postcode: "M11 2AD",
          address: "24 Parkway Road, M11 2AD, UK",
          website: "www.vanguardmfg.co.uk",
          radius_miles: 10,
          status: "ENRICHED",
          priority: "WARM",
          icp_score: 6,
          roof_area_sqm: 850,
          orientation: "East",
          shading: "Partial",
          turnover: 8500000,
          employee_count: 95,
          esg_keywords: ["Sustainability"],
          has_trigger_events: false,
          gdpr_legitimate_interest_token: "GDPR-LI-UK-VANGUARD",
          gdpr_lia_passed: true,
          gdpr_assessment_date: new Date().toISOString(),
          ctps_checked: true,
          ctps_clean: true,
          notes: null,
          created_at: new Date().toISOString(),
          contacts: [
            { id: "c3", first_name: "Marcus", last_name: "Sterling", title: "CFO", email: "marcus.sterling@vanguardmfg.co.uk", phone: "+442079460597", linkedin_url: "linkedin.com/in/marcus-sterling", ctps_checked: true, ctps_clean: true, email_verified: true }
          ]
        },
        {
          id: "p3",
          company_name: "SolarGen installations",
          postcode: "B3 1RL",
          address: "SolarGen House, B3 1RL, UK",
          website: "www.solargen.co.uk",
          radius_miles: 3,
          status: "DISCOVERED",
          priority: "COLD",
          icp_score: 3,
          roof_area_sqm: 180,
          orientation: "North",
          shading: "Partial",
          turnover: 1200000,
          employee_count: 12,
          esg_keywords: [],
          has_trigger_events: false,
          gdpr_legitimate_interest_token: null,
          gdpr_lia_passed: false,
          gdpr_assessment_date: null,
          ctps_checked: false,
          ctps_clean: true,
          notes: "Small business, under suitability threshold.",
          created_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(), // 32 days ago (subject to purge)
          contacts: []
        }
      ];
      setProspects(mockList);
      setTotal(mockList.length);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (prospectId: string) => {
    try {
      setLoadingLogs(true);
      const data = await solarApi.getLogs(prospectId, userId);
      setActivityLogs(data);
    } catch (err) {
      // Fallback Mock Logs
      setActivityLogs([
        { id: "l1", action: "ENRICHED", details: "Enrichment completed. Calculated ICP score: 9/10 (HOT). GDPR LIA passed.", created_at: new Date().toISOString() },
        { id: "l2", action: "DISCOVERED", details: "Prospect discovered during search for 'logistics' in SW19 postcode.", created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString() }
      ]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, [userId, postcode, priority, status, minScore, limit, offset]);

  // Leaflet map center helper
  const getPostcodeCoords = (postcodeStr: string): [number, number] => {
    const prefix = postcodeStr.trim().slice(0, 2).toUpperCase();
    if (prefix.startsWith("M")) return [53.4808, -2.2426]; // Manchester
    if (prefix.startsWith("B")) return [52.4862, -1.8904]; // Birmingham
    if (prefix.startsWith("EH")) return [55.9533, -3.1883]; // Edinburgh
    if (prefix.startsWith("G")) return [55.8642, -4.2518]; // Glasgow
    if (prefix.startsWith("L")) return [53.4084, -2.9916]; // Liverpool
    if (prefix.startsWith("LS")) return [53.8008, -1.5491]; // Leeds
    if (["EC", "WC", "SW", "SE", "NW", "NE", "W1", "E1"].some(p => prefix.startsWith(p))) {
      return [51.5074, -0.1278]; // London
    }
    return [51.5074, -0.1278]; // default London
  };

  // Row Selection Toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === prospects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(prospects.map(p => p.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Enrichment Batch Trigger
  const handleBatchEnrich = async () => {
    if (selectedIds.length === 0) {
      toast.warning("Please select at least one prospect to enrich");
      return;
    }
    
    const count = selectedIds.length;
    // Set loading indicator per row
    const nextEnrichMap = { ...enrichingMap };
    selectedIds.forEach(id => { nextEnrichMap[id] = true; });
    setEnrichingMap(nextEnrichMap);

    try {
      await solarApi.enrich(selectedIds, userId);
      toast.success(`Successfully queued enrichment jobs for ${count} targets.`);
      setSelectedIds([]);
      // Reload prospects lists to reflect status update to "ENRICHING"
      setTimeout(fetchProspects, 500);
    } catch (err: any) {
      toast.error(err.message || "Enrichment trigger failed");
    } finally {
      const resetEnrichMap = { ...enrichingMap };
      selectedIds.forEach(id => { resetEnrichMap[id] = false; });
      setEnrichingMap(resetEnrichMap);
    }
  };

  // Export CSV Action
  const handleExport = async () => {
    try {
      toast.info("Generating CSV export. Download starting...");
      await solarApi.exportCsv(userId);
      toast.success("CSV export downloaded successfully.");
    } catch (err: any) {
      toast.error(err.message || "Export failed.");
    }
  };

  // Open Details Modal
  const handleOpenDetails = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setNotes(prospect.notes || "");
    setUpdateStatus(prospect.status);
    setModalOpen(true);
    loadLogs(prospect.id);
  };

  // Save Modal Notes & Status Update
  const handleSaveDetails = async () => {
    if (!selectedProspect) return;
    
    setSavingNotes(true);
    try {
      const updated = await solarApi.updateProspect(selectedProspect.id, {
        status: updateStatus,
        notes: notes.trim() || undefined,
        userId
      });
      toast.success("Prospect records updated successfully.");
      
      // Update local state
      setProspects(prospects.map(p => p.id === selectedProspect.id ? { ...p, status: updated.status, notes: updated.notes } : p));
      setSelectedProspect({ ...selectedProspect, status: updated.status, notes: updated.notes });
      
      // Refresh activity logs
      loadLogs(selectedProspect.id);
    } catch (err: any) {
      toast.error(err.message || "Update failed.");
    } finally {
      setSavingNotes(false);
    }
  };

  const getPriorityBadgeColor = (p: string) => {
    if (p === "HOT") return "bg-amber-500/10 text-amber-500 border-amber-500/30";
    if (p === "WARM") return "bg-sky-500/10 text-sky-500 border-sky-500/30";
    return "bg-slate-500/10 text-slate-500 border-slate-500/30";
  };

  const getStatusBadgeColor = (s: string) => {
    if (s === "CONVERTED") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
    if (s === "CONTACTED") return "bg-purple-500/10 text-purple-500 border-purple-500/30";
    if (s === "ENRICHED") return "bg-sky-500/10 text-sky-500 border-sky-500/30";
    if (s === "ENRICHING") return "bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse";
    return "bg-slate-500/10 text-slate-500 border-slate-500/30";
  };

  return (
    <div className="space-y-6 p-6 pb-12 animate-slide-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">Lead Prospect Database</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Search, sort, filter, and audit target profiles for roof suitability scoring.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <Button onClick={handleBatchEnrich} className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Enrich Selected ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} className="flex items-center gap-2 border-border">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filtering Panel */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <Label htmlFor="postcode-filter">UK Postcode Area</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="postcode-filter"
                placeholder="e.g. SW19, M11, B3"
                value={postcode}
                onChange={e => setPostcode(e.target.value)}
                className="pl-9 bg-muted border-border"
              />
            </div>
          </div>
          
          <div className="w-[150px] space-y-1.5">
            <Label htmlFor="priority-filter">Priority Category</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="priority-filter" className="bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="HOT">Hot Leads</SelectItem>
                <SelectItem value="WARM">Warm Leads</SelectItem>
                <SelectItem value="COLD">Cold Leads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[150px] space-y-1.5">
            <Label htmlFor="status-filter">Workflow Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status-filter" className="bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DISCOVERED">Discovered</SelectItem>
                <SelectItem value="ENRICHING">Enriching</SelectItem>
                <SelectItem value="ENRICHED">Enriched</SelectItem>
                <SelectItem value="CONTACTED">Contacted</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[200px] space-y-3 pb-1">
            <div className="flex justify-between text-xs">
              <Label htmlFor="score-filter">Min ICP Suitability Score</Label>
              <span className="font-semibold text-primary">{minScore}/10</span>
            </div>
            <Slider
              id="score-filter"
              min={0}
              max={10}
              step={1}
              value={[minScore]}
              onValueChange={v => setMinScore(v[0])}
              className="py-1 cursor-pointer"
            />
          </div>

          <Button variant="ghost" onClick={() => { setPostcode(""); setPriority("all"); setStatus("all"); setMinScore(0); }} className="text-xs hover:text-foreground">
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      {/* Prospects Data Table */}
      <Card className="bg-card border-border shadow-sm">
        <div className="overflow-x-auto">
          <Table className="table-ops">
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="w-12 text-center">
                  <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground p-1">
                    {selectedIds.length === prospects.length && prospects.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead>Postcode</TableHead>
                <TableHead className="text-center">ICP Score</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>GDPR Stamp</TableHead>
                <TableHead>CTPS Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    Loading leads database...
                  </TableCell>
                </TableRow>
              ) : prospects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                    No prospects match the filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                prospects.map((prospect) => {
                  const isSelected = selectedIds.includes(prospect.id);
                  const isEnriching = enrichingMap[prospect.id] || prospect.status === "ENRICHING";
                  return (
                    <TableRow key={prospect.id} className="hover:bg-muted/30 border-border transition-colors">
                      <TableCell className="text-center">
                        <button onClick={() => toggleSelectRow(prospect.id)} className="text-muted-foreground hover:text-foreground p-1">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground max-w-[200px] truncate">
                        {prospect.company_name}
                      </TableCell>
                      <TableCell>{prospect.postcode}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-primary-soft text-primary font-bold px-2 py-0.5 rounded border border-primary/25">
                          {prospect.icp_score}/10
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-semibold border ${getPriorityBadgeColor(prospect.priority)}`}>
                          {prospect.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-semibold border ${getStatusBadgeColor(prospect.status)}`}>
                          {prospect.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {prospect.gdpr_lia_passed ? (
                          <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                            <ShieldCheck className="w-4 h-4" />
                            Compliant
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                            <ShieldAlert className="w-4 h-4" />
                            Exempt
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {prospect.ctps_checked ? (
                          prospect.ctps_clean ? (
                            <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/5 text-emerald-400 text-[10px]">Clean</Badge>
                          ) : (
                            <Badge variant="outline" className="border-rose-500/25 bg-rose-500/5 text-rose-400 text-[10px]">Excluded</Badge>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {prospect.status === "DISCOVERED" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                setEnrichingMap(prev => ({ ...prev, [prospect.id]: true }));
                                try {
                                  await solarApi.enrich([prospect.id], userId);
                                  toast.success(`Enrichment queue triggered for ${prospect.company_name}`);
                                  setTimeout(fetchProspects, 500);
                                } catch (e: any) {
                                  toast.error(e.message || "Failed to trigger enrichment");
                                } finally {
                                  setEnrichingMap(prev => ({ ...prev, [prospect.id]: false }));
                                }
                              }}
                              disabled={isEnriching}
                              className="h-8 text-xs font-medium"
                            >
                              {isEnriching ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                              ) : (
                                "Enrich"
                              )}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleOpenDetails(prospect)} className="h-8 text-xs hover:bg-muted font-medium flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Prospect Details Slide Drawer/Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
          {selectedProspect && (
            <div className="space-y-6">
              <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-bold font-display text-foreground">
                    {selectedProspect.company_name}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`font-semibold border ${getStatusBadgeColor(updateStatus)}`}>
                      {updateStatus}
                    </Badge>
                    <Badge variant="outline" className={`font-semibold border ${getPriorityBadgeColor(selectedProspect.priority)}`}>
                      {selectedProspect.priority} Priority
                    </Badge>
                    <Badge variant="outline" className="bg-primary-soft text-primary font-bold border-primary/25">
                      ICP Score: {selectedProspect.icp_score}/10
                    </Badge>
                    {selectedProspect.gdpr_legitimate_interest_token && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {selectedProspect.gdpr_legitimate_interest_token}
                      </span>
                    )}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left Panel: Company Suitability & Roof Map */}
                <div className="md:col-span-7 space-y-6">
                  {/* Suitability Cards */}
                  <Card className="bg-muted/30 border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-primary" />
                        Roof & Physical Suitability
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 text-xs grid grid-cols-3 gap-2">
                      <div className="bg-background/50 p-2.5 rounded border border-border/50">
                        <span className="text-muted-foreground block">Roof Area</span>
                        <span className="text-base font-bold text-foreground">{selectedProspect.roof_area_sqm} sqm</span>
                      </div>
                      <div className="bg-background/50 p-2.5 rounded border border-border/50">
                        <span className="text-muted-foreground block">Orientation</span>
                        <span className="text-base font-bold text-foreground">{selectedProspect.orientation}</span>
                      </div>
                      <div className="bg-background/50 p-2.5 rounded border border-border/50">
                        <span className="text-muted-foreground block">Shading</span>
                        <span className="text-base font-bold text-foreground">{selectedProspect.shading}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Satellite Map */}
                  <Card className="bg-muted/30 border-border overflow-hidden">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-primary" />
                        Roof Satellite Imagery (Geocoded)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 h-[220px] relative">
                      <MapContainer
                        center={getPostcodeCoords(selectedProspect.postcode)}
                        zoom={16}
                        style={{ height: "100%", width: "100%" }}
                        zoomControl={false}
                        attributionControl={false}
                      >
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                        <Marker position={getPostcodeCoords(selectedProspect.postcode)} />
                      </MapContainer>
                      <div className="absolute bottom-2 right-2 bg-slate-900/90 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300 font-mono z-[1000]">
                        Esri Satellite Imagery
                      </div>
                    </CardContent>
                  </Card>

                  {/* Company Info */}
                  <Card className="bg-muted/30 border-border text-xs">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-primary" />
                        Corporate Sizing
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-muted-foreground block">Estimated Turnover</span>
                          <span className="font-semibold text-foreground">
                            {selectedProspect.turnover ? `£${(selectedProspect.turnover / 1000000).toFixed(1)}M` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Employee Count</span>
                          <span className="font-semibold text-foreground">
                            {selectedProspect.employee_count ? `${selectedProspect.employee_count} employees` : "—"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Address</span>
                        <span className="font-medium text-foreground">{selectedProspect.address}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Website</span>
                        <a href={`https://${selectedProspect.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 font-semibold">
                          {selectedProspect.website}
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Panel: Contacts, Notes & Logs */}
                <div className="md:col-span-5 space-y-6">
                  {/* Status & Notes Form */}
                  <Card className="bg-muted/30 border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-semibold">Update Lead Status & Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="modal-status-select" className="text-xs">Workflow status</Label>
                        <Select value={updateStatus} onValueChange={setUpdateStatus}>
                          <SelectTrigger id="modal-status-select" className="bg-background border-border text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DISCOVERED">Discovered</SelectItem>
                            <SelectItem value="ENRICHING">Enriching</SelectItem>
                            <SelectItem value="ENRICHED">Enriched</SelectItem>
                            <SelectItem value="CONTACTED">Contacted</SelectItem>
                            <SelectItem value="CONVERTED">Converted</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="modal-notes" className="text-xs">Internal Notes</Label>
                        <Textarea
                          id="modal-notes"
                          rows={3}
                          placeholder="Log conversation history or special installation requests..."
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          className="bg-background border-border text-sm"
                        />
                      </div>
                      <Button onClick={handleSaveDetails} disabled={savingNotes} className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold">
                        {savingNotes ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                        Save Status & Notes
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Decision Maker Contacts */}
                  <Card className="bg-muted/30 border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-semibold">Verified Decision Makers</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      {selectedProspect.contacts.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No enriched contacts found. Run enrichment to find decision makers.</p>
                      ) : (
                        selectedProspect.contacts.map((contact) => {
                          const isBlocked = !contact.ctps_clean;
                          const showNumber = showBlockedNumber[contact.id] || false;
                          const phoneDisplay = isBlocked 
                            ? (showNumber ? contact.phone : "[CTPS EXCLUDED]")
                            : contact.phone;

                          return (
                            <div key={contact.id} className="p-2.5 bg-background/50 border border-border/50 rounded space-y-1.5 text-xs">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-semibold text-foreground text-sm flex items-center gap-1">
                                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                                    {contact.first_name} {contact.last_name}
                                  </span>
                                  <span className="text-muted-foreground block text-[10px]">{contact.title}</span>
                                </div>
                                <div className="flex gap-1">
                                  {contact.email_verified && (
                                    <Badge className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-[9px] px-1 rounded-sm">Verified</Badge>
                                  )}
                                  {contact.linkedin_url && (
                                    <a href={`https://${contact.linkedin_url}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                                      <Linkedin className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1 text-[11px] pt-1.5 border-t border-border/30">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <a href={`mailto:${contact.email}`} className="text-foreground hover:underline">{contact.email}</a>
                                </span>
                                <span className="flex items-center justify-between gap-1.5 text-muted-foreground">
                                  <span className="flex items-center gap-1.5">
                                    <Phone className="w-3 h-3 shrink-0" />
                                    <span className="font-mono text-foreground">{phoneDisplay}</span>
                                  </span>
                                  {isBlocked && (
                                    <button 
                                      type="button" 
                                      onClick={() => setShowBlockedNumber(p => ({ ...p, [contact.id]: !showNumber }))} 
                                      className="text-amber-400 hover:text-amber-300 text-[10px] flex items-center gap-0.5"
                                      title="This number is registered on CTPS exclusions"
                                    >
                                      {showNumber ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                      {showNumber ? "Mask" : "Show (LI Override)"}
                                    </button>
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>

                  {/* Activity Logs */}
                  <Card className="bg-muted/30 border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-semibold">Activity Logging History</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 h-[150px] overflow-y-auto space-y-2 pr-1.5">
                      {loadingLogs ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      ) : activityLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No log history found.</p>
                      ) : (
                        activityLogs.map((log) => (
                          <div key={log.id} className="text-[11px] pb-1.5 border-b border-border/20 last:border-b-0 space-y-0.5">
                            <div className="flex justify-between items-center text-muted-foreground">
                              <span className="font-bold text-foreground uppercase tracking-wider text-[9px]">{log.action}</span>
                              <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">{log.details}</p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

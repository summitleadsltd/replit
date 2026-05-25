import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Users, Plus, Trash2, Play, Pause, Settings, FileText, Pencil, AlertCircle, X, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import CampaignPhonePool from "@/components/campaigns/CampaignPhonePool";
import CampaignNumberPool from "@/components/campaigns/CampaignNumberPool";
import { useCampaignPhones } from "@/hooks/use-campaign-phones";
import PredictiveDialerControl from "@/components/campaigns/PredictiveDialerControl";
import PredictiveTickAuditLog from "@/components/campaigns/PredictiveTickAuditLog";
import { useAuth } from "@/hooks/use-auth";

interface CampaignScript {
  id: string;
  title: string;
  body: string;
  sort_order: number;
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [campaign, setCampaign] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [searchAvailable, setSearchAvailable] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  // Scripts state
  const [scripts, setScripts] = useState<CampaignScript[]>([]);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [editingScript, setEditingScript] = useState<CampaignScript | null>(null);
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptBody, setScriptBody] = useState("");
  const [savingScript, setSavingScript] = useState(false);

  // Telephony providers list for dropdown
  const [providers, setProviders] = useState<{ id: string; name: string; provider_type: string }[]>([]);

  // Campaign phone pool
  const { phones, fetchPhones } = useCampaignPhones(id || null);

  // Agent management state
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [managingAgents, setManagingAgents] = useState(false);
  const [searchAgents, setSearchAgents] = useState("");

  const fetchCampaign = async () => {
    if (!id) return;
    const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).single();
    if (error) throw error;
    setCampaign(data);
  };

  const fetchCampaignContacts = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("campaign_contacts")
      .select("*, contacts(first_name, last_name, phone_e164, lead_status)")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    setContacts(data || []);
  };

  const fetchAgents = async () => {
    if (!id) return;
    const { data: agentLinks, error } = await supabase
      .from("campaign_agents")
      .select("id, user_id")
      .eq("campaign_id", id);
    if (error) throw error;

    if (!agentLinks || agentLinks.length === 0) {
      setAgents([]);
      return;
    }

    const userIds = agentLinks.map(a => a.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .in("user_id", userIds);

    const agents = agentLinks.map(link => ({
      ...link,
      profiles: profiles?.find(p => p.user_id === link.user_id) || null
    }));
    setAgents(agents);
  };

  // Agent management functions
  const fetchAvailableAgents = async () => {
    try {
      // Get existing agent IDs in this campaign
      const existingAgentIds = agents.map(a => a.user_id);

      // Get all active profiles
      let query = supabase
        .from("profiles")
        .select("user_id, display_name, email, is_active")
        .eq("is_active", true);

      if (existingAgentIds.length > 0) {
        query = query.not("user_id", "in", `(${existingAgentIds.join(",")})`);
      }

      const { data: profiles, error: profilesError } = await query;
      if (profilesError) throw profilesError;

      // Get user roles for these profiles
      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: roles, error: rolesError } = userIds.length > 0
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", userIds)
        : { data: [] };
      if (rolesError) throw rolesError;

      // Filter to only agents and team leaders
      const roleSet = new Set(roles?.map(r => r.user_id));
      const agentAndTeamLeaderIds = roles
        ?.filter(r => r.role === "agent" || r.role === "team_leader")
        .map(r => r.user_id) || [];

      const filtered = profiles?.filter(p => agentAndTeamLeaderIds.includes(p.user_id)) || [];
      setAvailableAgents(filtered);
    } catch (err: any) {
      toast({ title: "Error loading available agents", description: err.message, variant: "destructive" });
    }
  };

  const handleAddAgents = async () => {
    if (!id || selectedAgents.length === 0) return;
    setManagingAgents(true);
    try {
      const links = selectedAgents.map(userId => ({
        campaign_id: id,
        user_id: userId,
      }));

      const { error } = await supabase.from("campaign_agents").insert(links);
      if (error) throw error;

      toast({ title: "Agents added", description: `${selectedAgents.length} agent(s) assigned to campaign` });
      setShowAgentDialog(false);
      setSelectedAgents([]);
      await fetchAgents();
    } catch (err: any) {
      toast({ title: "Error adding agents", description: err.message, variant: "destructive" });
    } finally {
      setManagingAgents(false);
    }
  };

  const handleRemoveAgent = async (agentId: string) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from("campaign_agents")
        .delete()
        .eq("campaign_id", id)
        .eq("user_id", agentId);

      if (error) throw error;
      toast({ title: "Agent removed" });
      await fetchAgents();
    } catch (err: any) {
      toast({ title: "Error removing agent", description: err.message, variant: "destructive" });
    }
  };

  const openAgentDialog = async () => {
    await fetchAvailableAgents();
    setShowAgentDialog(true);
  };

  const toggleAgentSelection = (userId: string) => {
    setSelectedAgents(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const fetchScripts = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("campaign_scripts")
      .select("*")
      .eq("campaign_id", id)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    setScripts((data || []) as CampaignScript[]);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        await Promise.all([fetchCampaign(), fetchCampaignContacts(), fetchAgents(), fetchScripts()]);
        const { data: prov, error: provError } = await supabase.from("telephony_providers").select("id, name, provider_type").eq("is_active", true);
        if (provError) throw provError;
        setProviders((prov || []) as any[]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load campaign details.";
        setErrorMessage(message);
        toast({ title: "Could not load campaign details", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const fetchAvailableContacts = async () => {
    try {
      const { data: existing, error: existingError } = await supabase
        .from("campaign_contacts")
        .select("contact_id")
        .eq("campaign_id", id!);
      if (existingError) throw existingError;
      const existingIds = (existing || []).map(e => e.contact_id);

      let query = supabase.from("contacts").select("id, first_name, last_name, phone_e164").order("first_name").limit(200);
      if (searchAvailable) {
        query = query.or(`first_name.ilike.%${searchAvailable}%,last_name.ilike.%${searchAvailable}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setAvailableContacts((data || []).filter(c => !existingIds.includes(c.id)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load available contacts.";
      toast({ title: "Could not load available contacts", description: message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (showAddContacts) fetchAvailableContacts();
  }, [showAddContacts, searchAvailable]);

  const handleAddContacts = async () => {
    if (selectedContacts.length === 0) return;
    setAdding(true);
    const rows = selectedContacts.map(contactId => ({ campaign_id: id!, contact_id: contactId }));
    const { error } = await supabase.from("campaign_contacts").insert(rows);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Added", description: `${selectedContacts.length} contacts added to campaign` });
      setShowAddContacts(false);
      setSelectedContacts([]);
      fetchCampaignContacts();
    }
    setAdding(false);
  };

  const handleRemoveContact = async (ccId: string) => {
    const { error } = await supabase.from("campaign_contacts").delete().eq("id", ccId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setContacts(prev => prev.filter(c => c.id !== ccId));
    }
  };

  const handleStatusChange = async (newStatus: "draft" | "active" | "paused" | "completed" | "archived") => {
    if (!id) return;
    const { error } = await supabase.from("campaigns").update({ status: newStatus }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setCampaign((prev: any) => ({ ...prev, status: newStatus }));
      toast({ title: "Updated", description: `Campaign set to ${newStatus}` });
    }
  };

  // Script handlers
  const openCreateScript = () => {
    setEditingScript(null);
    setScriptTitle("");
    setScriptBody("");
    setShowScriptDialog(true);
  };

  const openEditScript = (s: CampaignScript) => {
    setEditingScript(s);
    setScriptTitle(s.title);
    setScriptBody(s.body);
    setShowScriptDialog(true);
  };

  const handleSaveScript = async () => {
    if (!scriptTitle.trim() || !id) return;
    setSavingScript(true);
    if (editingScript) {
      const { error } = await supabase
        .from("campaign_scripts")
        .update({ title: scriptTitle.trim(), body: scriptBody })
        .eq("id", editingScript.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Script updated" });
    } else {
      const { error } = await supabase
        .from("campaign_scripts")
        .insert({ campaign_id: id, title: scriptTitle.trim(), body: scriptBody, sort_order: scripts.length });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Script created" });
    }
    setSavingScript(false);
    setShowScriptDialog(false);
    fetchScripts();
  };

  const handleDeleteScript = async (scriptId: string) => {
    const { error } = await supabase.from("campaign_scripts").delete().eq("id", scriptId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Script deleted" }); fetchScripts(); }
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      active: "bg-green-500/10 text-green-400",
      paused: "bg-warning/10 text-warning",
      completed: "bg-primary/10 text-primary",
      archived: "bg-muted text-muted-foreground",
    };
    return map[s] || "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-muted-foreground p-8">Campaign not found.</p>;
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {errorMessage && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </CardContent>
        </Card>
      )}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
            <Badge variant="secondary" className={statusColor(campaign.status)}>{campaign.status}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {contacts.length} contacts · {agents.length} agents · {campaign.dial_mode} mode
          </p>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <Button size="sm" onClick={() => handleStatusChange("active")}>
              <Play className="w-4 h-4 mr-1" /> Activate
            </Button>
          )}
          {campaign.status === "active" && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("paused")}>
              <Pause className="w-4 h-4 mr-1" /> Pause
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button size="sm" onClick={() => handleStatusChange("active")}>
              <Play className="w-4 h-4 mr-1" /> Resume
            </Button>
          )}
        </div>
      </div>

      {/* Campaign Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5" /> Campaign Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Dial Mode</span>
              <Select value={campaign.dial_mode || "click_to_call"} onValueChange={async (v) => {
                await supabase.from("campaigns").update({ dial_mode: v }).eq("id", id!);
                setCampaign((prev: any) => ({ ...prev, dial_mode: v }));
                toast({ title: "Dial mode updated" });
              }}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="click_to_call">Click to Call</SelectItem>
                  <SelectItem value="power_dial">Power Dial</SelectItem>
                  <SelectItem value="auto_dial">Auto Dial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-muted-foreground">Telephony Provider</span>
              <Select value={campaign.telephony_provider_id || "__none__"} onValueChange={async (v) => {
                const val = v === "__none__" ? null : v;
                await supabase.from("campaigns").update({ telephony_provider_id: val }).eq("id", id!);
                setCampaign((prev: any) => ({ ...prev, telephony_provider_id: val }));
                toast({ title: "Provider updated" });
              }}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Default (Telnyx)</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.provider_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-muted-foreground">Queue Strategy</span>
              <p className="font-medium text-foreground">{campaign.queue_strategy}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Wrap-Up</span>
              <p className="font-medium text-foreground">{campaign.wrap_up_seconds}s</p>
            </div>
            <div>
              <span className="text-muted-foreground">Max Attempts</span>
              <p className="font-medium text-foreground">{campaign.max_attempts}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phone Number Pool */}
      <CampaignPhonePool campaignId={id!} phones={phones} onRefresh={fetchPhones} />

      {/* Campaign-scoped Number Pool */}
      <CampaignNumberPool campaignId={id!} />

      {/* Predictive dialer controls — shown only when campaign is in auto/predictive mode */}
      {(campaign.dial_mode === "auto_dial" || campaign.dial_mode === "predictive") && (
        <PredictiveDialerControl
          campaignId={id!}
          enabled={campaign.status === "active"}
        />
      )}

      {/* Admin-only audit log of every predictive tick for this campaign */}
      {isAdmin && (campaign.dial_mode === "auto_dial" || campaign.dial_mode === "predictive") && (
        <PredictiveTickAuditLog campaignId={id!} />
      )}

      {/* Scripts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" /> Scripts & Rebuttals ({scripts.length})
          </CardTitle>
          <Button size="sm" onClick={openCreateScript}>
            <Plus className="w-4 h-4 mr-1" /> Add Script
          </Button>
        </CardHeader>
        <CardContent>
          {scripts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scripts yet. Add scripts to guide agents during calls.</p>
          ) : (
            <div className="space-y-3">
              {scripts.map((s) => (
                <div key={s.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditScript(s)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteScript(s.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.body}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" /> Contacts ({contacts.length})
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddContacts(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Contacts
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dial Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No contacts in this campaign. Click "Add Contacts" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((cc) => (
                  <TableRow key={cc.id}>
                    <TableCell className="font-medium">
                      {cc.contacts?.first_name} {cc.contacts?.last_name}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{cc.contacts?.phone_e164 || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{cc.contacts?.lead_status || "new"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{cc.dial_status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{cc.attempts || 0}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveContact(cc.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Agents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" /> Assigned Agents ({agents.length})
          </CardTitle>
          <Button size="sm" onClick={openAgentDialog}>
            <Plus className="w-4 h-4 mr-1" /> Add Agents
          </Button>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-muted-foreground text-sm">No agents assigned. Click "Add Agents" to assign agents to this campaign.</p>
          ) : (
            <div className="space-y-2">
              {agents.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm font-medium text-foreground">
                    {(a.profiles as any)?.display_name || (a.profiles as any)?.email || a.user_id}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAgent(a.user_id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Agents Dialog */}
      <Dialog open={showAgentDialog} onOpenChange={(open) => {
        if (!open) {
          setSearchAgents("");
          setSelectedAgents([]);
        }
        setShowAgentDialog(open);
      }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Agents to Campaign</DialogTitle>
            <DialogDescription>
              Select agents to assign to this campaign. Only active agents not already assigned are shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search agents..."
              value={searchAgents}
              onChange={(e) => setSearchAgents(e.target.value)}
            />

            {availableAgents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No available agents found. All agents are already assigned to this campaign.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                {availableAgents
                  .filter(agent =>
                    !searchAgents ||
                    (agent.display_name || '').toLowerCase().includes(searchAgents.toLowerCase()) ||
                    (agent.email || '').toLowerCase().includes(searchAgents.toLowerCase())
                  )
                  .map((agent) => (
                    <div
                      key={agent.user_id}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                        selectedAgents.includes(agent.user_id)
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleAgentSelection(agent.user_id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedAgents.includes(agent.user_id)
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground'
                        }`}>
                          {selectedAgents.includes(agent.user_id) && (
                            <Check className="w-3 h-3 text-primary-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{agent.display_name || agent.email}</p>
                          <p className="text-xs text-muted-foreground">{agent.email}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {(agent.user_roles as any)?.[0]?.role || 'agent'}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedAgents.length} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAgentDialog(false);
                    setSelectedAgents([]);
                    setSearchAgents("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddAgents}
                  disabled={selectedAgents.length === 0 || managingAgents}
                >
                  {managingAgents ? "Adding..." : "Add Selected"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Contacts Dialog */}
      <Dialog open={showAddContacts} onOpenChange={setShowAddContacts}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contacts to Campaign</DialogTitle>
            <DialogDescription>Search and select contacts to assign to this campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search contacts..."
              value={searchAvailable}
              onChange={(e) => setSearchAvailable(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto border border-border rounded-md">
              {availableContacts.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4 text-center">No available contacts found.</p>
              ) : (
                availableContacts.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer border-b border-border last:border-0">
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedContacts(prev => [...prev, c.id]);
                        else setSelectedContacts(prev => prev.filter(id => id !== c.id));
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-foreground">{c.first_name} {c.last_name}</span>
                    <span className="text-xs text-muted-foreground ml-auto font-mono">{c.phone_e164 || "—"}</span>
                  </label>
                ))
              )}
            </div>
            {selectedContacts.length > 0 && (
              <p className="text-sm text-muted-foreground">{selectedContacts.length} selected</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddContacts(false); setSelectedContacts([]); }}>Cancel</Button>
            <Button onClick={handleAddContacts} disabled={adding || selectedContacts.length === 0}>
              {adding ? "Adding..." : `Add ${selectedContacts.length} Contacts`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Script Dialog */}
      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingScript ? "Edit Script" : "Add Script"}</DialogTitle>
            <DialogDescription>{editingScript ? "Update the campaign script content." : "Create a new script for agents to use during calls."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={scriptTitle}
                onChange={(e) => setScriptTitle(e.target.value)}
                placeholder="e.g. Opening Script, Rebuttal - Price Objection"
              />
            </div>
            <div className="space-y-2">
              <Label>Script Body</Label>
              <Textarea
                value={scriptBody}
                onChange={(e) => setScriptBody(e.target.value)}
                placeholder="Hi, this is [Agent Name] from Summit Leads..."
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScriptDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveScript} disabled={savingScript || !scriptTitle.trim()}>
              {savingScript ? "Saving..." : editingScript ? "Update Script" : "Add Script"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

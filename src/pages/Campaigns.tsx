import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Megaphone, Trash2, AlertCircle, Loader2 } from "lucide-react";
import CampaignModal from "@/components/campaigns/CampaignModal";
import DeleteConfirmDialog from "@/components/contacts/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load campaigns.";
      setErrorMessage(message);
      toast({ title: "Could not load campaigns", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const handleDeleteCampaign = async () => {
    if (!deleteTarget) return;
    try {
      const steps = [
        supabase.from("campaign_contacts").delete().eq("campaign_id", deleteTarget.id),
        supabase.from("campaign_agents").delete().eq("campaign_id", deleteTarget.id),
        supabase.from("campaign_scripts").delete().eq("campaign_id", deleteTarget.id),
        supabase.from("campaign_caller_ids").delete().eq("campaign_id", deleteTarget.id),
        supabase.from("call_attempts").update({ campaign_id: null }).eq("campaign_id", deleteTarget.id),
        supabase.from("callbacks").update({ campaign_id: null }).eq("campaign_id", deleteTarget.id),
        supabase.from("appointments").update({ campaign_id: null }).eq("campaign_id", deleteTarget.id),
      ];
      const results = await Promise.all(steps);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      const { error } = await supabase.from("campaigns").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Campaign deleted" });
      setDeleteTarget(null);
      await fetchCampaigns();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete campaign.";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    }
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground", active: "bg-success/10 text-success",
      paused: "bg-warning/10 text-warning", completed: "bg-primary/10 text-primary",
      archived: "bg-muted text-muted-foreground",
    };
    return map[s] || "";
  };

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground text-sm mt-1">{campaigns.length} campaigns</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-2" />New Campaign</Button>
      </div>

      {errorMessage && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading campaigns...</p>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No campaigns yet.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer group relative">
              <div onClick={() => navigate(`/campaigns/${c.id}`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <Badge variant="secondary" className={statusColor(c.status)}>{c.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>Mode: {c.dial_mode}</div>
                    <div>Strategy: {c.queue_strategy}</div>
                    <div>Wrap: {c.wrap_up_seconds}s</div>
                    <div>Max attempts: {c.max_attempts}</div>
                  </div>
                </CardContent>
              </div>
              <Button
                variant="ghost" size="icon"
                className="absolute top-3 right-12 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <CampaignModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchCampaigns(); }} />
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Delete Campaign"
        description="This will permanently remove this campaign, its contact assignments, agent assignments, and scripts. Historical call logs will be preserved but unlinked."
        itemName={deleteTarget?.name || ""}
        onConfirm={handleDeleteCampaign}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

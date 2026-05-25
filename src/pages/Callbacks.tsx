import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Clock, CheckCircle, Phone, RefreshCw, Loader2 } from "lucide-react";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { toESTDate } from "@/lib/timezone";
import { toast } from "@/hooks/use-toast";

interface CallbackRow {
  id: string;
  contact_id: string;
  agent_id: string | null;
  campaign_id: string | null;
  callback_at: string;
  notes: string | null;
  priority: number;
  status: string;
  created_at: string;
  contact_name: string;
  contact_phone: string | null;
  campaign_name: string | null;
}

const statusColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-success/10 text-success border-success/30",
  missed: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function Callbacks() {
  const { user, isAdmin } = useAuth();
  const [callbacks, setCallbacks] = useState<CallbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchCallbacks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("callbacks")
        .select("id, contact_id, agent_id, campaign_id, callback_at, notes, priority, status, created_at, contacts(first_name, last_name, phone_e164), campaigns(name)")
        .order("callback_at", { ascending: true });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      // Non-admin agents only see their own callbacks
      if (!isAdmin && user) {
        query = query.eq("agent_id", user.id);
      }

      const { data, error } = await query;

      if (error) {
        toast({ title: "Error loading callbacks", description: error.message, variant: "destructive" });
        return;
      }

      setCallbacks(
        (data || []).map((cb: any) => ({
          id: cb.id,
          contact_id: cb.contact_id,
          agent_id: cb.agent_id,
          campaign_id: cb.campaign_id,
          callback_at: cb.callback_at,
          notes: cb.notes,
          priority: cb.priority ?? 0,
          status: cb.status,
          created_at: cb.created_at,
          contact_name: cb.contacts ? `${cb.contacts.first_name} ${cb.contacts.last_name}` : "Unknown",
          contact_phone: cb.contacts?.phone_e164 || null,
          campaign_name: cb.campaigns?.name || null,
        }))
      );
    } catch (err) {
      toast({ title: "Error loading callbacks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, statusFilter]);

  useEffect(() => {
    fetchCallbacks();
  }, [fetchCallbacks]);

  const markCompleted = async (id: string) => {
    setCompleting(id);
    try {
      const { error } = await supabase
        .from("callbacks")
        .update({ status: "completed" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Callback marked as completed" });
      fetchCallbacks();
    } catch (err) {
      toast({ title: "Error updating callback", variant: "destructive" });
    } finally {
      setCompleting(null);
    }
  };

  const overdue = useMemo(() => callbacks.filter((cb) => cb.status === "pending" && isPast(new Date(cb.callback_at))), [callbacks]);
  const upcoming = useMemo(() => callbacks.filter((cb) => cb.status === "pending" && !isPast(new Date(cb.callback_at))), [callbacks]);
  const completed = useMemo(() => callbacks.filter((cb) => cb.status === "completed"), [callbacks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Callbacks</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {callbacks.length} callback{callbacks.length !== 1 ? "s" : ""}{statusFilter !== "all" ? ` (${statusFilter})` : ""}
            {overdue.length > 0 && statusFilter === "pending" && (
              <span className="text-destructive ml-2">• {overdue.length} overdue</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchCallbacks}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {callbacks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <CalendarClock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No callbacks found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {callbacks.map((cb) => {
            const isOverdue = cb.status === "pending" && isPast(new Date(cb.callback_at));
            return (
              <Card key={cb.id} className={isOverdue ? "border-destructive/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{cb.contact_name}</h3>
                        <Badge variant="outline" className={`text-xs ${statusColor[cb.status] || ""}`}>
                          {cb.status}
                        </Badge>
                        {isOverdue && (
                          <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(toESTDate(cb.callback_at), "MMM d, yyyy h:mm a")}
                          {cb.status === "pending" && (
                            <span className={isOverdue ? "text-destructive" : "text-muted-foreground"}>
                              ({formatDistanceToNow(new Date(cb.callback_at), { addSuffix: true })})
                            </span>
                          )}
                        </span>
                        {cb.contact_phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {cb.contact_phone}
                          </span>
                        )}
                        {cb.campaign_name && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {cb.campaign_name}
                          </span>
                        )}
                      </div>
                      {cb.notes && (
                        <p className="text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded">{cb.notes}</p>
                      )}
                    </div>
                    {cb.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markCompleted(cb.id)}
                        disabled={completing === cb.id}
                        className="shrink-0"
                      >
                        {completing === cb.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        )}
                        Done
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

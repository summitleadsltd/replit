import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useSpanishAgents } from "@/hooks/use-spanish-agents";
import { useTransferCall } from "@/hooks/use-transfer-call";
import type { AgentPresence } from "@/hooks/use-agent-presence";
import { PhoneForwarded, Users, AlertCircle, CheckCircle, Loader2, X } from "lucide-react";

interface TransferPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string | null;
  callControlId: string | null;
  currentLeadId: string | null;
  callAttemptId: string | null;
  fromAgentId: string;
  onTransferComplete: () => void;
  onTransferFailed: () => void;
}

export function TransferPanel({
  isOpen,
  onClose,
  roomName,
  callControlId,
  currentLeadId,
  callAttemptId,
  fromAgentId,
  onTransferComplete,
  onTransferFailed,
}: TransferPanelProps) {
  const { availableAgents, busyAgents, hasAvailableAgents, loading } = useSpanishAgents();
  const [selectedAgent, setSelectedAgent] = useState<AgentPresence | null>(null);
  const [isColdTransfer, setIsColdTransfer] = useState(false);
  const [context, setContext] = useState("");
  const [showFlagOption, setShowFlagOption] = useState(false);

  const {
    isTransferring,
    transferStage,
    error,
    initiateWarmTransfer,
    completeWarmTransfer,
    initiateColdTransfer,
    flagForSpanishCallback,
    resetTransfer,
  } = useTransferCall(
    roomName,
    callControlId,
    currentLeadId,
    () => {
      toast({
        title: "Transfer complete",
        description: "Lead successfully transferred to Spanish agent.",
      });
      onTransferComplete();
      onClose();
    },
    () => {
      toast({
        title: "Transfer failed",
        description: error || "Could not complete transfer. You're still on the call.",
        variant: "destructive",
      });
      onTransferFailed();
      setShowFlagOption(true);
    }
  );

  if (!isOpen) return null;

  const handleTransfer = async (agent: AgentPresence) => {
    setSelectedAgent(agent);

    if (isColdTransfer) {
      if (!callAttemptId) {
        toast({ title: "Error", description: "No call record found", variant: "destructive" });
        return;
      }
      const success = await initiateColdTransfer(agent, callAttemptId, fromAgentId);
      if (!success) {
        setShowFlagOption(true);
      }
    } else {
      if (!callAttemptId) {
        toast({ title: "Error", description: "No call record found", variant: "destructive" });
        return;
      }
      const success = await initiateWarmTransfer(agent, context, callAttemptId);
      if (!success) {
        setShowFlagOption(true);
      }
    }
  };

  const handleCompleteWarmTransfer = async () => {
    if (!callAttemptId) return;
    await completeWarmTransfer(callAttemptId, fromAgentId);
  };

  const handleFlagForCallback = async () => {
    if (!currentLeadId) {
      toast({ title: "Error", description: "No lead selected", variant: "destructive" });
      return;
    }
    const success = await flagForSpanishCallback(currentLeadId);
    if (success) {
      toast({
        title: "Lead flagged",
        description: "Set to callback_spanish and language = es for Spanish queue routing.",
      });
      onClose();
    }
  };

  const handleClose = () => {
    resetTransfer();
    setSelectedAgent(null);
    setShowFlagOption(false);
    setContext("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <PhoneForwarded className="w-5 h-5" />
            Transfer to Spanish Agent
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Transfer Mode Toggle */}
          {!isTransferring && transferStage === "idle" && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <div className="flex flex-col">
                <span className="font-medium">Cold Transfer</span>
                <span className="text-xs text-muted-foreground">Immediate handoff, no context exchange</span>
              </div>
              <Switch checked={isColdTransfer} onCheckedChange={setIsColdTransfer} />
            </div>
          )}

          {/* Context Input for Warm Transfer */}
          {!isColdTransfer && !isTransferring && transferStage === "idle" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Transfer Context</label>
              <Textarea
                placeholder="Brief notes for the Spanish agent..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Loading Spanish agents...</span>
            </div>
          )}

          {/* Transfer In Progress */}
          {isTransferring && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-md">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium">
                    {transferStage === "dialing_agent" && "Dialing Spanish agent..."}
                    {transferStage === "consulting" && "Consultation in progress"}
                    {transferStage === "completing" && "Completing transfer..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {transferStage === "dialing_agent" && "Waiting for agent to answer (20s timeout)"}
                    {transferStage === "consulting" && "You and the Spanish agent are both connected. Click Complete when ready to hand off."}
                  </p>
                </div>
              </div>

              {transferStage === "consulting" && (
                <Button onClick={handleCompleteWarmTransfer} className="w-full">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Transfer & Drop
                </Button>
              )}
            </div>
          )}

          {/* Error State with Flag Option */}
          {error && !isTransferring && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-md">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Transfer failed</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>

              {showFlagOption && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm mb-2">No Spanish agents available. Flag lead for later callback?</p>
                  <Button onClick={handleFlagForCallback} variant="outline" size="sm" className="w-full">
                    Set language = es, disposition = callback_spanish
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Agent List */}
          {!isTransferring && !error && transferStage === "idle" && (
            <div className="space-y-4">
              {!hasAvailableAgents && !loading && (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No Spanish agents currently available</p>
                  <Button onClick={handleFlagForCallback} variant="outline" className="mt-3">
                    Flag lead for Spanish callback
                  </Button>
                </div>
              )}

              {availableAgents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Available</h4>
                  {availableAgents.map((agent) => (
                    <div
                      key={agent.user_id}
                      className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{agent.display_name || agent.email}</p>
                        <Badge variant="default" className="text-xs mt-1">Available</Badge>
                      </div>
                      <Button size="sm" onClick={() => handleTransfer(agent)}>
                        Transfer
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {busyAgents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">On Call</h4>
                  {busyAgents.map((agent) => (
                    <div
                      key={agent.user_id}
                      className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
                    >
                      <div>
                        <p className="font-medium text-muted-foreground">{agent.display_name || agent.email}</p>
                        <Badge variant="secondary" className="text-xs mt-1">On Call</Badge>
                      </div>
                      <Button size="sm" disabled>
                        Busy
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

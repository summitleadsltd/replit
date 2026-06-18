import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PhotoUpload from "./PhotoUpload";
import { MapPin, Clock } from "lucide-react";

interface InspectionOutcomeFormProps {
  appointmentId: string;
  technicianId: string;
  onComplete?: () => void;
}

const OUTCOMES = [
  { value: "qualified", label: "Qualified" },
  { value: "not_qualified", label: "Not Qualified" },
  { value: "needs_follow_up", label: "Needs Follow Up" },
  { value: "engineering_review", label: "Engineering Review" },
] as const;

const NEXT_STEPS = [
  { value: "schedule_proposal", label: "Schedule Proposal" },
  { value: "permit_review", label: "Permit Review" },
  { value: "engineering_visit", label: "Engineering Visit" },
  { value: "installation", label: "Installation" },
  { value: "call_back", label: "Call Back" },
  { value: "no_action", label: "No Action" },
] as const;

type Outcome = (typeof OUTCOMES)[number]["value"];
type NextStep = (typeof NEXT_STEPS)[number]["value"];

export default function InspectionOutcomeForm({
  appointmentId,
  technicianId,
  onComplete,
}: InspectionOutcomeFormProps) {
  const [roofType, setRoofType] = useState("");
  const [roofAge, setRoofAge] = useState("");
  const [panelSize, setPanelSize] = useState("");
  const [shading, setShading] = useState("");
  const [electricalCondition, setElectricalCondition] = useState("");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [nextStep, setNextStep] = useState<NextStep | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inspectionStarted, setInspectionStarted] = useState(false);
  const [inspectionStartTime, setInspectionStartTime] = useState<Date | null>(null);
  const [inspectionLocation, setInspectionLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const startInspection = async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      });

      setInspectionLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      setInspectionStartTime(new Date());
      setInspectionStarted(true);
      setLocationError(null);
      toast.success("Inspection started - location captured");
    } catch (error) {
      console.error("Error getting location:", error);
      setLocationError("Failed to capture location. Please enable location services.");
      toast.error("Failed to capture location");
    }
  };

  const handleSubmit = async () => {
    if (!outcome) {
      toast.error("Please select an inspection result");
      return;
    }

    if (!inspectionStarted) {
      toast.error("Please start the inspection first to capture location and time");
      return;
    }

    setSubmitting(true);
    try {
      const inspectionDuration = inspectionStartTime
        ? Math.round((new Date().getTime() - inspectionStartTime.getTime()) / 60000) // minutes
        : 0;

      const { error } = await supabase.from("appointment_outcomes").insert({
        appointment_id: appointmentId,
        technician_id: technicianId,
        roof_type: roofType || null,
        roof_age: roofAge ? parseInt(roofAge) : null,
        panel_size: panelSize || null,
        shading: shading || null,
        electrical_condition: electricalCondition || null,
        outcome: outcome as Outcome,
        next_step: nextStep || null,
        notes: notes || null,
        inspection_started_at: inspectionStartTime?.toISOString(),
        inspection_completed_at: new Date().toISOString(),
        inspection_duration_minutes: inspectionDuration,
        inspection_latitude: inspectionLocation?.latitude,
        inspection_longitude: inspectionLocation?.longitude,
        location_accuracy: inspectionLocation?.accuracy,
      });

      if (error) throw error;

      toast.success("Inspection outcome recorded successfully");
      onComplete?.();
      
      // Reset form
      setRoofType("");
      setRoofAge("");
      setPanelSize("");
      setShading("");
      setElectricalCondition("");
      setOutcome("");
      setNextStep("");
      setNotes("");
      setInspectionStarted(false);
      setInspectionStartTime(null);
      setInspectionLocation(null);
    } catch (error) {
      console.error("Error recording outcome:", error);
      toast.error("Failed to record inspection outcome");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspection Outcome</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inspection Status */}
        <div className="bg-muted p-4 rounded-lg">
          {!inspectionStarted ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Start Inspection</h3>
                  <p className="text-sm text-muted-foreground">
                    Tap to capture GPS location and start timer
                  </p>
                </div>
                <Button onClick={startInspection} size="lg">
                  <MapPin className="w-4 h-4 mr-2" />
                  Start Inspection
                </Button>
              </div>
              {locationError && (
                <p className="text-sm text-destructive">{locationError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-medium">Inspection in Progress</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Started: {inspectionStartTime?.toLocaleTimeString()}
                </span>
              </div>
              {inspectionLocation && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {inspectionLocation.latitude.toFixed(6)}, {inspectionLocation.longitude.toFixed(6)}
                  </span>
                  <span className="text-xs">
                    (±{Math.round(inspectionLocation.accuracy)}m)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Property Information */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Property Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Roof Type</Label>
              <Input
                value={roofType}
                onChange={(e) => setRoofType(e.target.value)}
                placeholder="e.g., Asphalt shingle"
              />
            </div>
            <div>
              <Label>Roof Age (years)</Label>
              <Input
                type="number"
                value={roofAge}
                onChange={(e) => setRoofAge(e.target.value)}
                placeholder="e.g., 15"
              />
            </div>
            <div>
              <Label>Panel Size</Label>
              <Input
                value={panelSize}
                onChange={(e) => setPanelSize(e.target.value)}
                placeholder="e.g., 400W"
              />
            </div>
            <div>
              <Label>Shading</Label>
              <Input
                value={shading}
                onChange={(e) => setShading(e.target.value)}
                placeholder="e.g., Minimal, Moderate, Heavy"
              />
            </div>
          </div>
          <div>
            <Label>Electrical Condition</Label>
            <Input
              value={electricalCondition}
              onChange={(e) => setElectricalCondition(e.target.value)}
              placeholder="e.g., Good, Needs upgrade"
            />
          </div>
        </div>

        {/* Inspection Result */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Inspection Result *</h3>
          <Select value={outcome} onValueChange={setOutcome as (value: string) => void}>
            <SelectTrigger>
              <SelectValue placeholder="Select result" />
            </SelectTrigger>
            <SelectContent>
              {OUTCOMES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Next Steps */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Recommended Next Step</h3>
          <Select value={nextStep} onValueChange={setNextStep as (value: string) => void}>
            <SelectTrigger>
              <SelectValue placeholder="Select next step" />
            </SelectTrigger>
            <SelectContent>
              {NEXT_STEPS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div>
          <Label>Additional Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional observations or notes..."
            rows={3}
          />
        </div>

        {/* Photo Upload */}
        <PhotoUpload
          appointmentId={appointmentId}
          technicianId={technicianId}
          onPhotoUploaded={(photo) => {
            console.log("Photo uploaded:", photo);
          }}
        />

        <Button
          onClick={handleSubmit}
          disabled={submitting || !outcome}
          className="w-full"
        >
          {submitting ? "Recording..." : "Record Inspection Outcome"}
        </Button>
      </CardContent>
    </Card>
  );
}

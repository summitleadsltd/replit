import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, Camera, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PHOTO_TYPES = [
  { value: "roof", label: "Roof" },
  { value: "electrical_panel", label: "Electrical Panel" },
  { value: "property_overview", label: "Property Overview" },
  { value: "shading", label: "Shading" },
  { value: "obstacles", label: "Obstacles" },
  { value: "before_front_elevation", label: "Before: Front Elevation" },
  { value: "before_rear_elevation", label: "Before: Rear Elevation" },
  { value: "before_roof_front", label: "Before: Roof Front" },
  { value: "before_roof_rear", label: "Before: Roof Rear" },
  { value: "before_meter", label: "Before: Meter" },
  { value: "before_electrical_panel", label: "Before: Electrical Panel" },
  { value: "during_damage", label: "During: Damage" },
  { value: "during_shading_issues", label: "During: Shading Issues" },
  { value: "during_structural_issues", label: "During: Structural Issues" },
  { value: "during_safety_concerns", label: "During: Safety Concerns" },
  { value: "after_completed_inspection", label: "After: Completed Inspection" },
  { value: "after_customer_signature", label: "After: Customer Signature" },
  { value: "after_additional_notes", label: "After: Additional Notes" },
];

interface PhotoUploadProps {
  appointmentId: string;
  technicianId: string;
  onPhotoUploaded?: (photo: any) => void;
  appointmentType?: string;
}

interface Photo {
  file: File;
  type: string;
  caption: string;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
}

export default function PhotoUpload({
  appointmentId,
  technicianId,
  onPhotoUploaded,
  appointmentType = "inspection",
}: PhotoUploadProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [requiredPhotoTypes, setRequiredPhotoTypes] = useState<string[]>([]);
  const [uploadedPhotoTypes, setUploadedPhotoTypes] = useState<Set<string>>(new Set());
  const [loadingRequirements, setLoadingRequirements] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRequiredPhotoTypes();
    loadUploadedPhotos();
  }, [appointmentId, appointmentType]);

  const loadRequiredPhotoTypes = async () => {
    try {
      setLoadingRequirements(true);
      const { data, error } = await supabase
        .from("photo_requirements")
        .select("photo_type")
        .eq("appointment_type", appointmentType)
        .eq("required", true);

      if (error) throw error;
      setRequiredPhotoTypes(data?.map((r) => r.photo_type) || []);
    } catch (error) {
      console.error("Error loading required photo types:", error);
    } finally {
      setLoadingRequirements(false);
    }
  };

  const loadUploadedPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from("appointment_photos")
        .select("photo_type")
        .eq("appointment_id", appointmentId);

      if (error) throw error;
      const uploadedTypes = new Set(data?.map((p) => p.photo_type) || []);
      setUploadedPhotoTypes(uploadedTypes);
    } catch (error) {
      console.error("Error loading uploaded photos:", error);
    }
  };

  const getMissingRequiredPhotos = () => {
    return requiredPhotoTypes.filter((type) => !uploadedPhotoTypes.has(type));
  };

  const hasAllRequiredPhotos = () => {
    return getMissingRequiredPhotos().length === 0;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos: Photo[] = files.map((file) => ({
      file,
      type: "",
      caption: "",
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const updatePhotoType = (index: number, type: string) => {
    setPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, type } : p))
    );
  };

  const updatePhotoCaption = (index: number, caption: string) => {
    setPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, caption } : p))
    );
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhoto = async (photo: Photo, index: number) => {
    if (!photo.type) {
      toast.error("Please select a photo type");
      return;
    }

    setPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, uploading: true } : p))
    );

    try {
      const fileExt = photo.file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `appointment-photos/${appointmentId}/${technicianId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("appointment-photos")
        .upload(filePath, photo.file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("appointment-photos")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from("appointment_photos")
        .insert({
          appointment_id: appointmentId,
          technician_id: technicianId,
          photo_type: photo.type,
          photo_url: publicUrlData.publicUrl,
          storage_path: filePath,
          caption: photo.caption || null,
        });

      if (dbError) throw dbError;

      setPhotos((prev) =>
        prev.map((p, i) =>
          i === index
            ? { ...p, uploading: false, uploaded: true, url: publicUrlData.publicUrl }
            : p
        )
      );

      // Update uploaded photo types
      setUploadedPhotoTypes((prev) => new Set([...prev, photo.type]));

      toast.success("Photo uploaded successfully");
      onPhotoUploaded?.({
        photo_url: publicUrlData.publicUrl,
        photo_type: photo.type,
        caption: photo.caption,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload photo");
      setPhotos((prev) =>
        prev.map((p, i) => (i === index ? { ...p, uploading: false } : p))
      );
    }
  };

  const uploadAllPhotos = async () => {
    const unuploaded = photos.filter((p) => !p.uploaded && !p.uploading);
    for (const photo of unuploaded) {
      const index = photos.indexOf(photo);
      await uploadPhoto(photo, index);
    }
  };

  return (
    <div className="space-y-4">
      {/* Required Photos Status */}
      {!loadingRequirements && requiredPhotoTypes.length > 0 && (
        <div className={`p-4 rounded-lg ${hasAllRequiredPhotos() ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
          <div className="flex items-start gap-3">
            {hasAllRequiredPhotos() ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-medium mb-2">
                {hasAllRequiredPhotos() ? "All Required Photos Uploaded" : "Required Photos Missing"}
              </div>
              <div className="text-sm space-y-1">
                {requiredPhotoTypes.map((type) => {
                  const isUploaded = uploadedPhotoTypes.has(type);
                  const label = PHOTO_TYPES.find((t) => t.value === type)?.label || type;
                  return (
                    <div key={type} className="flex items-center gap-2">
                      {isUploaded ? (
                        <CheckCircle className="w-3 h-3 text-green-600" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-yellow-600" />
                      )}
                      <span className={isUploaded ? "text-green-700" : "text-yellow-700"}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label>Inspection Photos</Label>
        <Button
          type="button"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={photos.some((p) => p.uploading)}
        >
          <Camera className="w-4 h-4 mr-2" />
          Add Photo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          title="Select photos to upload"
        />
      </div>

      {photos.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No photos added yet. Click "Add Photo" to start.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {photos.map((photo, index) => (
          <div
            key={index}
            className="border border-border rounded-lg p-4 space-y-3"
          >
            <div className="flex gap-4">
              <div className="w-24 h-24 flex-shrink-0 bg-muted rounded overflow-hidden">
                <img
                  src={photo.preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <Label className="text-xs">Photo Type *</Label>
                  <Select
                    value={photo.type}
                    onValueChange={(value) => updatePhotoType(index, value)}
                    disabled={photo.uploaded}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PHOTO_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Caption (optional)</Label>
                  <Textarea
                    value={photo.caption}
                    onChange={(e) => updatePhotoCaption(index, e.target.value)}
                    placeholder="Add a description..."
                    rows={2}
                    disabled={photo.uploaded}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {photo.uploaded ? (
                  <Button size="icon" variant="ghost" disabled>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => uploadPhoto(photo, index)}
                    disabled={photo.uploading || !photo.type}
                  >
                    {photo.uploading ? (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removePhoto(index)}
                  disabled={photo.uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {photos.some((p) => !p.uploaded) && (
        <Button
          type="button"
          onClick={uploadAllPhotos}
          disabled={photos.some((p) => p.uploading) || photos.every((p) => !p.type)}
          className="w-full"
        >
          Upload All Photos
        </Button>
      )}
    </div>
  );
}

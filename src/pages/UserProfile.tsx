import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Lock, Save, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function UserProfile() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentDisplayName, setCurrentDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserEmail(user.email || "");
      setDisplayName(user.user_metadata?.display_name || "");
      setCurrentDisplayName(user.user_metadata?.display_name || "");
    }

    // Get profile display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user?.id)
      .maybeSingle();
    
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
      setCurrentDisplayName(profile.display_name);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      toast({ title: "Error", description: "Please enter a new email address", variant: "destructive" });
      return;
    }
    if (newEmail.trim().toLowerCase() === currentUserEmail.toLowerCase()) {
      toast({ title: "Error", description: "New email must be different from current email", variant: "destructive" });
      return;
    }
    setUpdatingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      toast({ title: "Success", description: "Email update initiated. Please check your new email for confirmation." });
      setNewEmail("");
      setCurrentUserEmail(newEmail.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update email";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Error", description: "New password and confirmation are required", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Success", description: "Password updated successfully" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleUpdateProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setUpdatingProfile(true);
    try {
      // Update profile table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("user_id", user.id);
      
      if (profileError) throw profileError;

      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() }
      });
      
      if (authError) throw authError;

      toast({ title: "Success", description: "Profile updated successfully" });
      setCurrentDisplayName(displayName.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingProfile(false);
    }
  };

  useEffect(() => { fetchCurrentUser(); }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current-email">Current Email</Label>
              <Input
                id="current-email"
                value={currentUserEmail}
                disabled
                className="bg-muted"
              />
            </div>
            <Button onClick={handleUpdateProfile} disabled={updatingProfile || displayName === currentDisplayName}>
              <Save className="w-4 h-4 mr-2" />
              {updatingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Email Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Change Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email Address</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
              />
              <p className="text-sm text-muted-foreground">
                You will receive a confirmation email at your new address. Click the link to complete the change.
              </p>
            </div>
            <Button onClick={handleUpdateEmail} disabled={updatingEmail}>
              {updatingEmail ? "Updating..." : "Update Email"}
            </Button>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                minLength={6}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Password must be at least 6 characters long.
            </p>
            <Button onClick={handleUpdatePassword} disabled={updatingPassword}>
              {updatingPassword ? "Updating..." : "Update Password"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

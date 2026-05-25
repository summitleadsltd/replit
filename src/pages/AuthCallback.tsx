import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processing your login…");

  useEffect(() => {
    const code = searchParams.get("code");
    const type = searchParams.get("type");

    if (!code) {
      setStatus("error");
      setMessage("No authorization code found in URL. The link may be invalid or expired.");
      return;
    }

    // Guard against duplicate execution
    let executed = false;
    let timeoutId: number | undefined;
    let homeTimeoutId: number | undefined;

    const exchange = async () => {
      if (executed) return;
      executed = true;
      try {
        // Exchange the magic link / OAuth code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        // Get the current session to determine where to redirect
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Session not established after code exchange.");
        }

        // Check if user has a password set (newly invited users won't)
        // We can't directly check, but magic link invited users typically have no password
        // Redirect all magic-link logins to set-password so they can create one
        if (type === "magiclink" || type === "invite") {
          setStatus("success");
          setMessage("Login successful! Please set a password to complete your account setup.");
          // Small delay so the user sees the success message
          timeoutId = window.setTimeout(() => {
            navigate("/set-password?new_invite=true", { replace: true });
          }, 1200);
        } else {
          // For other flows (OAuth, recovery), go to home
          setStatus("success");
          setMessage("Login successful! Redirecting…");
          homeTimeoutId = window.setTimeout(() => navigate("/", { replace: true }), 800);
        }
      } catch (err: any) {
        if (import.meta.env.DEV) console.error("[AuthCallback] Error:", err);
        setStatus("error");
        setMessage(err.message || "Failed to process login link. It may have expired.");
      }
    };

    exchange();

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (homeTimeoutId !== undefined) clearTimeout(homeTimeoutId);
    };
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <p className="text-muted-foreground">{message}</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-foreground font-medium">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-destructive font-medium">Login failed</p>
            <p className="text-muted-foreground text-sm">{message}</p>
            <button
              onClick={() => navigate("/auth", { replace: true })}
              className="text-primary underline text-sm mt-2"
            >
              Go to login page
            </button>
          </>
        )}
      </div>
    </div>
  );
}

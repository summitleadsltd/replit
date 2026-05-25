import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!anonKey) {
      console.error("[create-user] Neither SUPABASE_ANON_KEY nor SUPABASE_PUBLISHABLE_KEY found");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller with their JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, display_name, role, campaign_ids, client_account_id, technician_id, send_invite } = body;

    if (!email || !role) {
      return new Response(JSON.stringify({ error: "email and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If not sending invite, password is required
    if (!send_invite && !password) {
      return new Response(JSON.stringify({ error: "password is required when not sending invite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["admin", "manager", "team_leader", "confirmer", "agent", "technician", "client"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: `Invalid role: ${role}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId: string;
    let inviteSent = false;

    if (send_invite) {
      // Validate redirect URL to prevent open redirects
      const rawSiteUrl = Deno.env.get("SITE_URL") || "https://crm.summitleadsltd.com";
      let validatedOrigin: string;
      try {
        const url = new URL(rawSiteUrl);
        const allowedHosts = ["crm.summitleadsltd.com", "localhost"];
        if (!allowedHosts.includes(url.hostname)) {
          throw new Error(`Invalid SITE_URL host: ${url.hostname}`);
        }
        validatedOrigin = url.origin;
      } catch (_e) {
        validatedOrigin = "https://crm.summitleadsltd.com";
      }

      // Send magic link invitation - user sets password on first login
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${validatedOrigin}/auth/callback`,
        data: { display_name: display_name || email.split("@")[0] },
      });

      if (inviteError) {
        console.error("[create-user] inviteUserByEmail error:", inviteError.message);
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = inviteData.user?.id;
      if (!userId) {
        console.error("[create-user] inviteUserByEmail returned no user ID");
        return new Response(JSON.stringify({ error: "Failed to create user: no user ID returned" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inviteSent = true;
    } else {
      // Create the user via admin API with password
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: display_name || email.split("@")[0] },
      });

      if (createError) {
        console.error("[create-user] createUser error:", createError.message);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;
    }

    // The handle_new_user trigger already creates profile + agent role
    // We need to update to the correct role if not agent
    if (role !== "agent") {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "agent");

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role });
    }

    // Update display_name in profile
    if (display_name) {
      await supabaseAdmin
        .from("profiles")
        .update({ display_name })
        .eq("user_id", userId);
    }

    // Assign to campaigns if agent, team_leader, or confirmer
    if ((role === "agent" || role === "team_leader" || role === "confirmer") && campaign_ids && Array.isArray(campaign_ids) && campaign_ids.length > 0) {
      const links = campaign_ids.map((cid: string) => ({
        user_id: userId,
        campaign_id: cid,
      }));
      const { error: campaignError } = await supabaseAdmin.from("campaign_agents").insert(links);
      if (campaignError) {
        console.error("[create-user] campaign_agents insert error:", campaignError.message);
        // Don't fail the entire user creation if campaign assignment fails
        // User can be assigned to campaigns later
      }
    }

    // Assign to client account if client
    if (role === "client" && client_account_id) {
      const { error: clientError } = await supabaseAdmin.from("client_users").insert({
        user_id: userId,
        client_account_id,
      });
      if (clientError) {
        console.error("[create-user] client_users insert error:", clientError.message);
        // Don't fail the entire user creation if client assignment fails
      }
    }

    // Link to technician record if technician
    if (role === "technician" && technician_id) {
      const { error: techError } = await supabaseAdmin
        .from("technicians")
        .update({ user_id: userId })
        .eq("id", technician_id);
      if (techError) {
        console.error("[create-user] technician update error:", techError.message);
        // Don't fail the entire user creation if technician link fails
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        user_id: userId, 
        email, 
        role,
        invite_sent: inviteSent 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[create-user] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

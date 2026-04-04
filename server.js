const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const SUPABASE_URL = process.env.SUPABASE_URL || "https://guisalxfmvdkiwizxlgi.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "REPLACE_ME";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "REPLACE_ME";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const CLOUDINARY_CLOUD_NAME = "drloe7yv4";
const CLOUDINARY_API_KEY = "949256172383417";
const CLOUDINARY_API_SECRET = "t4zTHsRXinGvwAiRsUfLgw14mo4";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const PLAN_FREE = "free";
const PLAN_BASIC = "basic";
const PLAN_PRO = "pro";
const PLAN_PREMIUM = "premium";
const VALID_PLANS = [PLAN_FREE, PLAN_BASIC, PLAN_PRO, PLAN_PREMIUM];
const PAID_DASHBOARD_PLANS = [PLAN_PRO, PLAN_PREMIUM];

function requireAdminToken(req, res, next) {
  const token = req.headers["x-admin-token"] || "";

  if (!ADMIN_TOKEN) {
    return res.status(500).send("ADMIN_TOKEN is not configured on the server.");
  }

  if (token !== ADMIN_TOKEN) {
    return res.status(401).send("Invalid admin token.");
  }

  next();
}

function prettyBusinessName(businessId) {
  if (!businessId) return "Your Business";
  return businessId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildWidgetCode(payload) {
  return `<div id="applogix-review-widget"></div>

<script>
/* =========================
   CLIENT CONFIG
========================= */
const ARW_API = "https://final-widget.onrender.com";
const BUSINESS_ID = "${payload.businessId}";

const BRAND_NAME = "${payload.brandName || payload.businessName}";
const BRAND_PRIMARY = "${payload.brandPrimary || "#2563eb"}";
const BRAND_SECONDARY = "${payload.brandSecondary || "#4ea3ff"}";
const BRAND_ACCENT_GOLD = "#ffd84d";

const BRAND_LOGO_URL = "${payload.brandLogoUrl || ""}";
const SHOW_POWERED_BY = true;
const POWERED_BY_NAME = "AppLogix";
const GOOGLE_IMPORT_ENABLED = ${payload.googleImportEnabled ? "true" : "false"};
/* ========================= */
</script>

<script src="https://final-widget.onrender.com/widget.js"></script>`;
}

function buildWelcomeEmailText(data) {
  const isDashboardPlan = PAID_DASHBOARD_PLANS.includes(data.planTier);

  let text = `Subject: Welcome to AppLogix — Your Review System is Ready

Hi ${data.businessName},

Welcome to AppLogix — your review system is now set up and ready to go.

Plan:
${data.planTier.toUpperCase()}

Business ID:
${data.businessId}

Review Page URL:
${data.reviewPageUrl || "(not required for this plan)"}
`;

  if (isDashboardPlan) {
    text += `
Dashboard:
https://final-widget.onrender.com/admin3

Email:
${data.clientEmail}

Temporary Password:
${data.tempPassword}
`;
  }

  text += `
---

Install your review widget

Copy and paste the code below into your website where you want reviews to appear:

${data.widgetCode}

---
`;

  if (isDashboardPlan) {
    text += `What happens next

- Log in to your dashboard
- Approve or reject reviews
- Manage review notifications
`;
  } else {
    text += `What happens next

- Reviews will publish automatically
- Your review link can be shared directly
- Upgrade anytime for moderation and dashboard controls
`;
  }

  text += `
If you need help with setup or installation, reply to this email.

— AppLogix`;

  return text;
}

async function getUserFromBearer(req) {
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const token = auth.replace("Bearer ", "").trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    throw new Error("Invalid auth token");
  }

  return data.user;
}

async function getAdminProfileByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select(`
      email,
      business_id,
      must_reset_password,
      notifications_enabled,
      notification_email,
      plan_tier,
      google_import_enabled,
      branding_enabled,
      review_page_url,
      brand_name,
      brand_primary,
      brand_secondary,
      brand_logo_url,
      active,
      setup_fee_paid,
      partner_name,
      partner_email
    `)
    .eq("email", email)
    .limit(1);

  if (error) throw error;
  if (!data || !data.length) throw new Error("Admin profile not found");

  return data[0];
}

app.get("/", (req, res) => {
  res.send("API running");
});

app.get("/admin", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/admin2", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "admin2.html"));
});

app.get("/admin3", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "admin3.html"));
});

app.get("/import", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "import.html"));
});

app.get("/onboard", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "onboard.html"));
});

app.get("/reset-password", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "reset-password.html"));
});

app.get("/test-123", (req, res) => {
  res.send("new code is live");
});

app.get("/client-config", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  });
});

app.get("/cloudinary-signature", (req, res) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "reviews";
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");

    res.json({
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      timestamp,
      folder,
      signature
    });
  } catch (err) {
    console.error("GET /cloudinary-signature error:", err);
    res.status(500).send("Signature error");
  }
});

app.post("/admin-me", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    const profile = await getAdminProfileByEmail(user.email);

    if (!PAID_DASHBOARD_PLANS.includes((profile.plan_tier || "").toLowerCase())) {
      return res.status(403).send("This plan does not include dashboard access.");
    }

    res.json({
      success: true,
      email: profile.email,
      businessId: profile.business_id,
      mustResetPassword: !!profile.must_reset_password,
      notificationsEnabled: !!profile.notifications_enabled,
      notificationEmail: profile.notification_email || "",
      planTier: profile.plan_tier || "",
      googleImportEnabled: !!profile.google_import_enabled,
      brandingEnabled: !!profile.branding_enabled,
      reviewPageUrl: profile.review_page_url || "",
      brandName: profile.brand_name || "",
      brandPrimary: profile.brand_primary || "",
      brandSecondary: profile.brand_secondary || "",
      brandLogoUrl: profile.brand_logo_url || ""
    });
  } catch (err) {
    console.error("POST /admin-me error:", err);
    res.status(401).send(err.message || "Unauthorized");
  }
});

app.post("/admin-mark-password-reset-complete", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    const profile = await getAdminProfileByEmail(user.email);

    if (!PAID_DASHBOARD_PLANS.includes((profile.plan_tier || "").toLowerCase())) {
      return res.status(403).send("This plan does not include dashboard access.");
    }

    const updatePayload = {
      must_reset_password: false,
      first_password_reset_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from("admin_users")
      .update(updatePayload)
      .eq("email", user.email);

    if (error) {
      console.error("POST /admin-mark-password-reset-complete error:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("POST /admin-mark-password-reset-complete server error:", err);
    res.status(401).send(err.message || "Unauthorized");
  }
});

app.post("/send-review-link", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    const profile = await getAdminProfileByEmail(user.email);

    if ((profile.plan_tier || "").toLowerCase() !== PLAN_PREMIUM) {
      return res.status(403).send("Only Premium users can send review invite emails.");
    }

    if (!profile.review_page_url) {
      return res.status(400).send("No review page URL is configured for this account.");
    }

    if (!resend || !RESEND_FROM) {
      return res.status(500).send("Email service is not configured.");
    }

    const reviewerEmail = (req.body.reviewerEmail || "").trim().toLowerCase();
    const reviewerName = (req.body.reviewerName || "").trim();
    const businessName = profile.brand_name || prettyBusinessName(profile.business_id);

    if (!reviewerEmail) {
      return res.status(400).send("Reviewer email is required.");
    }

    const greeting = reviewerName ? `Hi ${reviewerName},` : `Hi,`;

    await resend.emails.send({
      from: RESEND_FROM,
      to: [reviewerEmail],
      subject: `We’d love your feedback for ${businessName}`,
      html: `
        <div style="margin:0;padding:0;background:#f3f7ff;">
          <div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:Arial,sans-serif;color:#1f2937;">
            <div style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.10);border:1px solid #e5eefc;">
              <div style="height:58px;background:linear-gradient(90deg,#4ea3ff 0%,#2156d8 100%);"></div>

              <div style="padding:24px;">
                <div style="font-size:28px;font-weight:800;color:#1f2937;margin-bottom:6px;">${businessName}</div>
                <div style="font-size:14px;color:#64748b;margin-bottom:20px;">Review request</div>

                <div style="background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);border:1px solid #e4eefc;border-radius:20px;padding:20px;">
                  <p style="margin:0 0 14px;line-height:1.6;">${greeting}</p>

                  <p style="margin:0 0 14px;line-height:1.6;">
                    Thank you for your business. We’d really appreciate your feedback.
                  </p>

                  <a href="${profile.review_page_url}"
                     style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">
                    Leave a Review
                  </a>

                  <p style="margin-top:16px;font-size:13px;color:#64748b;">
                    Reviews are submitted by customers, may be screened for spam, and are not verified by AppLogix.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `
    });

    res.json({ success: true });
  } catch (err) {
    console.error("POST /send-review-link error:", err);
    res.status(500).send(err.message || "Failed to send review link.");
  }
});

app.post("/create-client", requireAdminToken, async (req, res) => {
  try {
    const businessName = (req.body.businessName || "").trim();
    const businessId = (req.body.businessId || "").trim();
    const clientEmail = (req.body.clientEmail || "").trim().toLowerCase();
    const tempPassword = (req.body.tempPassword || "").trim();
    const planTier = (req.body.planTier || "").trim().toLowerCase();
    const reviewPageUrl = (req.body.reviewPageUrl || "").trim();

    let notificationsEnabled = !!req.body.notificationsEnabled;
    let notificationEmail = (req.body.notificationEmail || clientEmail || "").trim().toLowerCase();
    let brandingEnabled = !!req.body.brandingEnabled;
    let googleImportEnabled = !!req.body.googleImportEnabled;

    const brandName = (req.body.brandName || businessName || "").trim();
    const brandPrimary = (req.body.brandPrimary || "#2563eb").trim();
    const brandSecondary = (req.body.brandSecondary || "#4ea3ff").trim();
    const brandLogoUrl = (req.body.brandLogoUrl || "").trim();

    const active = req.body.active !== false;
    const setupFeePaid = !!req.body.setupFeePaid;
    const partnerName = (req.body.partnerName || "").trim();
    const partnerEmail = (req.body.partnerEmail || "").trim().toLowerCase();

    if (!businessName) return res.status(400).send("Missing business name.");
    if (!businessId) return res.status(400).send("Missing business ID.");
    if (!clientEmail) return res.status(400).send("Missing client email.");
    if (!planTier || !VALID_PLANS.includes(planTier)) return res.status(400).send("Invalid plan tier.");

    if (planTier !== PLAN_FREE && !reviewPageUrl) {
      return res.status(400).send("Review page URL is required for Basic, Pro, and Premium plans.");
    }

    const isDashboardPlan = PAID_DASHBOARD_PLANS.includes(planTier);

    if (isDashboardPlan && !tempPassword) {
      return res.status(400).send("Temporary password is required for Pro and Premium plans.");
    }

    if (planTier === PLAN_FREE) {
      notificationsEnabled = false;
      notificationEmail = "";
      brandingEnabled = false;
      googleImportEnabled = false;
    }

    if (planTier === PLAN_BASIC) {
      notificationsEnabled = false;
      notificationEmail = "";
      brandingEnabled = false;
      googleImportEnabled = false;
    }

    if (planTier === PLAN_PRO) {
      notificationsEnabled = true;
      brandingEnabled = false;
      googleImportEnabled = false;
    }

    if (planTier === PLAN_PREMIUM) {
      notificationsEnabled = true;
      brandingEnabled = true;
      googleImportEnabled = true;
    }

    const { data: existingAdmins, error: existingAdminErr } = await supabaseAdmin
      .from("admin_users")
      .select("email,business_id")
      .or(`email.eq.${clientEmail},business_id.eq.${businessId}`);

    if (existingAdminErr) {
      console.error("Existing admin check error:", existingAdminErr);
      return res.status(500).send(existingAdminErr.message);
    }

    if (existingAdmins && existingAdmins.length) {
      return res.status(400).send("An admin row already exists with that email or business ID.");
    }

    let authData = null;

    if (isDashboardPlan) {
      const { data: existingAuthUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers();

      if (listErr) {
        console.error("Auth user list error:", listErr);
        return res.status(500).send(listErr.message);
      }

      const emailExists = (existingAuthUsers?.users || []).some(
        (u) => (u.email || "").toLowerCase() === clientEmail
      );

      if (emailExists) {
        return res.status(400).send("A Supabase auth user already exists with that email.");
      }

      const createAuthResult = await supabaseAdmin.auth.admin.createUser({
        email: clientEmail,
        password: tempPassword,
        email_confirm: true
      });

      if (createAuthResult.error) {
        console.error("Auth create user error:", createAuthResult.error);
        return res.status(500).send(createAuthResult.error.message);
      }

      authData = createAuthResult.data;
    }

    const rowPayload = {
      email: clientEmail,
      password: null,
      business_id: businessId,
      must_reset_password: isDashboardPlan,
      notifications_enabled: notificationsEnabled,
      notification_email: notificationEmail,
      plan_tier: planTier,
      branding_enabled: brandingEnabled,
      google_import_enabled: googleImportEnabled,
      brand_name: brandName,
      brand_primary: brandPrimary,
      brand_secondary: brandSecondary,
      brand_logo_url: brandLogoUrl,
      active: active,
      setup_fee_paid: setupFeePaid,
      first_password_reset_at: null,
      review_page_url: reviewPageUrl || null,
      partner_name: partnerName || null,
      partner_email: partnerEmail || null
    };

    const { error: insertErr } = await supabaseAdmin
      .from("admin_users")
      .insert([rowPayload]);

    if (insertErr) {
      console.error("Insert admin_users error:", insertErr);

      try {
        if (authData?.user?.id) {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        }
      } catch (rollbackErr) {
        console.error("Rollback auth user delete failed:", rollbackErr);
      }

      return res.status(500).send(insertErr.message);
    }

    const widgetCode = buildWidgetCode({
      businessName,
      businessId,
      brandName,
      brandPrimary,
      brandSecondary,
      brandLogoUrl,
      googleImportEnabled
    });

    const welcomeEmail = buildWelcomeEmailText({
      businessName,
      businessId,
      clientEmail,
      tempPassword,
      planTier,
      widgetCode,
      reviewPageUrl
    });

    res.json({
      success: true,
      businessName,
      businessId,
      clientEmail,
      tempPassword: isDashboardPlan ? tempPassword : "",
      planTier,
      notificationsEnabled,
      brandingEnabled,
      googleImportEnabled,
      reviewPageUrl: reviewPageUrl || "",
      widgetCode,
      welcomeEmail,
      dashboardIncluded: isDashboardPlan,
      dashboardUrl: isDashboardPlan ? "https://final-widget.onrender.com/admin3" : ""
    });
  } catch (err) {
    console.error("POST /create-client server error:", err);
    res.status(500).send(err.message || "Server error");
  }
});

app.get("/reviews", async (req, res) => {
  try {
    const businessId = (req.query.businessId || "").trim();

    let query = supabase
      .from("reviews")
      .select("*")
      .order("id", { ascending: false });

    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET /reviews error:", error);
      return res.status(500).send(error.message);
    }

    res.json(data || []);
  } catch (err) {
    console.error("GET /reviews server error:", err);
    res.status(500).send("Server error");
  }
});

app.post("/reviews", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const text = (req.body.text || "").trim();
    const image = req.body.image || null;
    const businessId = (req.body.businessId || "").trim();
    const parsedRating = parseInt(req.body.rating, 10);

    if (!businessId) {
      return res.status(400).send("Missing businessId");
    }

    if (!parsedRating || Number.isNaN(parsedRating)) {
      return res.status(400).send("Invalid rating");
    }

    const { data: admins, error: adminLookupErr } = await supabaseAdmin
      .from("admin_users")
      .select("business_id,plan_tier,notifications_enabled,notification_email")
      .eq("business_id", businessId)
      .limit(1);

    if (adminLookupErr) {
      console.error("Admin lookup error:", adminLookupErr);
      return res.status(500).send(adminLookupErr.message);
    }

    const admin = admins && admins.length ? admins[0] : null;
    const planTier = (admin?.plan_tier || PLAN_FREE).toLowerCase();
    const autoApprove = planTier === PLAN_FREE || planTier === PLAN_BASIC;

    const payload = {
      name: name || "Anonymous",
      text: text || "",
      rating: parsedRating,
      image: image,
      approved: autoApprove,
      business_id: businessId,
      source: "widget"
    };

    const { error } = await supabase
      .from("reviews")
      .insert([payload]);

    if (error) {
      console.error("POST /reviews error:", error);
      return res.status(500).send(error.message);
    }

    if (admin && admin.notifications_enabled && admin.notification_email && resend && RESEND_FROM) {
      try {
        const businessName = prettyBusinessName(businessId);

        await resend.emails.send({
          from: RESEND_FROM,
          to: [admin.notification_email],
          subject: autoApprove ? `New review for ${businessName}` : `New review awaiting approval for ${businessName}`,
          html: `
            <div style="margin:0;padding:0;background:#f3f7ff;">
              <div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:Arial,sans-serif;color:#1f2937;">
                <div style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.10);border:1px solid #e5eefc;">
                  <div style="height:58px;background:linear-gradient(90deg,#4ea3ff 0%,#2156d8 100%);"></div>

                  <div style="padding:24px;">
                    <div style="font-size:28px;font-weight:800;color:#1f2937;margin-bottom:6px;">AppLogix</div>
                    <div style="font-size:14px;color:#64748b;margin-bottom:20px;">New review notification</div>

                    <div style="background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);border:1px solid #e4eefc;border-radius:20px;padding:20px;">
                      <h2 style="margin:0 0 14px;font-size:24px;color:#1e3a8a;">New Review Submitted</h2>

                      <p style="margin:0 0 14px;line-height:1.6;">
                        A new review has been submitted for <strong>${businessName}</strong>.
                      </p>

                      <p style="margin:0 0 8px;"><strong>Business ID:</strong> ${businessId}</p>
                      <p style="margin:0 0 8px;"><strong>Name:</strong> ${payload.name}</p>
                      <p style="margin:0 0 8px;"><strong>Rating:</strong> ${payload.rating} / 5</p>
                      <p style="margin:0 0 8px;"><strong>Status:</strong> ${autoApprove ? "Published automatically" : "Pending approval"}</p>

                      <div style="margin-top:16px;margin-bottom:16px;padding:14px 16px;background:#f9fbff;border:1px solid #dbe7fb;border-radius:16px;">
                        <div style="font-size:14px;font-weight:700;color:#334155;margin-bottom:8px;">Review Message</div>
                        <div style="line-height:1.6;color:#334155;">${(payload.text || "(no text)").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                      </div>

                      ${!autoApprove ? `
                        <a href="https://final-widget.onrender.com/admin3"
                           style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">
                          Review & Approve
                        </a>
                      ` : ``}

                      <p style="margin-top:16px;font-size:13px;color:#64748b;">
                        Reviews are submitted by customers, may be screened for spam, and are not verified by AppLogix.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("Review notification email error:", emailErr);
      }
    }

    res.json({ success: true, approved: autoApprove });
  } catch (err) {
    console.error("POST /reviews server error:", err);
    res.status(500).send("Server error");
  }
});

app.post("/import-google-review", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    const profile = await getAdminProfileByEmail(user.email);

    if ((profile.plan_tier || "").toLowerCase() !== PLAN_PREMIUM) {
      return res.status(403).send("Google review import is Premium only.");
    }

    const name = (req.body.name || "").trim();
    const text = (req.body.text || "").trim();
    const image = (req.body.image || "").trim() || null;
    const businessId = (req.body.businessId || "").trim();
    const parsedRating = parseInt(req.body.rating, 10);

    if (!name) return res.status(400).send("Missing reviewer name");
    if (!text) return res.status(400).send("Missing review text");
    if (!businessId) return res.status(400).send("Missing businessId");
    if (!parsedRating || Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).send("Invalid rating");
    }

    if (businessId !== profile.business_id) {
      return res.status(403).send("Business mismatch.");
    }

    const payload = {
      name,
      text,
      rating: parsedRating,
      image,
      approved: true,
      business_id: businessId,
      source: "google"
    };

    const { error } = await supabaseAdmin
      .from("reviews")
      .insert([payload]);

    if (error) {
      console.error("POST /import-google-review error:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("POST /import-google-review server error:", err);
    res.status(401).send(err.message || "Unauthorized");
  }
});

app.put("/reviews/:id", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    const profile = await getAdminProfileByEmail(user.email);

    if (!PAID_DASHBOARD_PLANS.includes((profile.plan_tier || "").toLowerCase())) {
      return res.status(403).send("This plan does not include dashboard access.");
    }

    const { error } = await supabase
      .from("reviews")
      .update({ approved: !!req.body.approved })
      .eq("id", req.params.id)
      .eq("business_id", profile.business_id);

    if (error) {
      console.error("PUT /reviews/:id error:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("PUT /reviews/:id server error:", err);
    res.status(401).send(err.message || "Unauthorized");
  }
});

app.delete("/reviews/:id", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    const profile = await getAdminProfileByEmail(user.email);

    if (!PAID_DASHBOARD_PLANS.includes((profile.plan_tier || "").toLowerCase())) {
      return res.status(403).send("This plan does not include dashboard access.");
    }

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", req.params.id)
      .eq("business_id", profile.business_id);

    if (error) {
      console.error("DELETE /reviews/:id error:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /reviews/:id server error:", err);
    res.status(401).send(err.message || "Unauthorized");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

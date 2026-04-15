const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.static(path.join(__dirname, "public")));

const SUPABASE_URL = process.env.SUPABASE_URL || "REPLACE_ME";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "REPLACE_ME";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "REPLACE_ME";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "";
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || "https://final-widget.onrender.com";

const MARKETING_SITE_URL = process.env.MARKETING_SITE_URL || "https://applogix.org";
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "applogixinc@outlook.com";
const BRAND_LOGO_PUBLIC_URL = process.env.BRAND_LOGO_PUBLIC_URL || `${MARKETING_SITE_URL}/logo.png`;
const TERMS_URL = process.env.TERMS_URL || `${MARKETING_SITE_URL}/terms.html`;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const PLAN_FREE = "free";
const PLAN_BASIC = "basic";
const PLAN_PRO = "pro";
const PLAN_PREMIUM = "premium";
const VALID_PLANS = [PLAN_FREE, PLAN_BASIC, PLAN_PRO, PLAN_PREMIUM];
const PAID_DASHBOARD_PLANS = [PLAN_PRO, PLAN_PREMIUM];
const VALID_DELIVERY_TYPES = ["widget", "hosted", "both"];

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function includesWidget(deliveryType) {
  return deliveryType === "widget" || deliveryType === "both";
}

function includesHosted(deliveryType) {
  return deliveryType === "hosted" || deliveryType === "both";
}

function coerceMoney(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coerceInt(value, fallback = 1) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function computeNextInvoiceDate(billingDay, fromDate = new Date()) {
  const day = Math.max(1, Math.min(28, coerceInt(billingDay, 1)));
  const d = new Date(fromDate);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  let next = new Date(Date.UTC(year, month, day));
  if (next <= d) {
    next = new Date(Date.UTC(year, month + 1, day));
  }
  return next.toISOString().slice(0, 10);
}

function advanceInvoiceDate(dateString, billingDay) {
  const day = Math.max(1, Math.min(28, coerceInt(billingDay, 1)));
  const base = dateString ? new Date(`${dateString}T00:00:00Z`) : new Date();
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, day)).toISOString().slice(0, 10);
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const target = new Date(`${dateString}T00:00:00Z`);
  return Math.round((target - todayUtc) / 86400000);
}

function buildWidgetCode(payload) {
  return `<div id="applogix-review-widget"></div>

<script>
window.ARW_API = "${PUBLIC_APP_URL}";
window.BUSINESS_ID = "${payload.businessId}";
window.PLAN_TIER = "${payload.planTier || "free"}";

window.BRAND_NAME = "${payload.brandName || payload.businessName}";
window.BRAND_PRIMARY = "${payload.brandPrimary || "#2563eb"}";
window.BRAND_SECONDARY = "${payload.brandSecondary || "#4ea3ff"}";
window.BRAND_ACCENT_GOLD = "#ffd84d";

window.BRAND_LOGO_URL = "${payload.brandLogoUrl || ""}";
window.SHOW_POWERED_BY = true;
window.POWERED_BY_NAME = "AppLogix";
window.GOOGLE_IMPORT_ENABLED = ${payload.googleImportEnabled ? "true" : "false"};
</script>

<script src="${PUBLIC_APP_URL}/widget.js" defer></script>`;
}

function buildWelcomeEmailText(data) {
  const isDashboardPlan = PAID_DASHBOARD_PLANS.includes(data.planTier);
  const widgetEnabled = includesWidget(data.deliveryType);
  const hostedEnabled = includesHosted(data.deliveryType);

  let text = `Subject: Welcome to AppLogix — Your Review System is Ready

Hi ${data.businessName},

Welcome to AppLogix — your review system is now set up and ready to go.

Plan:
${data.planTier.toUpperCase()}

Delivery Type:
${data.deliveryType.toUpperCase()}

Business ID:
${data.businessId}
`;

  if (widgetEnabled) {
    text += `
Website Review Page URL:
${data.reviewPageUrl || "(not provided)"}
`;
  }

  if (hostedEnabled) {
    text += `
Hosted Review Page:
${PUBLIC_APP_URL}/r/${data.businessId}
`;
  }

  if (isDashboardPlan) {
    text += `
Dashboard:
${PUBLIC_APP_URL}/admin3

Email:
${data.clientEmail}

Temporary Password:
${data.tempPassword}
`;
  }

  text += `

---
`;

  if (widgetEnabled) {
    text += `
Install your review widget

Copy and paste the code below into your website where you want reviews to appear:

${data.widgetCode}

---
`;
  }

  if (isDashboardPlan) {
    text += `What happens next

- Log in to your dashboard
- Approve or reject reviews
- Manage review notifications
- Use review links, QR codes, and hosted page tools where enabled
`;
  } else {
    text += `What happens next

- Reviews will publish automatically on Free and Basic
- Your selected delivery format is ready
- Upgrade anytime for moderation and dashboard controls
`;
  }

  text += `

Support
Website: ${MARKETING_SITE_URL}
Contact: ${CONTACT_EMAIL}
Terms: ${TERMS_URL}

If you need help with setup or installation, reply to this email.

— AppLogix`;

  return text;
}

function buildWelcomeEmailHtml(data) {
  const isDashboardPlan = PAID_DASHBOARD_PLANS.includes(data.planTier);
  const widgetEnabled = includesWidget(data.deliveryType);
  const hostedEnabled = includesHosted(data.deliveryType);

  return `
    <div style="font-family:Arial,sans-serif;padding:24px;background:#eef5ff;">
      <div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #dbe7fb;border-radius:20px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#4ea3ff,#2563eb);padding:20px;text-align:center;">
          <img src="${BRAND_LOGO_PUBLIC_URL}" alt="AppLogix" style="max-height:64px;max-width:220px;background:#ffffff;border-radius:12px;padding:8px;">
        </div>

        <div style="padding:28px;">
          <h2 style="margin-top:0;color:#1e3a8a;">Welcome to AppLogix</h2>
          <p style="color:#334155;">Hi ${escapeHtml(data.businessName)},</p>
          <p style="color:#334155;">Your review system is now set up and ready to go.</p>

          <table style="width:100%;border-collapse:collapse;margin:18px 0;">
            <tr>
              <td style="padding:8px 0;color:#64748b;"><strong>Plan</strong></td>
              <td style="padding:8px 0;color:#0f172a;">${escapeHtml(data.planTier.toUpperCase())}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;"><strong>Delivery</strong></td>
              <td style="padding:8px 0;color:#0f172a;">${escapeHtml(data.deliveryType.toUpperCase())}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;"><strong>Business ID</strong></td>
              <td style="padding:8px 0;color:#0f172a;">${escapeHtml(data.businessId)}</td>
            </tr>
          </table>

          ${widgetEnabled ? `
            <div style="margin:18px 0;padding:16px;border:1px solid #dbe7fb;border-radius:14px;background:#f8fbff;">
              <div style="font-weight:700;color:#1e3a8a;margin-bottom:8px;">Website Review Page URL</div>
              <div style="word-break:break-all;color:#334155;">${escapeHtml(data.reviewPageUrl || "")}</div>
            </div>
          ` : ""}

          ${hostedEnabled ? `
            <div style="margin:18px 0;padding:16px;border:1px solid #dbe7fb;border-radius:14px;background:#f8fbff;">
              <div style="font-weight:700;color:#1e3a8a;margin-bottom:8px;">Hosted Review Page</div>
              <div style="word-break:break-all;color:#334155;">${escapeHtml(`${PUBLIC_APP_URL}/r/${data.businessId}`)}</div>
            </div>
          ` : ""}

          ${isDashboardPlan ? `
            <div style="margin:18px 0;padding:16px;border:1px solid #dbe7fb;border-radius:14px;background:#f8fbff;">
              <div style="font-weight:700;color:#1e3a8a;margin-bottom:8px;">Dashboard Access</div>
              <div style="color:#334155;"><strong>URL:</strong> ${escapeHtml(`${PUBLIC_APP_URL}/admin3`)}</div>
              <div style="color:#334155;"><strong>Email:</strong> ${escapeHtml(data.clientEmail)}</div>
              <div style="color:#334155;"><strong>Temporary Password:</strong> ${escapeHtml(data.tempPassword)}</div>
            </div>
          ` : ""}

          ${widgetEnabled ? `
            <div style="margin:18px 0;">
              <div style="font-weight:700;color:#1e3a8a;margin-bottom:8px;">Widget Install Code</div>
              <pre style="white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#f8fafc;padding:16px;border-radius:14px;font-size:12px;line-height:1.5;">${escapeHtml(data.widgetCode)}</pre>
            </div>
          ` : ""}

          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e5e7eb;color:#64748b;font-size:14px;">
            <div>Website: <a href="${MARKETING_SITE_URL}" style="color:#2563eb;text-decoration:none;">${MARKETING_SITE_URL}</a></div>
            <div>Contact: <a href="mailto:${CONTACT_EMAIL}" style="color:#2563eb;text-decoration:none;">${CONTACT_EMAIL}</a></div>
            <div>Terms: <a href="${TERMS_URL}" style="color:#2563eb;text-decoration:none;">${TERMS_URL}</a></div>
          </div>
        </div>
      </div>
    </div>
  `;
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
      partner_email,
      delivery_type,
      hosted_header,
      hosted_footer,
      base_monthly_price,
      hosted_addon_price,
      total_monthly_price,
      setup_fee_amount,
      billing_day,
      next_invoice_date,
      last_payment_date,
      billing_status,
      partner_commission_percent,
      terms_accepted,
      terms_accepted_at
    `)
    .eq("email", email)
    .limit(1);

  if (error) throw error;
  if (!data || !data.length) throw new Error("Admin profile not found");

  return data[0];
}

async function getBusinessProfile(businessId) {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select(`
      business_id,
      plan_tier,
      active,
      brand_name,
      brand_primary,
      brand_secondary,
      brand_logo_url,
      branding_enabled,
      review_page_url,
      notifications_enabled,
      notification_email,
      google_import_enabled,
      delivery_type,
      hosted_header,
      hosted_footer,
      base_monthly_price,
      hosted_addon_price,
      total_monthly_price,
      setup_fee_amount,
      billing_day,
      next_invoice_date,
      last_payment_date,
      billing_status,
      partner_name,
      partner_email,
      partner_commission_percent
    `)
    .eq("business_id", businessId)
    .limit(1);

  if (error) throw error;
  if (!data || !data.length) return null;

  return data[0];
}

function planAllowsImages(planTier) {
  return [PLAN_BASIC, PLAN_PRO, PLAN_PREMIUM].includes((planTier || "").toLowerCase());
}

function planRequiresModeration(planTier) {
  return [PLAN_PRO, PLAN_PREMIUM].includes((planTier || "").toLowerCase());
}

// ------------------------------
// Basic pages
// ------------------------------
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

app.get("/hosted-review.html", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "hosted-review.html"));
});

app.get("/r/:businessId", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "hosted-review.html"));
});

app.get("/client-config", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  });
});

// ------------------------------
// Cloudinary signature route
// ------------------------------
app.get("/cloudinary-signature", (req, res) => {
  try {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return res.status(500).send("Cloudinary is not configured.");
    }

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

// ------------------------------
// Simple upload route
// ------------------------------
app.post("/upload", async (req, res) => {
  try {
    const { image } = req.body || {};

    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "Missing image." });
    }

    return res.json({ url: image });
  } catch (err) {
    console.error("POST /upload error:", err);
    return res.status(500).json({ error: "Upload failed." });
  }
});

// ------------------------------
// Admin auth helpers
// ------------------------------
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
      businessName: profile.brand_name || prettyBusinessName(profile.business_id),
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
      brandLogoUrl: profile.brand_logo_url || "",
      deliveryType: profile.delivery_type || "widget",
      hostedHeader: profile.hosted_header || "",
      hostedFooter: profile.hosted_footer || "",
      baseMonthlyPrice: coerceMoney(profile.base_monthly_price, 0),
      hostedAddonPrice: coerceMoney(profile.hosted_addon_price, 0),
      totalMonthlyPrice: coerceMoney(profile.total_monthly_price, 0),
      setupFeeAmount: coerceMoney(profile.setup_fee_amount, 0),
      billingDay: coerceInt(profile.billing_day, 1),
      nextInvoiceDate: profile.next_invoice_date || "",
      lastPaymentDate: profile.last_payment_date || "",
      billingStatus: profile.billing_status || "active",
      partnerName: profile.partner_name || "",
      partnerEmail: profile.partner_email || "",
      partnerCommissionPercent: coerceMoney(profile.partner_commission_percent, 25)
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

    const { error } = await supabaseAdmin
      .from("admin_users")
      .update({
        must_reset_password: false,
        first_password_reset_at: new Date().toISOString()
      })
      .eq("email", user.email);

    if (error) return res.status(500).send(error.message);

    res.json({ success: true });
  } catch (err) {
    console.error("POST /admin-mark-password-reset-complete error:", err);
    res.status(401).send(err.message || "Unauthorized");
  }
});

// ------------------------------
// Send review link (Premium)
// Uses hosted page if enabled, otherwise widget page URL
// ------------------------------
app.post("/send-review-link", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    const profile = await getAdminProfileByEmail(user.email);

    if ((profile.plan_tier || "").toLowerCase() !== PLAN_PREMIUM) {
      return res.status(403).send("Only Premium users can send review invite emails.");
    }

    if (!resend || !RESEND_FROM) {
      return res.status(500).send("Email service is not configured.");
    }

    const deliveryType = profile.delivery_type || "widget";
    const reviewLink = includesHosted(deliveryType)
      ? `${PUBLIC_APP_URL}/r/${profile.business_id}`
      : (profile.review_page_url || "");

    if (!reviewLink) {
      return res.status(400).send("No valid review link is configured for this account.");
    }

    const reviewerEmail = (req.body.reviewerEmail || "").trim().toLowerCase();
    const reviewerName = (req.body.reviewerName || "").trim();
    const businessName = profile.brand_name || prettyBusinessName(profile.business_id);

    if (!reviewerEmail) {
      return res.status(400).send("Reviewer email is required.");
    }

    const greeting = reviewerName ? `Hi ${escapeHtml(reviewerName)},` : "Hi,";

    await resend.emails.send({
      from: RESEND_FROM,
      to: [reviewerEmail],
      subject: `We’d love your feedback for ${businessName}`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;background:#eef5ff;">
          <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:20px;padding:24px;border:1px solid #e5eefc;">
            <img src="${BRAND_LOGO_PUBLIC_URL}" alt="AppLogix" style="max-height:60px;max-width:220px;background:#ffffff;border-radius:12px;padding:8px;">
            <h2 style="margin-top:18px;color:#1e3a8a;">${escapeHtml(businessName)}</h2>
            <p>${greeting}</p>
            <p>Thank you for your business. We’d really appreciate your feedback.</p>
            <p><a href="${reviewLink}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;">Leave a Review</a></p>
            <p style="font-size:13px;color:#64748b;">Questions? ${escapeHtml(CONTACT_EMAIL)} · ${escapeHtml(MARKETING_SITE_URL)}</p>
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

// ------------------------------
// Contact form
// ------------------------------
app.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (!resend || !RESEND_FROM) {
      return res.status(500).json({ error: "Email service is not configured." });
    }

    await resend.emails.send({
      from: RESEND_FROM,
      to: CONTACT_EMAIL,
      subject: `New AppLogix Contact Form Message from ${name}`,
      reply_to: email,
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;background:#f4f8ff;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe7fb;border-radius:16px;padding:24px;">
            <h2 style="margin-top:0;color:#1e3a8a;">New Contact Form Message</h2>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Message:</strong></p>
            <div style="white-space:pre-wrap;color:#334155;">${escapeHtml(message)}</div>
          </div>
        </div>
      `
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("POST /contact error:", err);
    return res.status(500).json({ error: err.message || "Failed to send message." });
  }
});

// ------------------------------
// Onboarding create client
// ------------------------------
app.post("/create-client", requireAdminToken, async (req, res) => {
  try {
    const businessName = (req.body.businessName || "").trim();
    const businessId = (req.body.businessId || "").trim();
    const clientEmail = (req.body.clientEmail || "").trim().toLowerCase();
    const tempPassword = (req.body.tempPassword || "").trim();
    const planTier = (req.body.planTier || "").trim().toLowerCase();
    const reviewPageUrl = (req.body.reviewPageUrl || "").trim();
    const deliveryType = (req.body.deliveryType || "widget").trim().toLowerCase();

    let notificationsEnabled = !!req.body.notificationsEnabled;
    let notificationEmail = (req.body.notificationEmail || clientEmail || "").trim().toLowerCase();
    let brandingEnabled = !!req.body.brandingEnabled;
    let googleImportEnabled = !!req.body.googleImportEnabled;

    const hostedHeader = (req.body.hostedHeader || "").trim();
    const hostedFooter = (req.body.hostedFooter || "").trim();

    const brandName = (req.body.brandName || businessName || "").trim();
    const brandPrimary = (req.body.brandPrimary || "#2563eb").trim();
    const brandSecondary = (req.body.brandSecondary || "#4ea3ff").trim();
    const brandLogoUrl = (req.body.brandLogoUrl || "").trim();

    const active = req.body.active !== false;
    const setupFeePaid = !!req.body.setupFeePaid;
    const partnerName = (req.body.partnerName || "").trim();
    const partnerEmail = (req.body.partnerEmail || "").trim().toLowerCase();

    const baseMonthlyPrice = coerceMoney(req.body.baseMonthlyPrice, 0);
    const hostedAddonPrice = coerceMoney(req.body.hostedAddonPrice, 0);
    const totalMonthlyPrice = coerceMoney(req.body.totalMonthlyPrice, 0);
    const setupFeeAmount = coerceMoney(req.body.setupFeeAmount, 0);
    const billingDay = Math.max(1, Math.min(28, coerceInt(req.body.billingDay, 1)));
    const nextInvoiceDate = (req.body.nextInvoiceDate || computeNextInvoiceDate(billingDay)).trim();
    const lastPaymentDate = (req.body.lastPaymentDate || "").trim() || null;
    const billingStatus = (req.body.billingStatus || "active").trim().toLowerCase();
    const partnerCommissionPercent = coerceMoney(req.body.partnerCommissionPercent, 25);
    const termsAccepted = !!req.body.termsAccepted;

    if (!businessName) return res.status(400).send("Missing business name.");
    if (!businessId) return res.status(400).send("Missing business ID.");
    if (!clientEmail) return res.status(400).send("Missing client email.");
    if (!planTier || !VALID_PLANS.includes(planTier)) return res.status(400).send("Invalid plan tier.");
    if (!VALID_DELIVERY_TYPES.includes(deliveryType)) return res.status(400).send("Invalid delivery type.");
    if (!termsAccepted) return res.status(400).send("Terms and conditions must be accepted during onboarding.");

    if (includesWidget(deliveryType) && !reviewPageUrl) {
      return res.status(400).send("Website Review Page URL is required when widget delivery is selected.");
    }

    const isDashboardPlan = PAID_DASHBOARD_PLANS.includes(planTier);
    if (isDashboardPlan && !tempPassword) {
      return res.status(400).send("Temporary password is required for Pro and Premium plans.");
    }

    if (planTier === PLAN_FREE || planTier === PLAN_BASIC) {
      notificationsEnabled = false;
      notificationEmail = "";
      brandingEnabled = false;
      googleImportEnabled = false;
    }

    if (planTier === PLAN_PRO) {
      notificationsEnabled = true;
      brandingEnabled = false;
      googleImportEnabled = false;
      if (!notificationEmail) notificationEmail = clientEmail;
    }

    if (planTier === PLAN_PREMIUM) {
      notificationsEnabled = true;
      brandingEnabled = true;
      if (!notificationEmail) notificationEmail = clientEmail;
    }

    const { data: existingAdmins, error: existingAdminErr } = await supabaseAdmin
      .from("admin_users")
      .select("email,business_id")
      .or(`email.eq.${clientEmail},business_id.eq.${businessId}`);

    if (existingAdminErr) return res.status(500).send(existingAdminErr.message);
    if (existingAdmins && existingAdmins.length) {
      return res.status(400).send("An admin row already exists with that email or business ID.");
    }

    let authData = null;

    if (isDashboardPlan) {
      const { data: existingAuthUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) return res.status(500).send(listErr.message);

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
        return res.status(500).send(createAuthResult.error.message);
      }

      authData = createAuthResult.data;
    }

    const rowPayload = {
      email: clientEmail,
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
      review_page_url: includesWidget(deliveryType) ? (reviewPageUrl || null) : null,
      partner_name: partnerName || null,
      partner_email: partnerEmail || null,
      delivery_type: deliveryType,
      hosted_header: includesHosted(deliveryType) ? (hostedHeader || null) : null,
      hosted_footer: includesHosted(deliveryType) ? (hostedFooter || null) : null,
      base_monthly_price: baseMonthlyPrice,
      hosted_addon_price: hostedAddonPrice,
      total_monthly_price: totalMonthlyPrice,
      setup_fee_amount: setupFeeAmount,
      billing_day: billingDay,
      next_invoice_date: nextInvoiceDate || null,
      last_payment_date: lastPaymentDate,
      billing_status: billingStatus || "active",
      partner_commission_percent: partnerCommissionPercent,
      terms_accepted: termsAccepted,
      terms_accepted_at: new Date().toISOString()
    };

    const { error: insertErr } = await supabaseAdmin.from("admin_users").insert([rowPayload]);

    if (insertErr) {
      if (authData?.user?.id) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (_) {}
      }
      return res.status(500).send(insertErr.message);
    }

    const widgetCode = includesWidget(deliveryType)
      ? buildWidgetCode({
          businessName,
          businessId,
          planTier,
          brandName,
          brandPrimary,
          brandSecondary,
          brandLogoUrl,
          googleImportEnabled
        })
      : "";

    const hostedPageUrl = includesHosted(deliveryType)
      ? `${PUBLIC_APP_URL}/r/${businessId}`
      : "";

    const welcomeEmailText = buildWelcomeEmailText({
      businessName,
      businessId,
      clientEmail,
      tempPassword,
      planTier,
      deliveryType,
      widgetCode,
      reviewPageUrl
    });

    const welcomeEmailHtml = buildWelcomeEmailHtml({
      businessName,
      businessId,
      clientEmail,
      tempPassword,
      planTier,
      deliveryType,
      widgetCode,
      reviewPageUrl
    });

    if (resend && RESEND_FROM && planTier !== PLAN_PREMIUM) {
      try {
        await resend.emails.send({
          from: RESEND_FROM,
          to: [clientEmail],
          subject: "Welcome to AppLogix — Your Review System is Ready",
          text: welcomeEmailText,
          html: welcomeEmailHtml
        });
      } catch (emailErr) {
        console.error("Onboarding email send error:", emailErr);
      }
    }

    res.json({
      success: true,
      businessName,
      businessId,
      clientEmail,
      tempPassword: isDashboardPlan ? tempPassword : "",
      planTier,
      deliveryType,
      notificationsEnabled,
      brandingEnabled,
      googleImportEnabled,
      reviewPageUrl: includesWidget(deliveryType) ? (reviewPageUrl || "") : "",
      hostedPageUrl,
      widgetCode,
      welcomeEmail: welcomeEmailText,
      hostedHeader: includesHosted(deliveryType) ? hostedHeader : "",
      hostedFooter: includesHosted(deliveryType) ? hostedFooter : "",
      dashboardIncluded: isDashboardPlan,
      dashboardUrl: isDashboardPlan ? `${PUBLIC_APP_URL}/admin3` : "",
      baseMonthlyPrice,
      hostedAddonPrice,
      totalMonthlyPrice,
      setupFeeAmount,
      billingDay,
      nextInvoiceDate,
      lastPaymentDate,
      billingStatus,
      partnerName,
      partnerEmail,
      partnerCommissionPercent
    });
  } catch (err) {
    console.error("POST /create-client server error:", err);
    res.status(500).send(err.message || "Server error");
  }
});

// ------------------------------
// Internal billing + partner tracking
// ------------------------------
app.get("/ops-clients", requireAdminToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select(`
        business_id,
        email,
        plan_tier,
        delivery_type,
        brand_name,
        active,
        base_monthly_price,
        hosted_addon_price,
        total_monthly_price,
        setup_fee_amount,
        billing_day,
        next_invoice_date,
        last_payment_date,
        billing_status,
        partner_name,
        partner_email,
        partner_commission_percent
      `)
      .order("business_id", { ascending: true });

    if (error) return res.status(500).send(error.message);

    const rows = (data || []).map((row) => {
      const totalMonthlyPrice = coerceMoney(row.total_monthly_price, 0);
      const partnerCommissionPercent = coerceMoney(row.partner_commission_percent, 25);

      return {
        businessId: row.business_id,
        businessName: row.brand_name || prettyBusinessName(row.business_id),
        email: row.email || "",
        planTier: row.plan_tier || "",
        deliveryType: row.delivery_type || "widget",
        active: row.active !== false,
        baseMonthlyPrice: coerceMoney(row.base_monthly_price, 0),
        hostedAddonPrice: coerceMoney(row.hosted_addon_price, 0),
        totalMonthlyPrice,
        setupFeeAmount: coerceMoney(row.setup_fee_amount, 0),
        billingDay: coerceInt(row.billing_day, 1),
        nextInvoiceDate: row.next_invoice_date || "",
        lastPaymentDate: row.last_payment_date || "",
        billingStatus: row.billing_status || "active",
        partnerName: row.partner_name || "",
        partnerEmail: row.partner_email || "",
        partnerCommissionPercent,
        partnerMonthlyCommission: Number((totalMonthlyPrice * partnerCommissionPercent / 100).toFixed(2)),
        daysUntilInvoice: daysUntil(row.next_invoice_date)
      };
    });

    res.json(rows);
  } catch (err) {
    console.error("GET /ops-clients error:", err);
    res.status(500).send("Server error");
  }
});

app.post("/ops-record-payment/:businessId", requireAdminToken, async (req, res) => {
  try {
    const businessId = (req.params.businessId || "").trim();
    const paidDate = (req.body.paidDate || new Date().toISOString().slice(0, 10)).trim();

    const profile = await getBusinessProfile(businessId);
    if (!profile) return res.status(404).send("Client not found.");

    const nextInvoiceDate = advanceInvoiceDate(profile.next_invoice_date || paidDate, profile.billing_day || 1);

    const { error } = await supabaseAdmin
      .from("admin_users")
      .update({
        last_payment_date: paidDate,
        next_invoice_date: nextInvoiceDate,
        billing_status: "paid"
      })
      .eq("business_id", businessId);

    if (error) return res.status(500).send(error.message);
    res.json({ success: true, nextInvoiceDate });
  } catch (err) {
    console.error("POST /ops-record-payment/:businessId error:", err);
    res.status(500).send("Server error");
  }
});

app.post("/ops-send-billing-reminders", requireAdminToken, async (req, res) => {
  try {
    if (!resend || !RESEND_FROM) {
      return res.status(500).send("Email service is not configured.");
    }

    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("business_id,email,brand_name,next_invoice_date,billing_status,total_monthly_price")
      .eq("active", true);

    if (error) return res.status(500).send(error.message);

    let sent = 0;

    for (const row of data || []) {
      if (!row.email || !row.next_invoice_date) continue;

      const dueIn = daysUntil(row.next_invoice_date);
      const shouldSend = dueIn === 3 || dueIn === 0 || (dueIn !== null && dueIn < 0 && row.billing_status !== "paid");

      if (!shouldSend) continue;

      const businessName = row.brand_name || prettyBusinessName(row.business_id);
      const subject =
        dueIn === 3
          ? `Upcoming AppLogix invoice for ${businessName}`
          : dueIn === 0
            ? `AppLogix invoice due today for ${businessName}`
            : `AppLogix payment reminder for ${businessName}`;

      await resend.emails.send({
        from: RESEND_FROM,
        to: [row.email],
        subject,
        html: `
          <div style="font-family:Arial,sans-serif;padding:24px;background:#eef5ff;">
            <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #dbe7fb;border-radius:18px;padding:24px;">
              <img src="${BRAND_LOGO_PUBLIC_URL}" alt="AppLogix" style="max-height:60px;max-width:220px;background:#ffffff;border-radius:12px;padding:8px;">
              <h2 style="color:#1e3a8a;">Billing Reminder</h2>
              <p>Hi ${escapeHtml(businessName)},</p>
              <p>This is a reminder about your AppLogix billing.</p>
              <p><strong>Next Billing Date:</strong> ${escapeHtml(row.next_invoice_date)}</p>
              <p><strong>Monthly Total:</strong> $${coerceMoney(row.total_monthly_price, 0).toFixed(2)}</p>
              <p>If you have any questions, contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
              <p style="color:#64748b;">${MARKETING_SITE_URL}</p>
            </div>
          </div>
        `
      });

      sent += 1;
    }

    res.json({ success: true, sent });
  } catch (err) {
    console.error("POST /ops-send-billing-reminders error:", err);
    res.status(500).send(err.message || "Server error");
  }
});

app.get("/ops-partner-payout-report", requireAdminToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("business_id,brand_name,total_monthly_price,partner_name,partner_email,partner_commission_percent,active,billing_status")
      .eq("active", true);

    if (error) return res.status(500).send(error.message);

    const grouped = {};

    for (const row of data || []) {
      if (!row.partner_name && !row.partner_email) continue;

      const key = `${row.partner_name || ""}|${row.partner_email || ""}`;

      if (!grouped[key]) {
        grouped[key] = {
          partnerName: row.partner_name || "",
          partnerEmail: row.partner_email || "",
          totalMonthlyPayout: 0,
          clients: []
        };
      }

      const monthly = coerceMoney(row.total_monthly_price, 0);
      const pct = coerceMoney(row.partner_commission_percent, 25);
      const payout = Number((monthly * pct / 100).toFixed(2));

      grouped[key].clients.push({
        businessId: row.business_id,
        businessName: row.brand_name || prettyBusinessName(row.business_id),
        totalMonthlyPrice: monthly,
        commissionPercent: pct,
        monthlyPayout: payout,
        billingStatus: row.billing_status || "active"
      });

      grouped[key].totalMonthlyPayout = Number((grouped[key].totalMonthlyPayout + payout).toFixed(2));
    }

    res.json(Object.values(grouped));
  } catch (err) {
    console.error("GET /ops-partner-payout-report error:", err);
    res.status(500).send("Server error");
  }
});

// ------------------------------
// /reviews
// Admin dashboard uses this and must see pending reviews.
// ------------------------------
app.get("/reviews", async (req, res) => {
  try {
    const businessId = (req.query.businessId || "").trim();
    const rawLimit = parseInt(req.query.limit, 10);
    const rawOffset = parseInt(req.query.offset, 10);
    const rawRating = parseInt(req.query.rating, 10);
    const withImages = String(req.query.withImages || "").toLowerCase() === "true";

    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 100;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

    let query = supabaseAdmin
      .from("reviews")
      .select("id,name,text,rating,image,approved,business_id,created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    if (Number.isFinite(rawRating) && rawRating >= 1 && rawRating <= 5) {
      query = query.eq("rating", rawRating);
    }

    if (withImages) {
      query = query.not("image", "is", null).neq("image", "");
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET /reviews supabase error:", error);
      return res.status(500).send(error.message);
    }

    res.json(data || []);
  } catch (err) {
    console.error("GET /reviews error:", err);
    res.status(500).send("Server error");
  }
});

// ------------------------------
// Existing widget review submission
// ------------------------------
app.post("/reviews", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const text = (req.body.text || "").trim();
    const image = req.body.image || null;
    const businessId = (req.body.businessId || "").trim();
    const parsedRating = parseInt(req.body.rating, 10);

    if (!businessId) return res.status(400).send("Missing businessId");
    if (!parsedRating || Number.isNaN(parsedRating)) return res.status(400).send("Invalid rating");

    const profile = await getBusinessProfile(businessId);
    if (!profile || profile.active === false) {
      return res.status(404).send("Business not found.");
    }

    if (!includesWidget(profile.delivery_type || "widget")) {
      return res.status(403).send("Widget delivery is not enabled for this client.");
    }

    const planTier = (profile.plan_tier || PLAN_FREE).toLowerCase();
    const autoApprove = !planRequiresModeration(planTier);
    const finalImage = planAllowsImages(planTier) ? image : null;

    const payload = {
      name: name || "Anonymous",
      text: text || "",
      rating: parsedRating,
      image: finalImage,
      approved: autoApprove,
      business_id: businessId,
      source: "widget"
    };

    const { error } = await supabaseAdmin.from("reviews").insert([payload]);
    if (error) return res.status(500).send(error.message);

    if (profile.notifications_enabled && profile.notification_email && resend && RESEND_FROM) {
      try {
        const businessName = profile.brand_name || prettyBusinessName(businessId);

        await resend.emails.send({
          from: RESEND_FROM,
          to: [profile.notification_email],
          subject: autoApprove
            ? `New review for ${businessName}`
            : `New review awaiting approval for ${businessName}`,
          html: `
            <div style="font-family:Arial,sans-serif;padding:24px;background:#f3f7ff;">
              <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:20px;padding:24px;border:1px solid #e5eefc;">
                <h2 style="margin-top:0;">New Review Submitted</h2>
                <p><strong>Business:</strong> ${escapeHtml(businessName)}</p>
                <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
                <p><strong>Rating:</strong> ${payload.rating} / 5</p>
                <p><strong>Status:</strong> ${autoApprove ? "Published automatically" : "Pending approval"}</p>
                <p>${escapeHtml(payload.text || "(no text)")}</p>
                ${!autoApprove ? `<p><a href="${PUBLIC_APP_URL}/admin3">Review & Approve</a></p>` : ""}
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
    console.error("POST /reviews error:", err);
    res.status(500).send("Server error");
  }
});

// ------------------------------
// Hosted page business info
// Hosted only if delivery_type includes hosted
// ------------------------------
app.get("/api/business/:businessId", async (req, res) => {
  try {
    const businessId = (req.params.businessId || "").trim();
    if (!businessId) {
      return res.status(400).json({ error: "Missing businessId." });
    }

    const profile = await getBusinessProfile(businessId);

    if (!profile || profile.active === false) {
      return res.status(404).json({ error: "Business not found." });
    }

    const deliveryType = profile.delivery_type || "widget";
    if (!includesHosted(deliveryType)) {
      return res.status(404).json({ error: "Hosted page is not enabled for this client." });
    }

    const planTier = (profile.plan_tier || PLAN_FREE).toLowerCase();

    res.json({
      businessId,
      name: profile.brand_name || prettyBusinessName(businessId),
      subtitle: profile.hosted_header || "Share your experience below. Reviews help businesses build trust and improve customer experience.",
      footer: profile.hosted_footer || "Powered by AppLogix",
      logo: profile.branding_enabled ? (profile.brand_logo_url || "") : "",
      planTier,
      brandingEnabled: !!profile.branding_enabled,
      reviewPageUrl: profile.review_page_url || "",
      brandPrimary: profile.brand_primary || "#2563eb",
      brandSecondary: profile.brand_secondary || "#4ea3ff",
      googleImportEnabled: !!profile.google_import_enabled,
      deliveryType
    });
  } catch (err) {
    console.error("GET /api/business/:businessId error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// ------------------------------
// Hosted page public reviews
// APPROVED ONLY
// ------------------------------
app.get("/api/reviews/:businessId", async (req, res) => {
  try {
    const businessId = (req.params.businessId || "").trim();
    if (!businessId) {
      return res.status(400).json({ error: "Missing businessId." });
    }

    const profile = await getBusinessProfile(businessId);
    if (!profile || profile.active === false) {
      return res.status(404).json({ error: "Business not found." });
    }

    const deliveryType = profile.delivery_type || "widget";
    if (!includesHosted(deliveryType)) {
      return res.status(404).json({ error: "Hosted page is not enabled for this client." });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const filter = String(req.query.filter || "all").toLowerCase();

    let query = supabaseAdmin
      .from("reviews")
      .select("id,name,text,rating,image,created_at", { count: "exact" })
      .eq("business_id", businessId)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (["1", "2", "3", "4", "5"].includes(filter)) {
      query = query.eq("rating", parseInt(filter, 10));
    }

    if (filter === "images") {
      query = query.not("image", "is", null).neq("image", "");
    }

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const { data: summaryRows, error: summaryErr } = await supabaseAdmin
      .from("reviews")
      .select("rating")
      .eq("business_id", businessId)
      .eq("approved", true);

    if (summaryErr) return res.status(500).json({ error: summaryErr.message });

    const ratings = summaryRows || [];
    const reviewCount = ratings.length;
    const average = reviewCount
      ? ratings.reduce((sum, row) => sum + (row.rating || 0), 0) / reviewCount
      : 0;

    const reviews = (data || []).map((r) => ({
      id: r.id,
      name: r.name || "Anonymous",
      text: r.text || "",
      rating: r.rating || 0,
      image: r.image || "",
      createdAt: r.created_at || null
    }));

    res.json({
      reviews,
      summary: {
        average,
        count: reviewCount
      },
      hasMore: (count || 0) > to + 1
    });
  } catch (err) {
    console.error("GET /api/reviews/:businessId error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// ------------------------------
// Hosted page review submission
// ------------------------------
app.post("/api/review", async (req, res) => {
  try {
    const businessId = (req.body.businessId || "").trim();
    const name = (req.body.name || "").trim();
    const text = (req.body.text || "").trim();
    const image = req.body.image || null;
    const parsedRating = parseInt(req.body.rating, 10);

    if (!businessId) return res.status(400).json({ error: "Missing businessId." });
    if (!parsedRating || Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "Invalid rating." });
    }

    const profile = await getBusinessProfile(businessId);
    if (!profile || profile.active === false) {
      return res.status(404).json({ error: "Business not found." });
    }

    const deliveryType = profile.delivery_type || "widget";
    if (!includesHosted(deliveryType)) {
      return res.status(403).json({ error: "Hosted page is not enabled for this client." });
    }

    const planTier = (profile.plan_tier || PLAN_FREE).toLowerCase();
    const autoApprove = !planRequiresModeration(planTier);
    const finalImage = planAllowsImages(planTier) ? image : null;

    const { error } = await supabaseAdmin.from("reviews").insert([{
      name: name || "Anonymous",
      text: text || "",
      rating: parsedRating,
      image: finalImage,
      approved: autoApprove,
      business_id: businessId,
      source: "hosted_page"
    }]);

    if (error) return res.status(500).json({ error: error.message });

    if (profile.notifications_enabled && profile.notification_email && resend && RESEND_FROM) {
      try {
        const businessName = profile.brand_name || prettyBusinessName(businessId);

        await resend.emails.send({
          from: RESEND_FROM,
          to: [profile.notification_email],
          subject: autoApprove
            ? `New hosted page review for ${businessName}`
            : `New hosted page review awaiting approval for ${businessName}`,
          html: `
            <div style="font-family:Arial,sans-serif;padding:24px;background:#f3f7ff;">
              <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:20px;padding:24px;border:1px solid #e5eefc;">
                <h2 style="margin-top:0;">New Hosted Review Submitted</h2>
                <p><strong>Business:</strong> ${escapeHtml(businessName)}</p>
                <p><strong>Name:</strong> ${escapeHtml(name || "Anonymous")}</p>
                <p><strong>Rating:</strong> ${parsedRating} / 5</p>
                <p><strong>Status:</strong> ${autoApprove ? "Published automatically" : "Pending approval"}</p>
                <p>${escapeHtml(text || "(no text)")}</p>
                ${!autoApprove ? `<p><a href="${PUBLIC_APP_URL}/admin3">Review & Approve</a></p>` : ""}
              </div>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("Hosted review notification email error:", emailErr);
      }
    }

    res.json({ success: true, approved: autoApprove });
  } catch (err) {
    console.error("POST /api/review error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// ------------------------------
// Google import
// ------------------------------
app.post("/import-google-review", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    const profile = await getAdminProfileByEmail(user.email);

    if ((profile.plan_tier || "").toLowerCase() !== PLAN_PREMIUM) {
      return res.status(403).send("Google review import is Premium only.");
    }

    if (!profile.google_import_enabled) {
      return res.status(403).send("Google review import is disabled for this account.");
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
    if (businessId !== profile.business_id) return res.status(403).send("Business mismatch.");

    const { error } = await supabaseAdmin.from("reviews").insert([{
      name,
      text,
      rating: parsedRating,
      image,
      approved: true,
      business_id: businessId,
      source: "google"
    }]);

    if (error) return res.status(500).send(error.message);
    res.json({ success: true });
  } catch (err) {
    console.error("POST /import-google-review error:", err);
    res.status(401).send(err.message || "Unauthorized");
  }
});

// ------------------------------
// Admin moderation
// ------------------------------
app.put("/reviews/:id", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    const profile = await getAdminProfileByEmail(user.email);

    if (!PAID_DASHBOARD_PLANS.includes((profile.plan_tier || "").toLowerCase())) {
      return res.status(403).send("This plan does not include dashboard access.");
    }

    const { error } = await supabaseAdmin
      .from("reviews")
      .update({ approved: !!req.body.approved })
      .eq("id", req.params.id)
      .eq("business_id", profile.business_id);

    if (error) return res.status(500).send(error.message);
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /reviews/:id error:", err);
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

    const { error } = await supabaseAdmin
      .from("reviews")
      .delete()
      .eq("id", req.params.id)
      .eq("business_id", profile.business_id);

    if (error) return res.status(500).send(error.message);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /reviews/:id error:", err);
    res.status(401).send(err.message || "Unauthorized");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

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

const CLOUDINARY_CLOUD_NAME = "drloe7yv4";
const CLOUDINARY_API_KEY = "949256172383417";
const CLOUDINARY_API_SECRET = "t4zTHsRXinGvwAiRsUfLgw14mo4";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

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
    .select("email,business_id,must_reset_password,notifications_enabled,notification_email")
    .eq("email", email)
    .limit(1);

  if (error) throw error;
  if (!data || !data.length) throw new Error("Admin profile not found");

  return data[0];
}

function prettyBusinessName(businessId) {
  if (!businessId) return "Your Business";
  return businessId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

    res.json({
      success: true,
      email: profile.email,
      businessId: profile.business_id,
      mustResetPassword: !!profile.must_reset_password,
      notificationsEnabled: !!profile.notifications_enabled,
      notificationEmail: profile.notification_email || ""
    });
  } catch (err) {
    console.error("POST /admin-me error:", err);
    res.status(401).send(err.message || "Unauthorized");
  }
});

app.post("/admin-mark-password-reset-complete", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);

    const { error } = await supabaseAdmin
      .from("admin_users")
      .update({ must_reset_password: false })
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

    const payload = {
      name: name || "Anonymous",
      text: text || "",
      rating: parsedRating,
      image: image,
      approved: false,
      business_id: businessId
    };

    const { error } = await supabase
      .from("reviews")
      .insert([payload]);

    if (error) {
      console.error("POST /reviews error:", error);
      return res.status(500).send(error.message);
    }

    const { data: admins, error: adminErr } = await supabaseAdmin
      .from("admin_users")
      .select("notifications_enabled,notification_email,business_id")
      .eq("business_id", businessId)
      .limit(1);

    if (!adminErr && admins && admins.length) {
      const admin = admins[0];

      if (admin.notifications_enabled && admin.notification_email && resend && RESEND_FROM) {
        try {
          const businessName = prettyBusinessName(businessId);

          await resend.emails.send({
            from: RESEND_FROM,
            to: [admin.notification_email],
            subject: `New review for ${businessName}`,
            html: `
              <div style="margin:0;padding:0;background:#f3f7ff;">
                <div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:Arial,sans-serif;color:#1f2937;">
                  <div style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.10);border:1px solid #e5eefc;">
                    <div style="height:58px;background:linear-gradient(90deg,#4ea3ff 0%,#2156d8 100%);"></div>

                    <div style="padding:24px;">
                      <div style="font-size:28px;font-weight:800;color:#1f2937;margin-bottom:6px;">AppLogix</div>
                      <div style="font-size:14px;color:#64748b;margin-bottom:20px;">New review notification</div>

                      <div style="background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);border:1px solid #e4eefc;border-radius:20px;padding:20px;box-shadow:0 14px 28px rgba(15,23,42,0.08);">
                        <h2 style="margin:0 0 14px;font-size:24px;color:#1e3a8a;">New Review Submitted</h2>

                        <p style="margin:0 0 14px;line-height:1.6;">
                          A new review has been submitted for <strong>${businessName}</strong> and is awaiting approval.
                        </p>

                        <p style="margin:0 0 8px;"><strong>Business ID:</strong> ${businessId}</p>
                        <p style="margin:0 0 8px;"><strong>Name:</strong> ${payload.name}</p>
                        <p style="margin:0 0 8px;"><strong>Rating:</strong> ${payload.rating} / 5</p>
                        <p style="margin:0 0 8px;"><strong>Image Included:</strong> ${payload.image ? "Yes" : "No"}</p>

                        <div style="margin-top:16px;margin-bottom:16px;padding:14px 16px;background:#f9fbff;border:1px solid #dbe7fb;border-radius:16px;">
                          <div style="font-size:14px;font-weight:700;color:#334155;margin-bottom:8px;">Review Message</div>
                          <div style="line-height:1.6;color:#334155;">${payload.text || "(no text)"}</div>
                        </div>

                        <a href="https://final-widget.onrender.com/admin"
                           style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">
                          Review & Approve
                        </a>

                        <p style="margin-top:16px;font-size:13px;color:#64748b;">
                          Log in to approve, reject, or delete this review.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `
          });
        } catch (emailErr) {
          console.error("Resend notification error:", emailErr);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("POST /reviews server error:", err);
    res.status(500).send("Server error");
  }
});

app.put("/reviews/:id", async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    const profile = await getAdminProfileByEmail(user.email);

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

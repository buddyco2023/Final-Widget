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
  const { data, error } = await supabase
    .from("admin_users")
    .select("email,business_id,must_reset_password,notifications_enabled,notification_email")
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
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reset-password.html"));
});

app.get("/test-123", (req, res) => {
  res.send("new code is live");
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

app.get("/client-config", async (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  });
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

    const { error } = await supabase
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

    const { data: admins, error: adminErr } = await supabase
      .from("admin_users")
      .select("notifications_enabled,notification_email")
      .eq("business_id", businessId)
      .limit(1);

    if (!adminErr && admins && admins.length) {
      const admin = admins[0];
      if (admin.notifications_enabled && admin.notification_email && resend && RESEND_FROM) {
        try {
          await resend.emails.send({
            from: RESEND_FROM,
            to: [admin.notification_email],
            subject: "New review submitted",
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.5;">
                <h2>New review submitted</h2>
                <p><strong>Business ID:</strong> ${businessId}</p>
                <p><strong>Name:</strong> ${payload.name}</p>
                <p><strong>Rating:</strong> ${payload.rating} / 5</p>
                <p><strong>Message:</strong><br>${payload.text || "(no text)"}</p>
                <p><strong>Image:</strong> ${payload.image ? "Yes" : "No"}</p>
                <p>Status: Pending spam screening</p>
              </div>
            `
          });
        } catch (emailErr) {
          console.error("Resend notification error:", emailErr);
        }
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("POST /reviews server error:", err);
    return res.status(500).send("Server error");
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

    return res.json({ success: true });
  } catch (err) {
    console.error("PUT /reviews/:id server error:", err);
    return res.status(401).send(err.message || "Unauthorized");
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

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /reviews/:id server error:", err);
    return res.status(401).send(err.message || "Unauthorized");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

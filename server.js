const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const CLOUDINARY_CLOUD_NAME = "drloe7yv4";
const CLOUDINARY_API_KEY = "949256172383417";
const CLOUDINARY_API_SECRET = "t4zTHsRXinGvwAiRsUfLgw14mo4";

const supabase = createClient(
  "https://guisalxfmvdkiwizxlgi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aXNhbHhmbXZka2l3aXp4bGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzI1ODUsImV4cCI6MjA4OTk0ODU4NX0.M65BNqLBYxuDU1-cL7GjTrvCoQwxo8hgf2MKznpwQ14"
);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("API running");
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
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

app.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send("Missing login details");
    }

    const { data, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("email", email.trim())
      .eq("password", password.trim())
      .limit(1);

    if (error) {
      console.error("POST /admin-login error:", error);
      return res.status(500).send(error.message);
    }

    if (!data || !data.length) {
      return res.status(401).send("Invalid login");
    }

    res.json({
      success: true,
      businessId: data[0].business_id,
      email: data[0].email
    });
  } catch (err) {
    console.error("POST /admin-login server error:", err);
    res.status(500).send("Server error");
  }
});

app.get("/reviews", async (req, res) => {
  try {
    const businessId = req.query.businessId;

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
    const { name, text, rating, image, businessId } = req.body;

    const parsedRating = parseInt(rating, 10);

    if (!businessId || !businessId.trim()) {
      return res.status(400).send("Missing businessId");
    }

    if (!parsedRating || Number.isNaN(parsedRating)) {
      return res.status(400).send("Invalid rating");
    }

    const payload = {
      name: name && name.trim() ? name.trim() : "Anonymous",
      text: text && text.trim() ? text.trim() : "",
      rating: parsedRating,
      image: image || null,
      approved: false,
      business_id: businessId.trim()
    };

    const { error } = await supabase
      .from("reviews")
      .insert([payload]);

    if (error) {
      console.error("POST /reviews error:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("POST /reviews server error:", err);
    res.status(500).send("Server error");
  }
});

app.put("/reviews/:id", async (req, res) => {
  try {
    const { approved, businessId } = req.body;

    if (!businessId) {
      return res.status(400).send("Missing businessId");
    }

    const { error } = await supabase
      .from("reviews")
      .update({ approved: !!approved })
      .eq("id", req.params.id)
      .eq("business_id", businessId);

    if (error) {
      console.error("PUT /reviews/:id error:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("PUT /reviews/:id server error:", err);
    res.status(500).send("Server error");
  }
});

app.delete("/reviews/:id", async (req, res) => {
  try {
    const { businessId } = req.body;

    if (!businessId) {
      return res.status(400).send("Missing businessId");
    }

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", req.params.id)
      .eq("business_id", businessId);

    if (error) {
      console.error("DELETE /reviews/:id error:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /reviews/:id server error:", err);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

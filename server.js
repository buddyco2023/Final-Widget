const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "mysecrettoken123";

// REPLACE THESE 3 VALUES WITH THE ONES FROM YOUR CLOUDINARY DASHBOARD
const CLOUDINARY_CLOUD_NAME = "PASTE_YOUR_CLOUDINARY_CLOUD_NAME_HERE";
const CLOUDINARY_API_KEY = "PASTE_YOUR_CLOUDINARY_API_KEY_HERE";
const CLOUDINARY_API_SECRET = "PASTE_YOUR_CLOUDINARY_API_SECRET_HERE";

const supabase = createClient(
  "https://guisalxfmvdkiwizxlgi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aXNhbHhmbXZka2l3aXp4bGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzI1ODUsImV4cCI6MjA4OTk0ODU4NX0.M65BNqLBYxuDU1-cL7GjTrvCoQwxo8hgf2MKznpwQ14"
);

app.get("/", (req, res) => {
  res.send("API running");
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

app.get("/reviews", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("id", { ascending: false });

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
    const { name, text, rating, image } = req.body;

    const parsedRating = parseInt(rating, 10);

    if (!parsedRating || Number.isNaN(parsedRating)) {
      return res.status(400).send("Invalid rating");
    }

    const payload = {
      name: name && name.trim() ? name.trim() : "Anonymous",
      text: text && text.trim() ? text.trim() : "",
      rating: parsedRating,
      image: image || null,
      approved: false
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
    const token = req.headers.authorization;

    if (token !== ADMIN_TOKEN) {
      return res.status(403).send("Unauthorized");
    }

    const { approved } = req.body;

    const { error } = await supabase
      .from("reviews")
      .update({ approved: !!approved })
      .eq("id", req.params.id);

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
    const token = req.headers.authorization;

    if (token !== ADMIN_TOKEN) {
      return res.status(403).send("Unauthorized");
    }

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", req.params.id);

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

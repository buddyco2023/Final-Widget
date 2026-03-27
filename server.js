const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" })); // increased for images

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "mysecrettoken123";

// Cloudinary config
cloudinary.config({
  cloud_name: "drloe7yv4",
  api_key: "94925617238417",
  api_secret: "t4zTHsRXinGvwAiRsUfLgw14mo4"
});

// Supabase
const supabase = createClient(
  "https://guisalxfmvdkiwizxlgi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aXNhbHhmbXZka2l3aXp4bGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzI1ODUsImV4cCI6MjA4OTk0ODU4NX0.M65BNqLBYxuDU1-cL7GjTrvCoQwxo8hgf2MKznpwQ14"
);

// TEST
app.get("/", (req, res) => {
  res.send("API running");
});

// GET REVIEWS
app.get("/reviews", async (req, res) => {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    return res.status(500).send(error.message);
  }

  res.json(data || []);
});

// POST REVIEW (FINAL FIXED VERSION)
app.post("/reviews", async (req, res) => {
  try {
    const { name, text, rating, image } = req.body;

    let imageUrl = null;

    // 🔥 FIX: validate base64 BEFORE upload
    if (image && image.startsWith("data:image")) {
      try {
        const result = await cloudinary.uploader.upload(image, {
          folder: "reviews",
          resource_type: "auto"
        });
        imageUrl = result.secure_url;
      } catch (cloudErr) {
        console.error("Cloudinary error:", cloudErr);
        return res.status(500).send("Image upload failed");
      }
    }

    const { error } = await supabase
      .from("reviews")
      .insert([
        {
          name: name || "Anonymous",
          text: text || "",
          rating: parseInt(rating),
          image: imageUrl,
          approved: false
        }
      ]);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).send("Upload error");
  }
});

// APPROVE / REJECT
app.put("/reviews/:id", async (req, res) => {
  const token = req.headers.authorization;

  if (token !== ADMIN_TOKEN) {
    return res.status(403).send("Unauthorized");
  }

  const { approved } = req.body;

  const { error } = await supabase
    .from("reviews")
    .update({ approved })
    .eq("id", req.params.id);

  if (error) return res.status(500).send(error.message);

  res.json({ success: true });
});

// DELETE
app.delete("/reviews/:id", async (req, res) => {
  const token = req.headers.authorization;

  if (token !== ADMIN_TOKEN) {
    return res.status(403).send("Unauthorized");
  }

  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).send(error.message);

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));

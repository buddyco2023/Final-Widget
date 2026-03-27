const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "mysecrettoken123";

cloudinary.config({
  cloud_name: "drloe7yv4",
  api_key: "94925617238417",
  api_secret: "t4zTHsRXinGvwAiRsUfLgw14mo4"
});

const supabase = createClient(
  "https://guisalxfmvdkiwizxlgi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aXNhbHhmbXZka2l3aXp4bGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzI1ODUsImV4cCI6MjA4OTk0ODU4NX0.M65BNqLBYxuDU1-cL7GjTrvCoQwxo8hgf2MKznpwQ14"
);

app.get("/", (req, res) => {
  res.send("API running");
});

app.get("/reviews", async (req, res) => {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error("GET /reviews error:", error);
    return res.status(500).send(error.message);
  }

  res.json(data || []);
});

app.post("/reviews", async (req, res) => {
  try {
    const { name, text, rating, image } = req.body;

    let imageUrl = null;

    if (image) {
      const result = await cloudinary.uploader.upload(image, {
        folder: "reviews",
        resource_type: "image"
      });
      imageUrl = result.secure_url;
    }

    const payload = {
      name: name && name.trim() ? name.trim() : "Anonymous",
      text: text && text.trim() ? text.trim() : "",
      rating: parseInt(rating, 10),
      image: imageUrl,
      approved: false
    };

    if (!payload.rating || Number.isNaN(payload.rating)) {
      return res.status(400).send("Invalid rating");
    }

    const { error } = await supabase
      .from("reviews")
      .insert([payload]);

    if (error) {
      console.error("POST /reviews insert error:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("POST /reviews upload error:", err);
    res.status(500).send("Upload error");
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

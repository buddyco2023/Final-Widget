const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// Supabase
const supabase = createClient(
  "https://guisalxfmvdkiwizxlgi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aXNhbHhmbXZka2l3aXp4bGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzI1ODUsImV4cCI6MjA4OTk0ODU4NX0.M65BNqLBYxuDU1-cL7GjTrvCoQwxo8hgf2MKznpwQ14"
);

// Cloudinary
cloudinary.config({
  cloud_name: "drloe7yv4",
  api_key: "94925617238417",
  api_secret: "t4zTHsRXinGvwAiRsUfLgw14mo4"
});

// Admin Token — REPLACE with your own password
const ADMIN_TOKEN = "MySecret123";

const upload = multer({ dest: "temp/" });

// GET approved reviews
app.get("/reviews", async (req, res) => {
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("approved", true)
    .order("created", { ascending: false });
  res.json(data);
});

// Submit review
app.post("/reviews", upload.single("image"), async (req, res) => {
  const { name, text, rating } = req.body;
  let imageUrl = null;
  if (req.file) {
    const result = await cloudinary.uploader.upload(req.file.path);
    imageUrl = result.secure_url;
  }
  await supabase.from("reviews").insert([{ name, text, rating, image: imageUrl }]);
  res.send({ success: true });
});

// Admin authentication
function auth(req, res, next) {
  if (req.headers.authorization === ADMIN_TOKEN) next();
  else res.status(403).send("Unauthorized");
}

// Get all reviews (admin)
app.get("/admin/reviews", auth, async (req, res) => {
  const { data } = await supabase.from("reviews").select("*").order("created", { ascending: false });
  res.json(data);
});

// Approve
app.post("/admin/approve/:id", auth, async (req, res) => {
  await supabase.from("reviews").update({ approved: true }).eq("id", req.params.id);
  res.send({ success: true });
});

// Delete
app.delete("/admin/delete/:id", auth, async (req, res) => {
  await supabase.from("reviews").delete().eq("id", req.params.id);
  res.send({ success: true });
});

app.listen(3000, () => console.log("Server running"));

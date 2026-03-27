const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Cloudinary config
cloudinary.config({
  cloud_name: "drloe7yv4",
  api_key: "94925617238417",
  api_secret: "t4zTHsRXinGvwAiRsUfLgw14mo4"
});

// Supabase
const supabase = createClient(
  "https://guisalxfmvdkiwizxlgi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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

  if (error) return res.status(500).send(error.message);
  res.json(data);
});

// POST REVIEW (WITH IMAGE)
app.post("/reviews", upload.single("image"), async (req, res) => {
  try {
    const { name, text, rating } = req.body;
    let imageUrl = null;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url;
    }

    const { error } = await supabase
      .from("reviews")
      .insert([
        {
          name,
          text,
          rating: parseInt(rating),
          image: imageUrl,
          approved: false
        }
      ]);

    if (error) return res.status(500).send(error.message);

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).send("Upload error");
  }
});

// APPROVE / REJECT
app.put("/reviews/:id", async (req, res) => {
  const token = req.headers.authorization;
  if (token !== ADMIN_TOKEN) return res.status(403).send("Unauthorized");

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
  if (token !== ADMIN_TOKEN) return res.status(403).send("Unauthorized");

  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).send(error.message);

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));

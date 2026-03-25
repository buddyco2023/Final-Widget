const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// Supabase
const supabase = createClient(
  "https://guisalxfmvdkiwizxlgi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aXNhbHhmbXZka2l3aXp4bGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzI1ODUsImV4cCI6MjA4OTk0ODU4NX0.M65BNqLBYxuDU1-cL7GjTrvCoQwxo8hgf2MKznpwQ14"
);

// Test route
app.get("/", (req, res) => {
  res.send("API is running");
});

// GET reviews
app.get("/reviews", async (req, res) => {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error("GET ERROR:", error);
    return res.status(500).send(error.message);
  }

  res.json(data);
});

// POST review (FIXED + SAFE)
app.post("/reviews", async (req, res) => {
  try {
    let { name, text, rating } = req.body;

    // Force correct types
    rating = parseInt(rating);

    if (!rating || isNaN(rating)) {
      return res.status(400).send("Invalid rating");
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert([
        {
          name: name || "Anonymous",
          text: text || "",
          rating: rating,
          approved: true
        }
      ]);

    if (error) {
      console.error("INSERT ERROR:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));

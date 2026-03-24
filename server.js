const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ YOUR SUPABASE INFO
const supabase = createClient(
  "https://guisalxfmvdkiwizxlgi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aXNhbHhmbXZka2l3aXp4bGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzI1ODUsImV4cCI6MjA4OTk0ODU4NX0.M65BNqLBYxuDU1-cL7GjTrvCoQwxo8hgf2MKznpwQ14"
);

// ✅ TEST ROUTE
app.get("/", (req, res) => {
  res.send("API is running");
});

// ✅ GET REVIEWS (NO FILTER — SHOW EVERYTHING)
app.get("/reviews", async (req, res) => {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    return res.status(500).send(error.message);
  }

  res.json(data);
});

// ✅ POST REVIEW (AUTO APPROVED)
app.post("/reviews", async (req, res) => {
  const { name, text, rating } = req.body;

  const { data, error } = await supabase
    .from("reviews")
    .insert([
      {
        name,
        text,
        rating,
        approved: true // ✅ always auto approve
      }
    ]);

  if (error) {
    console.error(error);
    return res.status(500).send(error.message);
  }

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));

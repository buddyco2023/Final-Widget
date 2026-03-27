app.post("/reviews", upload.single("image"), async (req, res) => {
  try {
    const { name, text, rating } = req.body;

    let imageUrl = null;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "reviews"
      });
      imageUrl = result.secure_url;
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
      console.error("INSERT ERROR:", error);
      return res.status(500).send(error.message);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).send("Upload error");
  }
});

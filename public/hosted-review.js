let businessId = "";
let selectedRating = 0;
let currentPage = 1;
let currentFilter = "all";
let hasMore = false;
let businessConfig = null;

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stars(n) {
  const val = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return "★".repeat(val) + "☆".repeat(5 - val);
}

function getBusinessIdFromUrl() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  if (pathParts[0] === "r" && pathParts[1]) {
    return decodeURIComponent(pathParts[1]);
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("businessId") || "";
}

function setFormStatus(message) {
  $("formStatus").textContent = message || "";
}

function setTheme(primary, secondary) {
  if (primary) document.documentElement.style.setProperty("--primary", primary);
  if (secondary) document.documentElement.style.setProperty("--secondary", secondary);
}

async function loadBusiness() {
  businessId = getBusinessIdFromUrl();

  if (!businessId) {
    $("businessName").textContent = "Missing Business ID";
    $("businessSubtitle").textContent = "This hosted review page is missing a business ID.";
    $("reviewsGrid").innerHTML = `<div class="empty-card">Missing business ID.</div>`;
    return;
  }

  try {
    const res = await fetch("/api/business/" + encodeURIComponent(businessId), {
      cache: "no-store"
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Could not load business.");
    }

    businessConfig = data;

    setTheme(data.brandPrimary || "#2563eb", data.brandSecondary || "#4ea3ff");

    document.title = "Leave a Review | " + (data.name || "AppLogix");

    $("businessName").textContent = data.name || businessId;
    $("businessSubtitle").textContent =
      data.subtitle ||
      "Share your experience below. Reviews help businesses build trust and improve customer experience.";

    $("businessIdLine").textContent = "Page ID: " + businessId;

    $("formTitle").textContent = "Leave a Review";
    $("formSubtitle").textContent =
      "Your feedback helps improve service and can be reviewed before being displayed publicly.";

    $("footerText").textContent = data.footer || "Powered by AppLogix";

    const logo = $("businessLogo");
    if (data.logo) {
      logo.src = data.logo;
      logo.style.display = "block";
    } else {
      logo.style.display = "none";
    }

    $("formNote").textContent =
      "Reviews are submitted for spam screening prior to being displayed.";

    await loadReviews(true);
  } catch (err) {
    $("businessName").textContent = "Could Not Load Page";
    $("businessSubtitle").textContent = err.message || "This hosted review page could not be loaded.";
    $("reviewsGrid").innerHTML = `<div class="empty-card">${escapeHtml(err.message || "Could not load reviews.")}</div>`;
  }
}

async function loadReviews(reset = false) {
  if (!businessId) return;

  if (reset) {
    currentPage = 1;
    $("reviewsGrid").innerHTML = `<div class="empty-card">Loading reviews...</div>`;
  }

  try {
    const url =
      "/api/reviews/" +
      encodeURIComponent(businessId) +
      "?page=" +
      encodeURIComponent(currentPage) +
      "&filter=" +
      encodeURIComponent(currentFilter);

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Could not load reviews.");
    }

    renderSummary(data.summary || {});
    renderReviews(data.reviews || [], reset);

    hasMore = !!data.hasMore;
    $("loadMoreBtn").style.display = hasMore ? "inline-block" : "none";
  } catch (err) {
    $("reviewsGrid").innerHTML = `<div class="empty-card">${escapeHtml(err.message || "Could not load reviews.")}</div>`;
    $("loadMoreBtn").style.display = "none";
  }
}

function renderSummary(summary) {
  const average = Number(summary.average || 0);
  const count = Number(summary.count || 0);

  $("summaryAverage").textContent = average.toFixed(1);
  $("summaryStars").textContent = stars(average);

  if (count === 0) {
    $("summaryCount").textContent = "No approved reviews yet.";
  } else if (count === 1) {
    $("summaryCount").textContent = "Based on 1 approved review.";
  } else {
    $("summaryCount").textContent = "Based on " + count + " approved reviews.";
  }
}

function renderReviews(reviews, reset) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    if (reset) {
      $("reviewsGrid").innerHTML = `<div class="empty-card">No approved reviews found yet.</div>`;
    }
    return;
  }

  const html = reviews.map((review) => {
    const date = review.createdAt
      ? new Date(review.createdAt).toLocaleDateString()
      : "";

    return `
      <article class="review-card">
        <div class="review-name">${escapeHtml(review.name || "Anonymous")}</div>
        <div class="review-meta">${escapeHtml(date)}</div>
        <div class="review-stars">${stars(review.rating)}</div>
        <div class="review-text">${escapeHtml(review.text || "")}</div>
        ${
          review.image
            ? `<img src="${escapeHtml(review.image)}" alt="Review image" />`
            : ""
        }
      </article>
    `;
  }).join("");

  if (reset) {
    $("reviewsGrid").innerHTML = html;
  } else {
    $("reviewsGrid").insertAdjacentHTML("beforeend", html);
  }
}

function setRating(rating) {
  selectedRating = rating;

  for (let i = 1; i <= 5; i++) {
    const star = $("star" + i);
    if (!star) continue;

    if (i <= rating) {
      star.classList.add("active");
    } else {
      star.classList.remove("active");
    }
  }
}

async function uploadImageIfNeeded(file) {
  if (!file) return "";

  const sigRes = await fetch("/cloudinary-signature", { cache: "no-store" });

  if (!sigRes.ok) {
    throw new Error("Image upload is not configured yet.");
  }

  const sig = await sigRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", sig.timestamp);
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const uploadUrl = "https://api.cloudinary.com/v1_1/" + sig.cloudName + "/image/upload";

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    body: form
  });

  const uploadData = await uploadRes.json();

  if (!uploadRes.ok) {
    throw new Error(uploadData?.error?.message || "Image upload failed.");
  }

  return uploadData.secure_url || "";
}

async function submitReview() {
  const name = $("reviewName").value.trim();
  const text = $("reviewText").value.trim();
  const file = $("reviewImage").files && $("reviewImage").files[0];

  if (!businessId) {
    setFormStatus("Missing business ID.");
    return;
  }

  if (!selectedRating) {
    setFormStatus("Please select a rating.");
    return;
  }

  const submitBtn = $("submitBtn");
  submitBtn.disabled = true;
  setFormStatus("Submitting review...");

  try {
    let imageUrl = "";

    if (file) {
      setFormStatus("Uploading image...");
      imageUrl = await uploadImageIfNeeded(file);
    }

    setFormStatus("Submitting review...");

    const res = await fetch("/api/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        businessId,
        name: name || "Anonymous",
        rating: selectedRating,
        text,
        image: imageUrl
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || "Review submission failed.");
    }

    $("reviewName").value = "";
    $("reviewText").value = "";
    $("reviewImage").value = "";
    setRating(0);

    setFormStatus(
      data.approved
        ? "Thank you. Your review has been published."
        : "Thank you. Your review was submitted for spam screening prior to being displayed."
    );

    await loadReviews(true);
  } catch (err) {
    setFormStatus(err.message || "Network error.");
  } finally {
    submitBtn.disabled = false;
  }
}

function setupEvents() {
  for (let i = 1; i <= 5; i++) {
    const star = $("star" + i);
    if (star) {
      star.addEventListener("click", () => setRating(i));
    }
  }

  $("submitBtn").addEventListener("click", submitReview);

  $("loadMoreBtn").addEventListener("click", async () => {
    if (!hasMore) return;
    currentPage += 1;
    await loadReviews(false);
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      currentFilter = btn.getAttribute("data-filter") || "all";
      await loadReviews(true);
    });
  });
}

async function boot() {
  setupEvents();
  await loadBusiness();
}

boot();

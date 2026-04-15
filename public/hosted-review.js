// ==============================
// AppLogix Hosted Review Script
// ==============================

const API_BASE = ""; // same domain

let businessId = null;
let currentPage = 1;
let currentFilter = "all";
let isLoading = false;
let selectedRating = 0;

// ------------------------------
// INIT
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  getBusinessId();
  setupStarRating();
  setupFilters();
  setupSubmit();
  loadBusiness();
  loadReviews();
});

// ------------------------------
// GET BUSINESS ID FROM URL
// example: /r/abc123
// fallback: /hosted-review.html?id=abc123
// ------------------------------
function getBusinessId() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  if (lastPart && lastPart !== "hosted-review.html") {
    businessId = lastPart;
    return;
  }

  const params = new URLSearchParams(window.location.search);
  businessId = params.get("id");
}

// ------------------------------
// LOAD BUSINESS INFO
// ------------------------------
async function loadBusiness() {
  try {
    const res = await fetch(`${API_BASE}/api/business/${businessId}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      showBusinessError(text || "Could not load business.");
      return;
    }

    const data = await res.json();

    if (data.name) {
      document.getElementById("businessName").innerText = data.name;
      document.title = `Leave a Review | ${data.name}`;
    }

    if (data.logo) {
      const logo = document.getElementById("businessLogo");
      logo.src = data.logo;
      logo.style.display = "block";
    }

    if (data.subtitle) {
      document.getElementById("businessSubtitle").innerText = data.subtitle;
    }

    if (data.footer) {
      document.getElementById("footerText").innerText = data.footer;
    }

    if (data.brandPrimary) {
      document.documentElement.style.setProperty("--primary", data.brandPrimary);
    }

    if (data.brandSecondary) {
      document.documentElement.style.setProperty("--secondary", data.brandSecondary);
    }

    if (data.planTier) {
      const plan = String(data.planTier).toLowerCase();
      const imageInput = document.getElementById("reviewImage");
      const formNote = document.getElementById("formNote");

      if (plan === "free") {
        imageInput.style.display = "none";
        formNote.innerText = "Reviews publish automatically on the Free plan.";
      } else if (plan === "basic") {
        formNote.innerText = "Reviews publish automatically on the Basic plan.";
      } else {
        formNote.innerText = "Reviews are submitted for approval before appearing publicly.";
      }
    }
  } catch (err) {
    console.error("Business load failed:", err);
    showBusinessError("Could not load business information.");
  }
}

function showBusinessError(message) {
  document.getElementById("businessName").innerText = "Hosted Page Unavailable";
  document.getElementById("businessSubtitle").innerText = message;
  document.getElementById("reviewsGrid").innerHTML =
    `<div class="empty-card">${escapeHTML(message)}</div>`;
}

// ------------------------------
// LOAD REVIEWS
// ------------------------------
async function loadReviews(reset = true) {
  if (isLoading || !businessId) return;
  isLoading = true;

  if (reset) {
    currentPage = 1;
    document.getElementById("reviewsGrid").innerHTML = "";
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/reviews/${businessId}?page=${currentPage}&filter=${encodeURIComponent(currentFilter)}`
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (reset) {
        document.getElementById("reviewsGrid").innerHTML =
          `<div class="empty-card">${escapeHTML(text || "Could not load reviews.")}</div>`;
      }
      toggleLoadMore(false);
      isLoading = false;
      return;
    }

    const data = await res.json();

    renderReviews(data.reviews || [], reset);
    updateSummary(data.summary || {});
    toggleLoadMore(!!data.hasMore);

    currentPage++;
  } catch (err) {
    console.error("Error loading reviews:", err);
    if (reset) {
      document.getElementById("reviewsGrid").innerHTML =
        `<div class="empty-card">Could not load reviews.</div>`;
    }
    toggleLoadMore(false);
  }

  isLoading = false;
}

// ------------------------------
// RENDER REVIEWS
// ------------------------------
function renderReviews(reviews, reset) {
  const grid = document.getElementById("reviewsGrid");

  if (reset && reviews.length === 0) {
    grid.innerHTML = `<div class="empty-card">No reviews yet</div>`;
    return;
  }

  reviews.forEach(r => {
    const el = document.createElement("div");
    el.className = "review-card";

    const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);

    el.innerHTML = `
      <div class="review-name">${escapeHTML(r.name || "Anonymous")}</div>
      <div class="review-meta">${formatDate(r.createdAt)}</div>
      <div class="review-stars">${stars}</div>
      <div class="review-text">${escapeHTML(r.text || "")}</div>
      ${r.image ? `<img src="${escapeHTML(r.image)}" alt="Review image" />` : ""}
    `;

    grid.appendChild(el);
  });
}

// ------------------------------
// SUMMARY
// ------------------------------
function updateSummary(summary) {
  const avg = Number(summary.average || 0);
  const count = Number(summary.count || 0);

  document.getElementById("summaryNumber").innerText = avg.toFixed(1);
  document.getElementById("summaryStars").innerText =
    "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg));
  document.getElementById("summaryCount").innerText =
    `${count} review${count !== 1 ? "s" : ""}`;
}

// ------------------------------
// LOAD MORE BUTTON
// ------------------------------
function toggleLoadMore(show) {
  const btn = document.getElementById("loadMoreBtn");
  btn.style.display = show ? "inline-block" : "none";
}

document.getElementById("loadMoreBtn").addEventListener("click", () => {
  loadReviews(false);
});

// ------------------------------
// FILTERS
// ------------------------------
function setupFilters() {
  const buttons = document.querySelectorAll(".filter-btn");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentFilter = btn.dataset.filter;
      loadReviews(true);
    });
  });
}

// ------------------------------
// STAR RATING INPUT
// ------------------------------
function setupStarRating() {
  for (let i = 1; i <= 5; i++) {
    document.getElementById(`star${i}`).addEventListener("click", () => {
      selectedRating = i;
      updateStars();
    });
  }
}

function updateStars() {
  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(`star${i}`);
    btn.classList.toggle("active", i <= selectedRating);
  }
}

// ------------------------------
// SUBMIT REVIEW
// ------------------------------
function setupSubmit() {
  document.getElementById("submitBtn").addEventListener("click", submitReview);
}

async function submitReview() {
  const name = document.getElementById("reviewName").value.trim();
  const text = document.getElementById("reviewText").value.trim();
  const imageFile = document.getElementById("reviewImage").files[0];
  const status = document.getElementById("formStatus");
  const btn = document.getElementById("submitBtn");

  if (!selectedRating) {
    status.innerText = "Please select a rating";
    return;
  }

  if (!businessId) {
    status.innerText = "Missing business ID";
    return;
  }

  btn.disabled = true;
  status.innerText = "Submitting...";

  try {
    let imageBase64 = null;

    if (imageFile) {
      imageBase64 = await fileToBase64(imageFile);
    }

    const res = await fetch(`${API_BASE}/api/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        businessId,
        name,
        rating: selectedRating,
        text,
        image: imageBase64
      })
    });

    const result = await res.json().catch(() => ({}));

    if (res.ok) {
      if (result.approved) {
        status.innerText = "Review submitted and published.";
      } else {
        status.innerText = "Review submitted for approval.";
      }
      resetForm();
      loadReviews(true);
    } else {
      status.innerText = result.error || "Error submitting review";
    }
  } catch (err) {
    console.error("Submit error:", err);
    status.innerText = "Network error";
  }

  btn.disabled = false;
}

// ------------------------------
// HELPERS
// ------------------------------
function resetForm() {
  document.getElementById("reviewName").value = "";
  document.getElementById("reviewText").value = "";
  document.getElementById("reviewImage").value = "";
  selectedRating = 0;
  updateStars();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString();
}

function escapeHTML(str) {
  return String(str || "").replace(/[&<>"']/g, match => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[match]);
}

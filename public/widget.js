(function () {
  const root = document.getElementById("applogix-review-widget");
  if (!root) return;

  const API = typeof ARW_API !== "undefined" ? ARW_API : "";
  const BUSINESS_ID = typeof BUSINESS_ID !== "undefined" ? BUSINESS_ID : "";
  const PLAN_TIER = typeof window.PLAN_TIER !== "undefined"
    ? window.PLAN_TIER
    : (typeof PLAN_TIER !== "undefined" ? PLAN_TIER : "free");

  const BRAND_NAME = typeof window.BRAND_NAME !== "undefined"
    ? window.BRAND_NAME
    : (typeof BRAND_NAME !== "undefined" ? BRAND_NAME : "Your Business");

  const BRAND_PRIMARY = typeof window.BRAND_PRIMARY !== "undefined"
    ? window.BRAND_PRIMARY
    : (typeof BRAND_PRIMARY !== "undefined" ? BRAND_PRIMARY : "#2563eb");

  const BRAND_SECONDARY = typeof window.BRAND_SECONDARY !== "undefined"
    ? window.BRAND_SECONDARY
    : (typeof BRAND_SECONDARY !== "undefined" ? BRAND_SECONDARY : "#4ea3ff");

  const BRAND_LOGO_URL = typeof window.BRAND_LOGO_URL !== "undefined"
    ? window.BRAND_LOGO_URL
    : (typeof BRAND_LOGO_URL !== "undefined" ? BRAND_LOGO_URL : "");

  const SHOW_POWERED_BY = typeof window.SHOW_POWERED_BY !== "undefined"
    ? window.SHOW_POWERED_BY
    : true;

  const POWERED_BY_NAME = typeof window.POWERED_BY_NAME !== "undefined"
    ? window.POWERED_BY_NAME
    : "AppLogix";

  const CACHE_KEY = "arw_reviews_" + BUSINESS_ID;
  const CACHE_TTL_MS = 1000 * 60 * 5;

  let selectedRating = 0;

  function canUploadImages() {
    return PLAN_TIER !== "free";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderStars(n) {
    const safe = Math.max(0, Math.min(5, Number(n) || 0));
    return "★".repeat(safe) + "☆".repeat(5 - safe);
  }

  function renderAverageStars(avg) {
    return renderStars(Math.round(Number(avg) || 0));
  }

  function getCachedReviews() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.timestamp || !Array.isArray(parsed.data)) return null;
      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (_) {
      return null;
    }
  }

  function setCachedReviews(reviews) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          data: reviews || []
        })
      );
    } catch (_) {}
  }

  function injectStyles() {
    if (document.getElementById("arw-widget-styles")) return;

    const style = document.createElement("style");
    style.id = "arw-widget-styles";
    style.textContent = `
      #applogix-review-widget {
        font-family: "Trebuchet MS", "Segoe UI", Arial, sans-serif;
        color: #1f2937;
        max-width: 980px;
        margin: 0 auto;
      }

      .arw-card {
        background: #ffffff;
        border-radius: 28px;
        overflow: hidden;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.10);
        border: 1px solid #e5eefc;
      }

      .arw-topbar {
        height: 58px;
        background: linear-gradient(90deg, ${BRAND_SECONDARY} 0%, ${BRAND_PRIMARY} 100%);
      }

      .arw-content {
        padding: 24px;
        background: linear-gradient(145deg, #eef5ff 0%, #f8fbff 55%, #edf4ff 100%);
      }

      .arw-summary-card,
      .arw-form-card,
      .arw-review,
      .arw-empty {
        background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        border-radius: 22px;
        border: 1px solid #e4eefc;
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.10), 0 3px 8px rgba(15, 23, 42, 0.05);
      }

      .arw-summary-card {
        padding: 20px;
        margin-bottom: 22px;
        text-align: center;
      }

      .arw-summary-title {
        font-size: 14px;
        color: #64748b;
        margin-bottom: 10px;
        font-weight: 700;
        letter-spacing: 0.3px;
      }

      .arw-summary-rating-row {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }

      .arw-summary-number {
        font-size: 34px;
        font-weight: 800;
        color: #1e3a8a;
        line-height: 1;
      }

      .arw-summary-stars,
      .arw-stars {
        color: #ffd84d;
        letter-spacing: 2px;
      }

      .arw-summary-stars {
        font-size: 26px;
      }

      .arw-summary-count {
        margin-top: 10px;
        color: #64748b;
        font-size: 14px;
      }

      .arw-list {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
        margin-bottom: 28px;
      }

      .arw-review {
        padding: 20px;
      }

      .arw-review-name {
        font-size: 18px;
        font-weight: 800;
        margin-bottom: 8px;
        color: #1f2937;
      }

      .arw-stars {
        margin-bottom: 12px;
        font-size: 22px;
      }

      .arw-review-text {
        line-height: 1.6;
        color: #334155;
      }

      .arw-review img {
        width: 100%;
        display: block;
        border-radius: 16px;
        margin-top: 12px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
      }

      .arw-empty {
        grid-column: 1 / -1;
        text-align: center;
        padding: 24px;
        color: #64748b;
      }

      .arw-form-card {
        padding: 24px;
      }

      .arw-subtitle {
        margin: 0 0 16px;
        font-size: 24px;
        font-weight: 800;
        color: #1e3a8a;
      }

      .arw-input,
      .arw-file {
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 13px;
        padding: 13px 15px;
        border-radius: 16px;
        border: 1px solid #cfdcf3;
        background: #f9fbff;
        font-size: 15px;
        color: #1f2937;
      }

      .arw-textarea {
        min-height: 130px;
        resize: vertical;
      }

      .arw-rating-block {
        margin-bottom: 14px;
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid #cfdcf3;
        background: #f9fbff;
      }

      .arw-rating-label {
        font-size: 15px;
        font-weight: 700;
        color: #334155;
        margin-bottom: 10px;
      }

      .arw-star-picker {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .arw-star-btn {
        border: none;
        background: transparent;
        font-size: 32px;
        line-height: 1;
        cursor: pointer;
        padding: 4px;
        border-radius: 14px;
        color: #d7dce5;
      }

      .arw-star-btn.active {
        color: #ffd84d;
      }

      .arw-button {
        width: 100%;
        border: none;
        border-radius: 16px;
        padding: 15px 18px;
        background: linear-gradient(180deg, ${BRAND_SECONDARY} 0%, ${BRAND_PRIMARY} 100%);
        color: #ffffff;
        font-size: 16px;
        font-weight: 800;
        cursor: pointer;
      }

      .arw-button:disabled {
        opacity: 0.72;
        cursor: not-allowed;
      }

      .arw-note {
        margin-top: 12px;
        font-size: 13px;
        color: #64748b;
      }

      .arw-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
        padding: 14px 20px;
        background: #ffffff;
        border-top: 1px solid #e5eefc;
      }

      .arw-powered {
        color: #6b7280;
        font-size: 13px;
      }

      .arw-brand {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .arw-logo {
        width: 22px;
        height: 22px;
        display: block;
        object-fit: contain;
      }

      .arw-brand-text {
        font-size: 14px;
        font-weight: 800;
        color: #1f2937;
      }

      .arw-loading {
        grid-column: 1 / -1;
        text-align: center;
        padding: 24px;
        color: #64748b;
      }

      @media (max-width: 900px) {
        .arw-list {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 640px) {
        .arw-content {
          padding: 18px;
        }

        .arw-list {
          grid-template-columns: 1fr;
        }

        .arw-footer {
          justify-content: center;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderShell() {
    const logoHtml = BRAND_LOGO_URL
      ? `<img class="arw-logo" src="${escapeHtml(BRAND_LOGO_URL)}" alt="${escapeHtml(BRAND_NAME)} logo">`
      : `<svg class="arw-logo" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="arwGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${escapeHtml(BRAND_SECONDARY)}"></stop>
              <stop offset="100%" stop-color="${escapeHtml(BRAND_PRIMARY)}"></stop>
            </linearGradient>
          </defs>
          <polygon points="23,7 39,28 18,35" fill="url(#arwGrad1)"></polygon>
          <polygon points="41,23 54,47 35,47 28,34" fill="url(#arwGrad1)"></polygon>
          <polygon points="22,37 33,47 16,47" fill="url(#arwGrad1)"></polygon>
        </svg>`;

    root.innerHTML = `
      <div class="arw-card">
        <div class="arw-topbar"></div>

        <div class="arw-content">
          <div class="arw-summary-card">
            <div class="arw-summary-title">Customer Rating</div>
            <div class="arw-summary-rating-row">
              <div class="arw-summary-number" id="arw-average-number">0.0</div>
              <div class="arw-summary-stars" id="arw-average-stars">☆☆☆☆☆</div>
            </div>
            <div class="arw-summary-count" id="arw-review-count">Loading...</div>
          </div>

          <div id="arw-list" class="arw-list">
            <div class="arw-loading">Loading reviews...</div>
          </div>

          <div class="arw-form-card">
            <h3 class="arw-subtitle">Leave a Review</h3>

            <input id="arw-name" class="arw-input" type="text" placeholder="Your name">

            <div class="arw-rating-block">
              <div class="arw-rating-label">Select rating</div>
              <div class="arw-star-picker">
                <button type="button" class="arw-star-btn" id="arw-star-1">★</button>
                <button type="button" class="arw-star-btn" id="arw-star-2">★</button>
                <button type="button" class="arw-star-btn" id="arw-star-3">★</button>
                <button type="button" class="arw-star-btn" id="arw-star-4">★</button>
                <button type="button" class="arw-star-btn" id="arw-star-5">★</button>
              </div>
            </div>

            <textarea id="arw-text" class="arw-input arw-textarea" placeholder="Share your experience..."></textarea>

            <input id="arw-image" class="arw-file" type="file" accept="image/jpeg,image/png,image/webp">

            <button id="arw-submit" class="arw-button">Submit Review</button>

            <div class="arw-note" id="arw-note">
              Reviews are submitted for spam screening before appearing on the site.
            </div>
          </div>
        </div>

        <div class="arw-footer">
          ${SHOW_POWERED_BY ? `
            <span class="arw-powered">Powered by:</span>
            <div class="arw-brand">
              ${logoHtml}
              <span class="arw-brand-text">${escapeHtml(POWERED_BY_NAME)}</span>
            </div>
          ` : ``}
        </div>
      </div>
    `;
  }

  function wireEvents() {
    for (let i = 1; i <= 5; i++) {
      const star = document.getElementById("arw-star-" + i);
      if (star) {
        star.addEventListener("click", function () {
          setRating(i);
        });
      }
    }

    const submitBtn = document.getElementById("arw-submit");
    if (submitBtn) {
      submitBtn.addEventListener("click", submitReview);
    }

    if (!canUploadImages()) {
      const fileInput = document.getElementById("arw-image");
      if (fileInput) {
        fileInput.style.display = "none";
      }

      const note = document.getElementById("arw-note");
      if (note) {
        note.textContent = "Reviews are submitted before appearing on the site.";
      }
    }
  }

  function setRating(value) {
    selectedRating = value;
    for (let i = 1; i <= 5; i++) {
      const star = document.getElementById("arw-star-" + i);
      if (star) {
        star.classList.toggle("active", i <= value);
      }
    }
  }

  async function uploadToCloudinary(file) {
    const signRes = await fetch(API + "/cloudinary-signature", { cache: "no-store" });
    if (!signRes.ok) throw new Error("Could not prepare image upload");

    const signData = await signRes.json();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signData.apiKey);
    formData.append("timestamp", signData.timestamp);
    formData.append("folder", signData.folder);
    formData.append("signature", signData.signature);

    const uploadRes = await fetch(
      "https://api.cloudinary.com/v1_1/" + signData.cloudName + "/image/upload",
      {
        method: "POST",
        body: formData
      }
    );

    if (!uploadRes.ok) {
      const txt = await uploadRes.text();
      throw new Error(txt || "Image upload failed");
    }

    const uploadData = await uploadRes.json();
    return uploadData.secure_url;
  }

  async function submitReview() {
    const btn = document.getElementById("arw-submit");
    const name = document.getElementById("arw-name").value.trim();
    const text = document.getElementById("arw-text").value.trim();
    const fileInput = document.getElementById("arw-image");
    const file = canUploadImages() && fileInput ? fileInput.files[0] : null;

    if (!selectedRating) {
      alert("Please select a rating.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Submitting...";

    try {
      let imageUrl = null;

      if (file) {
        imageUrl = await uploadToCloudinary(file);
      }

      const res = await fetch(API + "/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          text,
          rating: selectedRating,
          image: imageUrl,
          businessId: BUSINESS_ID
        })
      });

      if (!res.ok) {
        const err = await res.text();
        alert("Error: " + err);
        btn.disabled = false;
        btn.textContent = "Submit Review";
        return;
      }

      const result = await res.json();

      alert(result.approved
        ? "Review submitted and published."
        : "Review submitted! Awaiting approval.");

      document.getElementById("arw-name").value = "";
      document.getElementById("arw-text").value = "";
      if (fileInput) fileInput.value = "";
      setRating(0);

      await loadReviews(true);
    } catch (e) {
      alert("Error: " + (e.message || "Submission failed"));
    }

    btn.disabled = false;
    btn.textContent = "Submit Review";
  }

  function renderReviewList(reviews) {
    const approved = Array.isArray(reviews) ? reviews.filter(r => r.approved === true) : [];
    const list = document.getElementById("arw-list");
    const avgNumber = document.getElementById("arw-average-number");
    const avgStars = document.getElementById("arw-average-stars");
    const reviewCount = document.getElementById("arw-review-count");

    if (!approved.length) {
      avgNumber.textContent = "0.0";
      avgStars.textContent = "☆☆☆☆☆";
      reviewCount.textContent = "0 reviews";
      list.innerHTML = `<div class="arw-empty">No approved reviews yet.</div>`;
      return;
    }

    const total = approved.length;
    const avg = approved.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / total;

    avgNumber.textContent = avg.toFixed(1);
    avgStars.textContent = renderAverageStars(avg);
    reviewCount.textContent = total === 1 ? "1 review" : total + " reviews";

    list.innerHTML = approved.map(r => `
      <div class="arw-review">
        <div class="arw-review-name">${escapeHtml(r.name || "Anonymous")}</div>
        <div class="arw-stars">${renderStars(r.rating)}</div>
        <div class="arw-review-text">${escapeHtml(r.text || "")}</div>
        ${r.image ? `<img src="${escapeHtml(r.image)}" alt="Review image">` : ""}
      </div>
    `).join("");
  }

  async function loadReviews(forceRefresh) {
    if (!forceRefresh) {
      const cached = getCachedReviews();
      if (cached) {
        renderReviewList(cached);
      }
    }

    try {
      const res = await fetch(
        API + "/reviews?businessId=" + encodeURIComponent(BUSINESS_ID),
        { cache: "no-store" }
      );

      const data = await res.json();
      setCachedReviews(data);
      renderReviewList(data);
    } catch (_) {
      const list = document.getElementById("arw-list");
      const count = document.getElementById("arw-review-count");
      if (count) count.textContent = "Unable to load";
      if (list && !getCachedReviews()) {
        list.innerHTML = `<div class="arw-empty">Unable to load reviews right now.</div>`;
      }
    }
  }

  injectStyles();
  renderShell();
  wireEvents();
  loadReviews(false);
})();

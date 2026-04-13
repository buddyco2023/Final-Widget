(function () {
  const root = document.getElementById("applogix-review-widget");
  if (!root) return;

  const apiUrl = typeof window.ARW_API !== "undefined" ? window.ARW_API : "";
  const businessId = typeof window.BUSINESS_ID !== "undefined" ? window.BUSINESS_ID : "";
  const planTier = typeof window.PLAN_TIER !== "undefined"
    ? String(window.PLAN_TIER).toLowerCase()
    : "free";

  const brandName = typeof window.BRAND_NAME !== "undefined" ? window.BRAND_NAME : "Your Business";
  const brandPrimary = typeof window.BRAND_PRIMARY !== "undefined" ? window.BRAND_PRIMARY : "#2563eb";
  const brandSecondary = typeof window.BRAND_SECONDARY !== "undefined" ? window.BRAND_SECONDARY : "#4ea3ff";
  const brandLogoUrl = typeof window.BRAND_LOGO_URL !== "undefined" ? window.BRAND_LOGO_URL : "";
  const showPoweredBy = typeof window.SHOW_POWERED_BY !== "undefined" ? window.SHOW_POWERED_BY : true;
  const poweredByName = typeof window.POWERED_BY_NAME !== "undefined" ? window.POWERED_BY_NAME : "AppLogix";

  let selectedRating = 0;
  let currentFilterRating = null;
  let currentWithImages = false;
  let currentOffset = 0;
  const pageSize = 10;
  let isLoading = false;

  function canUploadImages() {
    return planTier !== "free";
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

  function timeAgo(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    const intervals = [
      { label: "year", secs: 31536000 },
      { label: "month", secs: 2592000 },
      { label: "week", secs: 604800 },
      { label: "day", secs: 86400 },
      { label: "hour", secs: 3600 },
      { label: "minute", secs: 60 }
    ];

    for (const item of intervals) {
      const count = Math.floor(seconds / item.secs);
      if (count >= 1) {
        return `${count} ${item.label}${count > 1 ? "s" : ""} ago`;
      }
    }

    return "Just now";
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
        background: linear-gradient(90deg, ${brandSecondary} 0%, ${brandPrimary} 100%);
      }

      .arw-content {
        padding: 24px;
        background: linear-gradient(145deg, #eef5ff 0%, #f8fbff 55%, #edf4ff 100%);
      }

      .arw-summary-card,
      .arw-form-card,
      .arw-review,
      .arw-empty,
      .arw-filter-card {
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

      .arw-filter-card {
        padding: 16px;
        margin-bottom: 22px;
      }

      .arw-filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .arw-filter-btn {
        border: 1px solid #cfdcf3;
        background: #f9fbff;
        color: #1f2937;
        border-radius: 12px;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }

      .arw-filter-btn.active {
        background: linear-gradient(180deg, ${brandSecondary} 0%, ${brandPrimary} 100%);
        color: white;
        border-color: ${brandPrimary};
      }

      .arw-list {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
        margin-bottom: 20px;
      }

      .arw-review {
        padding: 20px;
      }

      .arw-review-name {
        font-size: 18px;
        font-weight: 800;
        margin-bottom: 6px;
        color: #1f2937;
      }

      .arw-review-meta {
        font-size: 12px;
        color: #64748b;
        margin-bottom: 8px;
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

      .arw-load-wrap {
        text-align: center;
        margin-bottom: 28px;
      }

      .arw-load-more {
        border: none;
        border-radius: 16px;
        padding: 13px 20px;
        background: linear-gradient(180deg, ${brandSecondary} 0%, ${brandPrimary} 100%);
        color: white;
        font-size: 15px;
        font-weight: 800;
        cursor: pointer;
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
        background: linear-gradient(180deg, ${brandSecondary} 0%, ${brandPrimary} 100%);
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
    const logoHtml = brandLogoUrl
      ? `<img class="arw-logo" src="${escapeHtml(brandLogoUrl)}" alt="${escapeHtml(brandName)} logo">`
      : `<svg class="arw-logo" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="arwGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${escapeHtml(brandSecondary)}"></stop>
              <stop offset="100%" stop-color="${escapeHtml(brandPrimary)}"></stop>
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

          <div class="arw-filter-card">
            <div class="arw-filter-row">
              <button class="arw-filter-btn active" data-filter="all">All</button>
              <button class="arw-filter-btn" data-filter="5">5★</button>
              <button class="arw-filter-btn" data-filter="4">4★</button>
              <button class="arw-filter-btn" data-filter="3">3★</button>
              <button class="arw-filter-btn" data-filter="2">2★</button>
              <button class="arw-filter-btn" data-filter="1">1★</button>
              <button class="arw-filter-btn" id="arw-with-images-btn" data-filter="images">With Photos</button>
            </div>
          </div>

          <div id="arw-list" class="arw-list">
            <div class="arw-empty">Loading reviews...</div>
          </div>

          <div class="arw-load-wrap">
            <button id="arw-load-more" class="arw-load-more" style="display:none;">Load More</button>
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
          ${showPoweredBy ? `
            <span class="arw-powered">Powered by:</span>
            <div class="arw-brand">
              ${logoHtml}
              <span class="arw-brand-text">${escapeHtml(poweredByName)}</span>
            </div>
          ` : ``}
        </div>
      </div>
    `;
  }

  function setFilterButtonState() {
    const buttons = document.querySelectorAll(".arw-filter-btn");
    buttons.forEach((btn) => {
      btn.classList.remove("active");
      const filter = btn.getAttribute("data-filter");

      if (filter === "images" && currentWithImages) {
        btn.classList.add("active");
      } else if (filter === "all" && currentFilterRating === null && !currentWithImages) {
        btn.classList.add("active");
      } else if (currentFilterRating !== null && filter === String(currentFilterRating)) {
        btn.classList.add("active");
      }
    });
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

    const filterButtons = document.querySelectorAll(".arw-filter-btn");
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const filter = btn.getAttribute("data-filter");

        if (filter === "images") {
          currentWithImages = !currentWithImages;
          if (currentWithImages) {
            currentFilterRating = null;
          }
        } else if (filter === "all") {
          currentFilterRating = null;
          currentWithImages = false;
        } else {
          currentFilterRating = parseInt(filter, 10);
          currentWithImages = false;
        }

        setFilterButtonState();
        loadReviews(true);
      });
    });

    const loadMoreBtn = document.getElementById("arw-load-more");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", function () {
        loadReviews(false);
      });
    }

    if (!canUploadImages()) {
      const fileInput = document.getElementById("arw-image");
      if (fileInput) fileInput.style.display = "none";

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
    const signRes = await fetch(apiUrl + "/cloudinary-signature", { cache: "no-store" });
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

      const res = await fetch(apiUrl + "/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          text,
          rating: selectedRating,
          image: imageUrl,
          businessId: businessId
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

      currentFilterRating = null;
      currentWithImages = false;
      setFilterButtonState();
      await loadReviews(true);
    } catch (e) {
      alert("Error: " + (e.message || "Submission failed"));
    }

    btn.disabled = false;
    btn.textContent = "Submit Review";
  }

  function updateSummary(reviews) {
    const approved = Array.isArray(reviews) ? reviews.filter(r => r.approved === true) : [];
    const avgNumber = document.getElementById("arw-average-number");
    const avgStarsEl = document.getElementById("arw-average-stars");
    const reviewCount = document.getElementById("arw-review-count");

    if (!approved.length) {
      avgNumber.textContent = "0.0";
      avgStarsEl.textContent = "☆☆☆☆☆";
      reviewCount.textContent = "0 reviews";
      return;
    }

    const total = approved.length;
    const avg = approved.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / total;

    avgNumber.textContent = avg.toFixed(1);
    avgStarsEl.textContent = renderAverageStars(avg);
    reviewCount.textContent = total === 1 ? "1 review" : total + " reviews";
  }

  function renderReviewCard(r) {
    return `
      <div class="arw-review">
        <div class="arw-review-name">${escapeHtml(r.name || "Anonymous")}</div>
        <div class="arw-review-meta">Posted ${escapeHtml(timeAgo(r.created_at))}</div>
        <div class="arw-stars">${renderStars(r.rating)}</div>
        <div class="arw-review-text">${escapeHtml(r.text || "")}</div>
        ${r.image ? `<img src="${escapeHtml(r.image)}" alt="Review image">` : ""}
      </div>
    `;
  }

  async function loadSummary() {
    try {
      const res = await fetch(
        apiUrl + "/reviews?businessId=" + encodeURIComponent(businessId) + "&limit=100",
        { cache: "no-store" }
      );

      if (!res.ok) return;

      const data = await res.json();
      updateSummary(data);
    } catch (_) {}
  }

  async function loadReviews(reset) {
    if (isLoading) return;
    isLoading = true;

    const list = document.getElementById("arw-list");
    const loadMoreBtn = document.getElementById("arw-load-more");

    if (reset) {
      currentOffset = 0;
      list.innerHTML = `<div class="arw-empty">Loading reviews...</div>`;
    }

    let url = apiUrl + "/reviews?businessId=" + encodeURIComponent(businessId);
    url += "&limit=" + pageSize;
    url += "&offset=" + currentOffset;

    if (currentFilterRating !== null) {
      url += "&rating=" + currentFilterRating;
    }

    if (currentWithImages) {
      url += "&withImages=true";
    }

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        list.innerHTML = `<div class="arw-empty">Unable to load reviews right now.</div>`;
        loadMoreBtn.style.display = "none";
        isLoading = false;
        return;
      }

      const data = await res.json();
      const approved = Array.isArray(data) ? data.filter(r => r.approved === true) : [];

      if (reset) {
        list.innerHTML = "";
      }

      if (reset && !approved.length) {
        list.innerHTML = `<div class="arw-empty">No matching approved reviews found.</div>`;
        loadMoreBtn.style.display = "none";
        isLoading = false;
        return;
      }

      approved.forEach((r) => {
        list.insertAdjacentHTML("beforeend", renderReviewCard(r));
      });

      if (approved.length < pageSize) {
        loadMoreBtn.style.display = "none";
      } else {
        loadMoreBtn.style.display = "inline-block";
      }

      currentOffset += pageSize;
    } catch (_) {
      list.innerHTML = `<div class="arw-empty">Unable to load reviews right now.</div>`;
      loadMoreBtn.style.display = "none";
    }

    isLoading = false;
  }

  injectStyles();
  renderShell();
  wireEvents();
  setFilterButtonState();
  loadSummary();
  loadReviews(true);
})();

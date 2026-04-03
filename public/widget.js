(function () {
  const root = document.getElementById("applogix-review-widget");
  if (!root) return;

  const api = typeof ARW_API !== "undefined" ? ARW_API : "https://final-widget.onrender.com";
  const businessId = typeof BUSINESS_ID !== "undefined" ? BUSINESS_ID : "";
  const brandName = typeof BRAND_NAME !== "undefined" ? BRAND_NAME : "Your Business";
  const brandPrimary = typeof BRAND_PRIMARY !== "undefined" ? BRAND_PRIMARY : "#2563eb";
  const brandSecondary = typeof BRAND_SECONDARY !== "undefined" ? BRAND_SECONDARY : "#4ea3ff";
  const brandAccentGold = typeof BRAND_ACCENT_GOLD !== "undefined" ? BRAND_ACCENT_GOLD : "#ffd84d";
  const brandLogoUrl = typeof BRAND_LOGO_URL !== "undefined" ? BRAND_LOGO_URL : "";
  const showPoweredBy = typeof SHOW_POWERED_BY !== "undefined" ? SHOW_POWERED_BY : true;
  const poweredByName = typeof POWERED_BY_NAME !== "undefined" ? POWERED_BY_NAME : "AppLogix";
  const googleImportEnabled = typeof GOOGLE_IMPORT_ENABLED !== "undefined" ? GOOGLE_IMPORT_ENABLED : false;

  let selectedRating = 0;
  let allReviews = [];
  let activeFilter = "all";

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
        --brand-primary: ${brandPrimary};
        --brand-secondary: ${brandSecondary};
        --brand-accent-gold: ${brandAccentGold};
      }

      #applogix-review-widget .arw-card {
        background: #ffffff;
        border-radius: 28px;
        overflow: hidden;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.10);
        border: 1px solid #e5eefc;
      }

      #applogix-review-widget .arw-topbar {
        height: 58px;
        background: linear-gradient(90deg, var(--brand-secondary) 0%, var(--brand-primary) 100%);
      }

      #applogix-review-widget .arw-content {
        padding: 24px;
        background: linear-gradient(145deg, #eef5ff 0%, #f8fbff 55%, #edf4ff 100%);
      }

      #applogix-review-widget .arw-summary-card {
        background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        border-radius: 22px;
        padding: 20px;
        margin-bottom: 22px;
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.10), 0 3px 8px rgba(15, 23, 42, 0.05);
        border: 1px solid #e4eefc;
        text-align: center;
      }

      #applogix-review-widget .arw-brand-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }

      #applogix-review-widget .arw-brand-header-logo {
        width: 38px;
        height: 38px;
        object-fit: contain;
        display: none;
      }

      #applogix-review-widget .arw-brand-header-name {
        font-size: 24px;
        font-weight: 800;
        color: var(--brand-primary);
      }

      #applogix-review-widget .arw-summary-title {
        font-size: 14px;
        color: #64748b;
        margin-bottom: 10px;
        font-weight: 700;
        letter-spacing: 0.3px;
      }

      #applogix-review-widget .arw-summary-rating-row {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }

      #applogix-review-widget .arw-summary-number {
        font-size: 34px;
        font-weight: 800;
        color: var(--brand-primary);
        line-height: 1;
      }

      #applogix-review-widget .arw-summary-stars {
        font-size: 26px;
        letter-spacing: 2px;
        color: var(--brand-accent-gold);
        text-shadow:
          0 1px 0 #fff8cc,
          0 2px 0 #f7c948,
          0 3px 4px rgba(0,0,0,0.18),
          0 0 10px rgba(255,216,77,0.35);
      }

      #applogix-review-widget .arw-summary-count {
        margin-top: 10px;
        color: #64748b;
        font-size: 14px;
      }

      #applogix-review-widget .arw-filter-bar {
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 18px;
      }

      #applogix-review-widget .arw-filter-btn {
        border: 1px solid #d6e3fb;
        background: #ffffff;
        color: #334155;
        border-radius: 999px;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      #applogix-review-widget .arw-filter-btn.active {
        background: linear-gradient(180deg, var(--brand-secondary) 0%, var(--brand-primary) 100%);
        color: #ffffff;
        border-color: transparent;
        box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
      }

      #applogix-review-widget .arw-list {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
        margin-bottom: 28px;
      }

      #applogix-review-widget .arw-review {
        background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
        border-radius: 22px;
        padding: 20px;
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12), 0 3px 8px rgba(15, 23, 42, 0.06);
        border: 1px solid #e4eefc;
      }

      #applogix-review-widget .arw-review-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 8px;
      }

      #applogix-review-widget .arw-review-name {
        font-size: 18px;
        font-weight: 800;
        color: #1f2937;
      }

      #applogix-review-widget .arw-source-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        border-radius: 999px;
        padding: 5px 10px;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
      }

      #applogix-review-widget .arw-stars {
        margin-bottom: 12px;
        font-size: 22px;
        letter-spacing: 2px;
        color: var(--brand-accent-gold);
        text-shadow:
          0 1px 0 #fff8cc,
          0 2px 0 #f7c948,
          0 3px 4px rgba(0,0,0,0.18),
          0 0 10px rgba(255,216,77,0.35);
      }

      #applogix-review-widget .arw-review-text {
        line-height: 1.6;
        color: #334155;
      }

      #applogix-review-widget .arw-review img {
        width: 100%;
        display: block;
        border-radius: 16px;
        margin-top: 12px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
      }

      #applogix-review-widget .arw-empty {
        grid-column: 1 / -1;
        text-align: center;
        background: #fff;
        padding: 24px;
        border-radius: 20px;
        color: #64748b;
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
      }

      #applogix-review-widget .arw-form-card {
        background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12), 0 3px 8px rgba(15, 23, 42, 0.06);
        border: 1px solid #e4eefc;
      }

      #applogix-review-widget .arw-subtitle {
        margin: 0 0 16px;
        font-size: 24px;
        font-weight: 800;
        color: var(--brand-primary);
      }

      #applogix-review-widget .arw-input,
      #applogix-review-widget .arw-file {
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 13px;
        padding: 13px 15px;
        border-radius: 16px;
        border: 1px solid #cfdcf3;
        background: #f9fbff;
        font-size: 15px;
        color: #1f2937;
        box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
      }

      #applogix-review-widget .arw-input:focus,
      #applogix-review-widget .arw-file:focus {
        outline: none;
        border-color: var(--brand-secondary);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
      }

      #applogix-review-widget .arw-textarea {
        min-height: 130px;
        resize: vertical;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 17px;
        font-style: italic;
        color: #475569;
        margin-top: 14px;
      }

      #applogix-review-widget .arw-textarea::placeholder {
        font-family: Georgia, "Times New Roman", serif;
        font-style: italic;
        color: #7c8aa0;
      }

      #applogix-review-widget .arw-rating-block {
        margin-bottom: 14px;
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid #cfdcf3;
        background: #f9fbff;
        box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
      }

      #applogix-review-widget .arw-rating-label {
        font-size: 15px;
        font-weight: 700;
        color: #334155;
        margin-bottom: 10px;
      }

      #applogix-review-widget .arw-star-picker {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      #applogix-review-widget .arw-star-btn {
        border: none;
        background: transparent;
        font-size: 32px;
        line-height: 1;
        cursor: pointer;
        padding: 4px;
        border-radius: 14px;
        color: #d7dce5;
        transition: transform 0.12s ease, filter 0.12s ease, color 0.12s ease;
      }

      #applogix-review-widget .arw-star-btn:hover {
        transform: scale(1.08);
      }

      #applogix-review-widget .arw-star-btn.active {
        color: var(--brand-accent-gold);
        text-shadow:
          0 1px 0 #fff8cc,
          0 2px 0 #f7c948,
          0 3px 4px rgba(0,0,0,0.18),
          0 0 10px rgba(255,216,77,0.35);
        filter: saturate(1.18);
      }

      #applogix-review-widget .arw-button {
        width: 100%;
        border: none;
        border-radius: 16px;
        padding: 15px 18px;
        background: linear-gradient(180deg, var(--brand-secondary) 0%, var(--brand-primary) 100%);
        color: #ffffff;
        font-size: 16px;
        font-weight: 800;
        cursor: pointer;
        transition: transform 0.1s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        box-shadow: 0 10px 20px rgba(37, 99, 235, 0.24);
      }

      #applogix-review-widget .arw-button:hover {
        box-shadow: 0 14px 24px rgba(37, 99, 235, 0.30);
      }

      #applogix-review-widget .arw-button:active {
        transform: translateY(1px);
      }

      #applogix-review-widget .arw-button:disabled {
        opacity: 0.72;
        cursor: not-allowed;
      }

      #applogix-review-widget .arw-note {
        margin-top: 12px;
        font-size: 13px;
        color: #64748b;
      }

      #applogix-review-widget .arw-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
        padding: 14px 20px;
        background: #ffffff;
        border-top: 1px solid #e5eefc;
      }

      #applogix-review-widget .arw-powered {
        color: #6b7280;
        font-size: 13px;
      }

      #applogix-review-widget .arw-brand {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      #applogix-review-widget .arw-logo {
        width: 22px;
        height: 22px;
        display: block;
      }

      #applogix-review-widget .arw-logo-img {
        width: 22px;
        height: 22px;
        object-fit: contain;
        display: none;
      }

      #applogix-review-widget .arw-brand-text {
        font-size: 14px;
        font-weight: 800;
        color: #1f2937;
      }

      @media (max-width: 900px) {
        #applogix-review-widget .arw-list {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 640px) {
        #applogix-review-widget .arw-content {
          padding: 18px;
        }

        #applogix-review-widget .arw-list {
          grid-template-columns: 1fr;
        }

        #applogix-review-widget .arw-subtitle {
          font-size: 22px;
        }

        #applogix-review-widget .arw-star-btn {
          font-size: 30px;
        }

        #applogix-review-widget .arw-footer {
          justify-content: center;
        }

        #applogix-review-widget .arw-summary-number {
          font-size: 30px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function mountWidget() {
    root.innerHTML = `
      <div class="arw-card">
        <div class="arw-topbar"></div>

        <div class="arw-content">
          <div class="arw-summary-card">
            <div class="arw-brand-header">
              <img id="arw-header-logo" class="arw-brand-header-logo" alt="Business logo">
              <div class="arw-brand-header-name">${escapeHtml(brandName)}</div>
            </div>

            <div class="arw-summary-title">Customer Rating</div>
            <div class="arw-summary-rating-row">
              <div class="arw-summary-number" id="arw-average-number">0.0</div>
              <div class="arw-summary-stars" id="arw-average-stars">☆☆☆☆☆</div>
            </div>
            <div class="arw-summary-count" id="arw-review-count">0 reviews</div>

            <div class="arw-filter-bar">
              <button class="arw-filter-btn active" id="arw-filter-all" type="button">All</button>
              <button class="arw-filter-btn" id="arw-filter-widget" type="button">Website Reviews</button>
              ${googleImportEnabled ? `<button class="arw-filter-btn" id="arw-filter-google" type="button">Google Reviews</button>` : ``}
            </div>
          </div>

          <div id="arw-list" class="arw-list"></div>

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

            <button id="arw-submit" class="arw-button" type="button">Submit Review</button>

            <div class="arw-note">Reviews are submitted for spam screening before appearing on the site.</div>
          </div>
        </div>

        <div class="arw-footer" id="arw-footer">
          <span class="arw-powered">Powered by:</span>
          <div class="arw-brand">
            <svg id="arw-default-footer-logo" class="arw-logo" viewBox="0 0 64 64" aria-hidden="true">
              <defs>
                <linearGradient id="arwGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#4ea3ff"></stop>
                  <stop offset="100%" stop-color="#2156d8"></stop>
                </linearGradient>
              </defs>
              <polygon points="23,7 39,28 18,35" fill="url(#arwGrad1)"></polygon>
              <polygon points="41,23 54,47 35,47 28,34" fill="url(#arwGrad1)"></polygon>
              <polygon points="22,37 33,47 16,47" fill="url(#arwGrad1)"></polygon>
            </svg>
            <img id="arw-footer-logo-img" class="arw-logo-img" alt="Powered by logo">
            <span class="arw-brand-text">${escapeHtml(poweredByName)}</span>
          </div>
        </div>
      </div>
    `;

    if (brandLogoUrl) {
      const headerLogo = root.querySelector("#arw-header-logo");
      if (headerLogo) {
        headerLogo.src = brandLogoUrl;
        headerLogo.style.display = "block";
      }
    }

    if (!showPoweredBy) {
      const footer = root.querySelector("#arw-footer");
      if (footer) footer.style.display = "none";
    } else if (brandLogoUrl && poweredByName !== "AppLogix") {
      const defaultLogo = root.querySelector("#arw-default-footer-logo");
      const footerLogo = root.querySelector("#arw-footer-logo-img");
      if (defaultLogo) defaultLogo.style.display = "none";
      if (footerLogo) {
        footerLogo.src = brandLogoUrl;
        footerLogo.style.display = "block";
      }
    }

    bindEvents();
  }

  function bindEvents() {
    for (let i = 1; i <= 5; i++) {
      const btn = root.querySelector("#arw-star-" + i);
      if (btn) btn.addEventListener("click", function () { setRating(i); });
    }

    const filterAll = root.querySelector("#arw-filter-all");
    const filterWidget = root.querySelector("#arw-filter-widget");
    const filterGoogle = root.querySelector("#arw-filter-google");
    const submitBtn = root.querySelector("#arw-submit");

    if (filterAll) filterAll.addEventListener("click", function () { setFilter("all"); });
    if (filterWidget) filterWidget.addEventListener("click", function () { setFilter("widget"); });
    if (googleImportEnabled && filterGoogle) {
      filterGoogle.addEventListener("click", function () { setFilter("google"); });
    }
    if (submitBtn) submitBtn.addEventListener("click", submitReview);
  }

  function setRating(value) {
    selectedRating = value;
    for (let i = 1; i <= 5; i++) {
      const star = root.querySelector("#arw-star-" + i);
      if (star) {
        star.classList.toggle("active", i <= value);
      }
    }
  }

  function renderAverageStars(avg) {
    const rounded = Math.round(avg);
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
  }

  function normalizeSource(review) {
    if (review.source === "google") return "google";
    return "widget";
  }

  function setFilter(filter) {
    if (filter === "google" && !googleImportEnabled) {
      return;
    }

    activeFilter = filter;

    const allBtn = root.querySelector("#arw-filter-all");
    const widgetBtn = root.querySelector("#arw-filter-widget");
    const googleBtn = root.querySelector("#arw-filter-google");

    if (allBtn) allBtn.classList.toggle("active", filter === "all");
    if (widgetBtn) widgetBtn.classList.toggle("active", filter === "widget");
    if (googleBtn) googleBtn.classList.toggle("active", filter === "google");

    renderReviews();
  }

  function renderReviews() {
    const list = root.querySelector("#arw-list");
    if (!list) return;

    if (!allReviews.length) {
      list.innerHTML = `<div class="arw-empty">No approved reviews yet.</div>`;
      return;
    }

    let visible = allReviews;

    if (activeFilter !== "all") {
      visible = allReviews.filter(function (r) {
        return normalizeSource(r) === activeFilter;
      });
    }

    if (!visible.length) {
      list.innerHTML = `<div class="arw-empty">No reviews found for this filter.</div>`;
      return;
    }

    list.innerHTML = visible.map(function (r) {
      const sourceBadge = normalizeSource(r) === "google"
        ? `<div class="arw-source-badge">Verified Google Review</div>`
        : ``;

      return `
        <div class="arw-review">
          <div class="arw-review-top">
            <div class="arw-review-name">${escapeHtml(r.name || "Anonymous")}</div>
            ${sourceBadge}
          </div>
          <div class="arw-stars">${"★".repeat(r.rating || 0)}${"☆".repeat(5 - (r.rating || 0))}</div>
          <div class="arw-review-text">${escapeHtml(r.text || "")}</div>
          ${r.image ? `<img src="${escapeAttribute(r.image)}" alt="Review image">` : ""}
        </div>
      `;
    }).join("");
  }

  async function uploadToCloudinary(file) {
    const signRes = await fetch(api + "/cloudinary-signature");
    if (!signRes.ok) throw new Error("Could not prepare image upload");

    const signData = await signRes.json();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signData.apiKey);
    formData.append("timestamp", signData.timestamp);
    formData.append("folder", signData.folder);
    formData.append("signature", signData.signature);

    const uploadRes = await fetch("https://api.cloudinary.com/v1_1/" + signData.cloudName + "/image/upload", {
      method: "POST",
      body: formData
    });

    if (!uploadRes.ok) {
      const txt = await uploadRes.text();
      throw new Error(txt || "Image upload failed");
    }

    const uploadData = await uploadRes.json();
    return uploadData.secure_url;
  }

  async function submitReview() {
    const btn = root.querySelector("#arw-submit");
    const name = root.querySelector("#arw-name").value;
    const text = root.querySelector("#arw-text").value;
    const fileInput = root.querySelector("#arw-image");
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!businessId) {
      alert("Missing business ID.");
      return;
    }

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

      const res = await fetch(api + "/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name,
          text: text,
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

      alert("Review submitted! Awaiting spam screening.");

      root.querySelector("#arw-name").value = "";
      root.querySelector("#arw-text").value = "";
      if (fileInput) fileInput.value = "";
      setRating(0);
      loadReviews();
    } catch (e) {
      alert("Error: " + (e.message || "Submission failed"));
    }

    btn.disabled = false;
    btn.textContent = "Submit Review";
  }

  async function loadReviews() {
    try {
      const res = await fetch(api + "/reviews?businessId=" + encodeURIComponent(businessId));
      const data = await res.json();

      const approved = Array.isArray(data) ? data.filter(function (r) { return r.approved === true; }) : [];
      allReviews = approved;

      const avgNumber = root.querySelector("#arw-average-number");
      const avgStars = root.querySelector("#arw-average-stars");
      const reviewCount = root.querySelector("#arw-review-count");
      const list = root.querySelector("#arw-list");

      if (!approved.length) {
        if (avgNumber) avgNumber.textContent = "0.0";
        if (avgStars) avgStars.textContent = "☆☆☆☆☆";
        if (reviewCount) reviewCount.textContent = "0 reviews";
        if (list) list.innerHTML = `<div class="arw-empty">No approved reviews yet.</div>`;
        return;
      }

      const total = approved.length;
      const avg = approved.reduce(function (sum, r) {
        return sum + (Number(r.rating) || 0);
      }, 0) / total;

      if (avgNumber) avgNumber.textContent = avg.toFixed(1);
      if (avgStars) avgStars.textContent = renderAverageStars(avg);
      if (reviewCount) reviewCount.textContent = total === 1 ? "1 review" : total + " reviews";

      renderReviews();
    } catch (e) {
      const avgNumber = root.querySelector("#arw-average-number");
      const avgStars = root.querySelector("#arw-average-stars");
      const reviewCount = root.querySelector("#arw-review-count");
      const list = root.querySelector("#arw-list");

      if (avgNumber) avgNumber.textContent = "0.0";
      if (avgStars) avgStars.textContent = "☆☆☆☆☆";
      if (reviewCount) reviewCount.textContent = "Unable to load";
      if (list) list.innerHTML = `<div class="arw-empty">Unable to load reviews right now.</div>`;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return String(value).replace(/"/g, "&quot;");
  }

  injectStyles();
  mountWidget();
  loadReviews();
})();

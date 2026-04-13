(function () {
  const API = window.ARW_API;
  const BUSINESS_ID = window.BUSINESS_ID;

  let offset = 0;
  let limit = 10;
  let currentRating = null;
  let withImages = false;
  let loading = false;

  const root = document.getElementById("applogix-review-widget");

  if (!root) return;

  root.innerHTML = `
    <div id="arw-container" style="font-family: Arial; max-width: 600px;">
      
      <div id="arw-filters" style="margin-bottom:10px;">
        <button data-rating="">All</button>
        <button data-rating="5">5★</button>
        <button data-rating="4">4★</button>
        <button data-rating="3">3★</button>
        <button data-rating="2">2★</button>
        <button data-rating="1">1★</button>
        <button id="arw-images-toggle">With Photos</button>
      </div>

      <div id="arw-list"></div>

      <button id="arw-load-more" style="margin-top:10px;">Load More</button>
    </div>
  `;

  const list = document.getElementById("arw-list");
  const loadMoreBtn = document.getElementById("arw-load-more");
  const imageToggle = document.getElementById("arw-images-toggle");

  function timeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);

    const intervals = [
      { label: "year", seconds: 31536000 },
      { label: "month", seconds: 2592000 },
      { label: "week", seconds: 604800 },
      { label: "day", seconds: 86400 },
      { label: "hour", seconds: 3600 },
      { label: "minute", seconds: 60 }
    ];

    for (let i of intervals) {
      const count = Math.floor(seconds / i.seconds);
      if (count > 0) {
        return `${count} ${i.label}${count > 1 ? "s" : ""} ago`;
      }
    }

    return "Just now";
  }

  function renderReview(r) {
    return `
      <div style="border-bottom:1px solid #eee; padding:10px 0;">
        <strong>${r.name}</strong> 
        <span>(${r.rating}★)</span>
        <div style="font-size:12px; color:#666;">${timeAgo(r.created_at)}</div>
        <p>${r.text || ""}</p>
        ${r.image ? `<img src="${r.image}" style="max-width:100%; border-radius:8px;" />` : ""}
      </div>
    `;
  }

  async function loadReviews(reset = false) {
    if (loading) return;
    loading = true;

    if (reset) {
      offset = 0;
      list.innerHTML = "";
    }

    let url = `${API}/reviews?businessId=${BUSINESS_ID}&limit=${limit}&offset=${offset}`;

    if (currentRating) {
      url += `&rating=${currentRating}`;
    }

    if (withImages) {
      url += `&withImages=true`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.length < limit) {
        loadMoreBtn.style.display = "none";
      } else {
        loadMoreBtn.style.display = "block";
      }

      data.forEach(r => {
        list.innerHTML += renderReview(r);
      });

      offset += limit;

    } catch (err) {
      console.error("Widget load error:", err);
    }

    loading = false;
  }

  // Rating filter buttons
  document.querySelectorAll("#arw-filters button[data-rating]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentRating = btn.getAttribute("data-rating") || null;
      loadReviews(true);
    });
  });

  // Image toggle
  imageToggle.addEventListener("click", () => {
    withImages = !withImages;
    imageToggle.style.background = withImages ? "#ddd" : "";
    loadReviews(true);
  });

  // Load more
  loadMoreBtn.addEventListener("click", () => {
    loadReviews(false);
  });

  // Initial load
  loadReviews(true);

})();

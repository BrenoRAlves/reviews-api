const responseOutput = document.getElementById("responseOutput");
const productsContainer = document.getElementById("products");
const reviewsContainer = document.getElementById("reviews");
const summaryResult = document.getElementById("summaryResult");

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body && body.message ? body.message : "Request failed";
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showResponse(label, data) {
  responseOutput.textContent = `${label}\n\n${JSON.stringify(data, null, 2)}`;
}

function showError(label, error) {
  responseOutput.textContent = `${label}\n\nStatus: ${error.status || "unknown"}\nMessage: ${error.message}\n\n${JSON.stringify(error.body || {}, null, 2)}`;
}

function renderProducts(products) {
  if (!products.length) {
    productsContainer.textContent = "No products found.";
    productsContainer.className = "card-grid empty-state";
    return;
  }

  productsContainer.className = "card-grid";
  productsContainer.innerHTML = products.map((product) => `
    <article class="product-card">
      <h3>${escapeHtml(product.name)}</h3>
      <p class="meta">${escapeHtml(product.category || "No category")} · €${Number(product.price).toFixed(2)}</p>
      <div class="metric-row">
        <span class="metric">Average: ${product.averageRating}</span>
        <span class="metric">Approved reviews: ${product.approvedReviewCount}</span>
      </div>
      <div class="review-actions">
        <button type="button" class="secondary" data-summary-product-id="${product.id}">Summary</button>
        <button type="button" class="secondary" data-reviews-product-id="${product.id}">Approved reviews</button>
      </div>
    </article>
  `).join("");
}

function renderReviews(reviews) {
  if (!reviews.length) {
    reviewsContainer.textContent = "No reviews found for this status.";
    reviewsContainer.className = "review-list empty-state";
    return;
  }

  reviewsContainer.className = "review-list";
  reviewsContainer.innerHTML = reviews.map((review) => `
    <article class="review-card">
      <div class="section-title">
        <div>
          <h3>Review #${review.id}</h3>
          <p class="meta">${escapeHtml(review.productName || "Product")} · ${escapeHtml(review.userName || "User")} · orderItemId ${review.orderItemId}</p>
        </div>
        <span class="chip ${review.status}">${review.status}</span>
      </div>
      <p><strong>Rating:</strong> ${review.rating}</p>
      <p><strong>Comment:</strong> ${escapeHtml(review.comment)}</p>
      <div class="metric-row">
        <span class="chip">Sentiment: ${escapeHtml(review.sentiment || "n/a")}</span>
        <span class="chip">Topic: ${escapeHtml(review.topic || "n/a")}</span>
        <span class="chip">Urgency: ${escapeHtml(review.urgency || "n/a")}</span>
      </div>
      <p class="meta"><strong>Summary:</strong> ${escapeHtml(review.summary || "No analysis")}</p>
      <div class="review-actions">
        ${review.status === "pending" ? `
          <button type="button" data-approve-id="${review.id}">Approve</button>
          <button type="button" class="danger" data-reject-id="${review.id}">Reject</button>
          <button type="button" class="secondary" data-edit-id="${review.id}" data-rating="${review.rating}" data-comment="${encodeURIComponent(review.comment)}">Use for edit</button>
        ` : ""}
      </div>
    </article>
  `).join("");
}

function renderSummary(summary) {
  summaryResult.className = "result-card";
  summaryResult.innerHTML = `
    <p><strong>Product:</strong> ${escapeHtml(summary.productName)}</p>
    <p><strong>Approved reviews:</strong> ${summary.approvedReviewCount}</p>
    <p><strong>Rating sum:</strong> ${summary.approvedRatingSum}</p>
    <p><strong>Average rating:</strong> ${summary.averageRating}</p>
  `;
}

async function loadProducts() {
  try {
    const data = await apiRequest("/api/products");
    renderProducts(data.data);
    showResponse("GET /api/products", data);
  } catch (error) {
    showError("GET /api/products failed", error);
  }
}

async function loadReviews() {
  const status = document.getElementById("statusFilter").value;
  const path = status ? `/api/reviews?status=${status}` : "/api/reviews";

  try {
    const data = await apiRequest(path);
    renderReviews(data.data);
    showResponse(`GET ${path}`, data);
  } catch (error) {
    showError(`GET ${path} failed`, error);
  }
}

async function loadProductSummary(productId) {
  try {
    const data = await apiRequest(`/api/products/${productId}/review-summary`);
    renderSummary(data.data);
    showResponse(`GET /api/products/${productId}/review-summary`, data);
  } catch (error) {
    showError(`GET /api/products/${productId}/review-summary failed`, error);
  }
}

async function loadApprovedProductReviews(productId) {
  try {
    const data = await apiRequest(`/api/products/${productId}/reviews`);
    showResponse(`GET /api/products/${productId}/reviews`, data);
  } catch (error) {
    showError(`GET /api/products/${productId}/reviews failed`, error);
  }
}

async function approveReview(reviewId) {
  try {
    const data = await apiRequest(`/api/reviews/${reviewId}/approve`, { method: "PATCH" });
    showResponse(`PATCH /api/reviews/${reviewId}/approve`, data);
    await loadReviews();
    await loadProducts();
  } catch (error) {
    showError(`PATCH /api/reviews/${reviewId}/approve failed`, error);
  }
}

async function rejectReview(reviewId) {
  try {
    const data = await apiRequest(`/api/reviews/${reviewId}/reject`, { method: "PATCH" });
    showResponse(`PATCH /api/reviews/${reviewId}/reject`, data);
    await loadReviews();
  } catch (error) {
    showError(`PATCH /api/reviews/${reviewId}/reject failed`, error);
  }
}

document.getElementById("healthButton").addEventListener("click", async () => {
  try {
    const data = await apiRequest("/api/health");
    showResponse("GET /api/health", data);
  } catch (error) {
    showError("GET /api/health failed", error);
  }
});

document.getElementById("loadProductsButton").addEventListener("click", loadProducts);
document.getElementById("loadReviewsButton").addEventListener("click", loadReviews);

document.getElementById("createReviewForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    orderItemId: Number(document.getElementById("orderItemId").value),
    rating: Number(document.getElementById("createRating").value),
    comment: document.getElementById("createComment").value
  };

  try {
    const data = await apiRequest("/api/reviews", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    document.getElementById("updateReviewId").value = data.data.id;
    document.getElementById("statusFilter").value = "pending";
    showResponse("POST /api/reviews", data);
    await loadReviews();
  } catch (error) {
    showError("POST /api/reviews failed", error);
  }
});

document.getElementById("updateReviewForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const reviewId = Number(document.getElementById("updateReviewId").value);
  const payload = {
    rating: Number(document.getElementById("updateRating").value),
    comment: document.getElementById("updateComment").value
  };

  try {
    const data = await apiRequest(`/api/reviews/${reviewId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    showResponse(`PUT /api/reviews/${reviewId}`, data);
    await loadReviews();
  } catch (error) {
    showError(`PUT /api/reviews/${reviewId} failed`, error);
  }
});

document.getElementById("summaryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const productId = Number(document.getElementById("summaryProductId").value);
  await loadProductSummary(productId);
});

productsContainer.addEventListener("click", async (event) => {
  const summaryProductId = event.target.dataset.summaryProductId;
  const reviewsProductId = event.target.dataset.reviewsProductId;

  if (summaryProductId) {
    document.getElementById("summaryProductId").value = summaryProductId;
    await loadProductSummary(summaryProductId);
  }

  if (reviewsProductId) {
    await loadApprovedProductReviews(reviewsProductId);
  }
});

reviewsContainer.addEventListener("click", async (event) => {
  const approveId = event.target.dataset.approveId;
  const rejectId = event.target.dataset.rejectId;
  const editId = event.target.dataset.editId;

  if (approveId) {
    await approveReview(approveId);
  }

  if (rejectId) {
    await rejectReview(rejectId);
  }

  if (editId) {
    document.getElementById("updateReviewId").value = editId;
    document.getElementById("updateRating").value = event.target.dataset.rating;
    document.getElementById("updateComment").value = decodeURIComponent(event.target.dataset.comment);
    showResponse("Loaded review into edit form", { reviewId: Number(editId) });
  }
});

loadProducts();
loadReviews();

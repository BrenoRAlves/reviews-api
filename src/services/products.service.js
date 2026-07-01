const { db } = require("../database");

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getAllProducts() {
  return db.prepare(`
    SELECT
      products.id,
      products.name,
      products.category,
      products.price,
      COALESCE(product_review_summary.approved_rating_sum, 0) AS approvedRatingSum,
      COALESCE(product_review_summary.approved_review_count, 0) AS approvedReviewCount
    FROM products
    LEFT JOIN product_review_summary ON products.id = product_review_summary.product_id
    ORDER BY products.id
  `).all().map((product) => ({
    ...product,
    averageRating: product.approvedReviewCount === 0
      ? 0
      : Number((product.approvedRatingSum / product.approvedReviewCount).toFixed(2))
  }));
}

function getProductReviewSummary(productId) {
  const product = db.prepare(`
    SELECT id, name
    FROM products
    WHERE id = ?
  `).get(productId);

  if (!product) {
    throw createHttpError(404, "Product not found");
  }

  const summary = db.prepare(`
    SELECT
      product_id AS productId,
      approved_rating_sum AS approvedRatingSum,
      approved_review_count AS approvedReviewCount,
      updated_at AS updatedAt
    FROM product_review_summary
    WHERE product_id = ?
  `).get(productId);

  const approvedRatingSum = summary ? summary.approvedRatingSum : 0;
  const approvedReviewCount = summary ? summary.approvedReviewCount : 0;

  return {
    productId: product.id,
    productName: product.name,
    approvedRatingSum,
    approvedReviewCount,
    averageRating: approvedReviewCount === 0
      ? 0
      : Number((approvedRatingSum / approvedReviewCount).toFixed(2)),
    updatedAt: summary ? summary.updatedAt : null
  };
}

function getApprovedReviewsByProduct(productId) {
  const product = db.prepare(`
    SELECT id
    FROM products
    WHERE id = ?
  `).get(productId);

  if (!product) {
    throw createHttpError(404, "Product not found");
  }

  return db.prepare(`
    SELECT
      reviews.id,
      reviews.rating,
      reviews.comment,
      reviews.status,
      reviews.created_at AS createdAt,
      users.name AS userName,
      review_analysis.sentiment,
      review_analysis.topic,
      review_analysis.urgency,
      review_analysis.summary
    FROM reviews
    JOIN order_items ON reviews.order_item_id = order_items.id
    JOIN orders ON order_items.order_id = orders.id
    JOIN users ON orders.user_id = users.id
    LEFT JOIN review_analysis ON reviews.id = review_analysis.review_id
    WHERE order_items.product_id = ?
      AND reviews.status = 'approved'
    ORDER BY reviews.created_at DESC
  `).all(productId);
}

module.exports = {
  getAllProducts,
  getProductReviewSummary,
  getApprovedReviewsByProduct
};

const { db } = require("../database");
const analysisService = require("./analysis.service");

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getOrderItemContext(orderItemId) {
  return db.prepare(`
    SELECT
      order_items.id AS order_item_id,
      order_items.product_id,
      products.name AS product_name,
      orders.id AS order_id,
      orders.user_id,
      orders.status AS order_status,
      users.name AS user_name
    FROM order_items
    JOIN orders ON order_items.order_id = orders.id
    JOIN products ON order_items.product_id = products.id
    JOIN users ON orders.user_id = users.id
    WHERE order_items.id = ?
  `).get(orderItemId);
}

function getReviewWithDetails(reviewId) {
  return db.prepare(`
    SELECT
      reviews.id,
      reviews.order_item_id AS orderItemId,
      reviews.rating,
      reviews.comment,
      reviews.status,
      reviews.created_at AS createdAt,
      reviews.updated_at AS updatedAt,
      order_items.product_id AS productId,
      products.name AS productName,
      orders.user_id AS userId,
      users.name AS userName,
      review_analysis.sentiment,
      review_analysis.topic,
      review_analysis.urgency,
      review_analysis.summary
    FROM reviews
    JOIN order_items ON reviews.order_item_id = order_items.id
    JOIN products ON order_items.product_id = products.id
    JOIN orders ON order_items.order_id = orders.id
    JOIN users ON orders.user_id = users.id
    LEFT JOIN review_analysis ON reviews.id = review_analysis.review_id
    WHERE reviews.id = ?
  `).get(reviewId);
}

function createReview(reviewData) {
  const { orderItemId, rating, comment } = reviewData;

  const context = getOrderItemContext(orderItemId);

  if (!context) {
    throw createHttpError(404, "Order item not found");
  }

  if (context.order_status !== "completed") {
    throw createHttpError(400, "Only completed orders can be reviewed");
  }

  const existingReview = db.prepare(`
    SELECT id
    FROM reviews
    WHERE order_item_id = ?
  `).get(orderItemId);

  if (existingReview) {
    throw createHttpError(409, "This order item has already been reviewed");
  }

  const analysis = analysisService.analyseReview(comment);

  db.exec("BEGIN TRANSACTION");

  try {
    const reviewResult = db.prepare(`
      INSERT INTO reviews (
        order_item_id,
        rating,
        comment,
        status
      )
      VALUES (?, ?, ?, 'pending')
    `).run(orderItemId, rating, comment);

    const reviewId = reviewResult.lastInsertRowid;

    db.prepare(`
      INSERT INTO review_analysis (
        review_id,
        sentiment,
        topic,
        urgency,
        summary
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      reviewId,
      analysis.sentiment,
      analysis.topic,
      analysis.urgency,
      analysis.summary
    );

    db.exec("COMMIT");

    return getReviewWithDetails(reviewId);
  } catch (error) {
    db.exec("ROLLBACK");

    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw createHttpError(409, "This order item has already been reviewed");
    }

    throw error;
  }
}

function getAllReviews(status) {
  const allowedStatuses = ["pending", "approved", "rejected"];

  if (status !== undefined && !allowedStatuses.includes(status)) {
    throw createHttpError(400, "Status must be one of: pending, approved, rejected");
  }

  const whereClause = status ? "WHERE reviews.status = ?" : "";
  const query = `
    SELECT
      reviews.id,
      reviews.order_item_id AS orderItemId,
      reviews.rating,
      reviews.comment,
      reviews.status,
      reviews.created_at AS createdAt,
      reviews.updated_at AS updatedAt,
      order_items.product_id AS productId,
      products.name AS productName,
      orders.user_id AS userId,
      users.name AS userName,
      review_analysis.sentiment,
      review_analysis.topic,
      review_analysis.urgency,
      review_analysis.summary
    FROM reviews
    JOIN order_items ON reviews.order_item_id = order_items.id
    JOIN products ON order_items.product_id = products.id
    JOIN orders ON order_items.order_id = orders.id
    JOIN users ON orders.user_id = users.id
    LEFT JOIN review_analysis ON reviews.id = review_analysis.review_id
    ${whereClause}
    ORDER BY reviews.id DESC
  `;

  return status
    ? db.prepare(query).all(status)
    : db.prepare(query).all();
}

function getReviewById(reviewId) {
  const review = getReviewWithDetails(reviewId);

  if (!review) {
    throw createHttpError(404, "Review not found");
  }

  return review;
}

function updateReview(reviewId, reviewData) {
  const { rating, comment } = reviewData;
  const analysis = analysisService.analyseReview(comment);

  db.exec("BEGIN TRANSACTION");

  try {
    const updateResult = db.prepare(`
      UPDATE reviews
      SET
        rating = ?,
        comment = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `).run(rating, comment, reviewId);

    if (updateResult.changes === 0) {
      const review = db.prepare(`
        SELECT status
        FROM reviews
        WHERE id = ?
      `).get(reviewId);

      if (!review) {
        throw createHttpError(404, "Review not found");
      }

      throw createHttpError(409, `Review cannot be edited because its status is '${review.status}'`);
    }

    db.prepare(`
      UPDATE review_analysis
      SET
        sentiment = ?,
        topic = ?,
        urgency = ?,
        summary = ?,
        created_at = CURRENT_TIMESTAMP
      WHERE review_id = ?
    `).run(
      analysis.sentiment,
      analysis.topic,
      analysis.urgency,
      analysis.summary,
      reviewId
    );

    db.exec("COMMIT");

    return getReviewWithDetails(reviewId);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function approveReview(reviewId) {
  db.exec("BEGIN TRANSACTION");

  try {
    const updateResult = db.prepare(`
      UPDATE reviews
      SET
        status = 'approved',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `).run(reviewId);

    if (updateResult.changes === 0) {
      const review = db.prepare(`
        SELECT status
        FROM reviews
        WHERE id = ?
      `).get(reviewId);

      if (!review) {
        throw createHttpError(404, "Review not found");
      }

      throw createHttpError(409, `Review cannot be approved because its status is '${review.status}'`);
    }

    const review = db.prepare(`
      SELECT
        reviews.rating,
        order_items.product_id
      FROM reviews
      JOIN order_items ON reviews.order_item_id = order_items.id
      WHERE reviews.id = ?
    `).get(reviewId);

    db.prepare(`
      INSERT INTO product_review_summary (
        product_id,
        approved_rating_sum,
        approved_review_count
      )
      VALUES (?, ?, 1)
      ON CONFLICT(product_id)
      DO UPDATE SET
        approved_rating_sum = approved_rating_sum + excluded.approved_rating_sum,
        approved_review_count = approved_review_count + 1,
        updated_at = CURRENT_TIMESTAMP
    `).run(review.product_id, review.rating);

    db.exec("COMMIT");

    return getReviewWithDetails(reviewId);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function rejectReview(reviewId) {
  const updateResult = db.prepare(`
    UPDATE reviews
    SET
      status = 'rejected',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'pending'
  `).run(reviewId);

  if (updateResult.changes === 0) {
    const review = db.prepare(`
      SELECT status
      FROM reviews
      WHERE id = ?
    `).get(reviewId);

    if (!review) {
      throw createHttpError(404, "Review not found");
    }

    throw createHttpError(409, `Review cannot be rejected because its status is '${review.status}'`);
  }

  return getReviewWithDetails(reviewId);
}

module.exports = {
  createReview,
  getAllReviews,
  getReviewById,
  updateReview,
  approveReview,
  rejectReview
};

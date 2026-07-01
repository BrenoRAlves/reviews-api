function validateRating(rating, res) {
  if (!Number.isInteger(rating)) {
    res.status(400).json({
      message: "Rating must be an integer"
    });
    return false;
  }

  if (rating < 1 || rating > 5) {
    res.status(400).json({
      message: "Rating must be between 1 and 5"
    });
    return false;
  }

  return true;
}

function validateComment(comment, res) {
  if (typeof comment !== "string" || comment.trim().length === 0) {
    res.status(400).json({
      message: "Comment must be a non-empty string"
    });
    return false;
  }

  if (comment.length > 1000) {
    res.status(400).json({
      message: "Comment must be 1000 characters or less"
    });
    return false;
  }

  return true;
}

function validateCreateReview(req, res, next) {
  const { orderItemId, rating, comment } = req.body;

  if (orderItemId === undefined) {
    return res.status(400).json({
      message: "orderItemId is required"
    });
  }

  if (!Number.isInteger(orderItemId)) {
    return res.status(400).json({
      message: "orderItemId must be an integer"
    });
  }

  if (rating === undefined) {
    return res.status(400).json({
      message: "Rating is required"
    });
  }

  if (!validateRating(rating, res)) {
    return;
  }

  if (comment === undefined) {
    return res.status(400).json({
      message: "Comment is required"
    });
  }

  if (!validateComment(comment, res)) {
    return;
  }

  req.body.comment = comment.trim();

  next();
}

function validateUpdateReview(req, res, next) {
  const { rating, comment } = req.body;

  if (rating === undefined) {
    return res.status(400).json({
      message: "Rating is required"
    });
  }

  if (!validateRating(rating, res)) {
    return;
  }

  if (comment === undefined) {
    return res.status(400).json({
      message: "Comment is required"
    });
  }

  if (!validateComment(comment, res)) {
    return;
  }

  req.body.comment = comment.trim();

  next();
}

module.exports = {
  validateCreateReview,
  validateUpdateReview
};

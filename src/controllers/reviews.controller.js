const reviewsService = require("../services/reviews.service");

function createReview(req, res, next) {
  try {
    const review = reviewsService.createReview(req.body);

    res.status(201).json({
      message: "Review created successfully",
      data: review
    });
  } catch (error) {
    next(error);
  }
}

function getAllReviews(req, res, next) {
  try {
    const reviews = reviewsService.getAllReviews(req.query.status);

    res.status(200).json({
      data: reviews
    });
  } catch (error) {
    next(error);
  }
}

function getReviewById(req, res, next) {
  try {
    const review = reviewsService.getReviewById(req.params.id);

    res.status(200).json({
      data: review
    });
  } catch (error) {
    next(error);
  }
}

function updateReview(req, res, next) {
  try {
    const review = reviewsService.updateReview(req.params.id, req.body);

    res.status(200).json({
      message: "Review updated successfully",
      data: review
    });
  } catch (error) {
    next(error);
  }
}

function approveReview(req, res, next) {
  try {
    const result = reviewsService.approveReview(req.params.id);

    res.status(200).json({
      message: "Review approved successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

function rejectReview(req, res, next) {
  try {
    const result = reviewsService.rejectReview(req.params.id);

    res.status(200).json({
      message: "Review rejected successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createReview,
  getAllReviews,
  getReviewById,
  updateReview,
  approveReview,
  rejectReview
};

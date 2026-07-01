const express = require("express");

const reviewsController = require("../controllers/reviews.controller");

const {
  validateCreateReview,
  validateUpdateReview
} = require("../middleware/validateReview");

const router = express.Router();

router.post("/", validateCreateReview, reviewsController.createReview);

router.get("/", reviewsController.getAllReviews);
router.get("/:id", reviewsController.getReviewById);

router.patch("/:id/approve", reviewsController.approveReview);
router.patch("/:id/reject", reviewsController.rejectReview);
router.put("/:id", validateUpdateReview, reviewsController.updateReview);

module.exports = router;
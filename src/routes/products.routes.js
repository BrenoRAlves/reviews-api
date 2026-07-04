const express = require("express");

const productsController = require("../controllers/products.controller");

const router = express.Router();

router.get("/", productsController.getAllProducts);
router.get("/:id", productsController.getProductById);
router.get("/:id/review-summary", productsController.getProductReviewSummary);
router.get("/:id/reviews", productsController.getApprovedReviewsByProduct);

module.exports = router;

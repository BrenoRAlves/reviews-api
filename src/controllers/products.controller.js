const productsService = require("../services/products.service");

function getAllProducts(req, res, next) {
  try {
    const products = productsService.getAllProducts();

    res.status(200).json({
      data: products
    });
  } catch (error) {
    next(error);
  }
}

function getProductReviewSummary(req, res, next) {
  try {
    const summary = productsService.getProductReviewSummary(req.params.id);

    res.status(200).json({
      data: summary
    });
  } catch (error) {
    next(error);
  }
}

function getApprovedReviewsByProduct(req, res, next) {
  try {
    const reviews = productsService.getApprovedReviewsByProduct(req.params.id);

    res.status(200).json({
      data: reviews
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllProducts,
  getProductReviewSummary,
  getApprovedReviewsByProduct
};

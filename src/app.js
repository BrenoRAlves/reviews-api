require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { initDatabase } = require("./database");
const reviewsRoutes = require("./routes/reviews.routes");
const productsRoutes = require("./routes/products.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

initDatabase();

app.use(helmet());
app.use(cors());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Review Insights API is running"
  });
});

app.use("/api/reviews", reviewsRoutes);
app.use("/api/products", productsRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

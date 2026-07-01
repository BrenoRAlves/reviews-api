# Review Insights API

A backend-focused API for product reviews, moderation, mock analysis, and product rating summaries.

The project models a simple review workflow where customers can review purchased products, reviews start as pending, and only approved reviews affect public product ratings.

A minimal static frontend is included for manual testing and demonstration of the API flow.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Domain Model](#domain-model)
- [Review Lifecycle](#review-lifecycle)
- [Key Design Decisions](#key-design-decisions)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Seed Data](#seed-data)
- [API Reference](#api-reference)
- [Example Workflow](#example-workflow)
- [AI Assistance Note](#ai-assistance-note)
- [Future Improvements](#future-improvements)

## Features

- Create reviews only for completed order items.
- Prevent duplicate reviews for the same purchased item.
- Allow repeat reviews for the same product when they come from different purchases.
- Keep new reviews in a `pending` moderation state.
- Approve or reject pending reviews.
- Allow full review editing only while a review is still `pending`.
- Update product rating summaries only when reviews are approved.
- Store simple mock analysis for review comments.
- Filter reviews by moderation status.
- Run automated integration tests with Jest and Supertest.
- Use a minimal static frontend for manual testing.

## Tech Stack

- Node.js
- Express
- SQLite
- better-sqlite3
- Jest
- Supertest
- Plain HTML, CSS, and JavaScript

## Project Structure

```txt
src/
  app.js
  database.js
  controllers/
  middleware/
  routes/
  scripts/
  services/
  utils/
public/
  index.html
  styles.css
  app.js
tests/
  reviews.test.js
```

### Main folders

- `routes/` maps HTTP endpoints to controller functions.
- `controllers/` handles request parameters, request bodies, responses, and errors.
- `services/` contains the business logic.
- `middleware/` validates requests and handles errors.
- `database.js` defines the SQLite schema, seed data, and database reset logic.
- `tests/` contains integration tests for the review lifecycle.
- `public/` contains the minimal frontend.

## Domain Model

The database contains the following main tables:

- `users`
- `products`
- `orders`
- `order_items`
- `reviews`
- `review_analysis`
- `product_review_summary`

Reviews are linked to `order_item_id`, not directly to only `user_id` and `product_id`.

This means the rule is **one review per purchased item**:

- the same purchased item can only be reviewed once;
- the same user can review the same product again if they bought it again in another order.

## Review Lifecycle

```txt
new review -> pending
pending -> approved
pending -> rejected
approved -> final state
rejected -> final state
```

A review can only be edited while it is still `pending`.

Approved and rejected reviews are final states in this version. This keeps the lifecycle simple and avoids extra logic for recalculating product summaries after approved reviews have already affected ratings.

## Key Design Decisions

### 1. Reviews are linked to order items

The `reviews` table uses:

```sql
UNIQUE(order_item_id)
```

This prevents the same purchased item from being reviewed more than once.

The service layer also checks for an existing review before inserting a new one. That check is used to return a clear API error, while the database constraint remains the final protection against duplicates.

### 2. Reviews require completed orders

Before creating a review, the API checks that:

- the `order_item_id` exists;
- the related order has status `completed`.

Reviews for `pending` or `cancelled` orders are blocked.

### 3. Product summaries are denormalized

The product list does not recalculate ratings from all reviews on every request.

Instead, the `product_review_summary` table stores:

- `approved_rating_sum`
- `approved_review_count`
- `average_rating`

The summary is updated when a review is approved.

This keeps product listing queries simple and avoids repeated aggregate calculations for common read operations.

### 4. Approval uses an atomic status transition

A review is approved only if it is currently pending:

```sql
UPDATE reviews
SET status = 'approved'
WHERE id = ? AND status = 'pending';
```

The service checks how many rows were changed:

- if one row changed, the transition succeeded;
- if zero rows changed, the review either does not exist or is not in the correct state.

This prevents approving the same review twice.

Approval also updates `product_review_summary` inside the same transaction, so the review status and summary data stay consistent.

### 5. Rejection is pending-only

A review can only be rejected while it is pending.

Rejected reviews do not affect product summaries.

### 6. Editing is a full update

Review editing uses:

```http
PUT /api/reviews/:id
```

The request must include both `rating` and `comment`:

```json
{
  "rating": 3,
  "comment": "Updated review comment"
}
```

Since only two fields are editable, a full update keeps validation and lifecycle rules simple.

### 7. Mock review analysis is separated

The `analysis.service.js` file contains a simple mock analysis function.

It returns:

- sentiment;
- topic;
- urgency;
- summary.

This is not a real AI implementation. It is a placeholder showing how review comments could later be transformed into structured insights.

Because it is isolated in its own service, it could be replaced later with a real AI or NLP API without changing the review workflow significantly.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Reset and seed the database

```bash
npm run reset-db
```

### 3. Start the server

```bash
npm start
```

For development with automatic restart:

```bash
npm run dev
```

### 4. Open the API or frontend

The API runs at:

```txt
http://localhost:3000
```

The frontend is served by the same Express app:

```txt
http://localhost:3000
```

## Testing

Run the automated test suite:

```bash
npm test
```

The tests use Jest and Supertest. They reset the database before each test and call the Express app directly.

The test suite covers the main lifecycle rules:

- valid review creation returns `201`;
- duplicate reviews for the same `orderItemId` return `409`;
- reviews for non-completed orders are blocked;
- repeat product reviews are allowed when they come from different `order_item` records;
- pending reviews can be edited with full `PUT`;
- approved reviews cannot be edited;
- approved reviews cannot be approved again;
- approved reviews cannot be rejected;
- rejected reviews do not update product summaries;
- approved reviews update product summaries;
- reviews can be filtered by status.

## Seed Data

The database is seeded with sample users, products, orders, and order items.

Useful seed cases:

- `orderItemId: 1` belongs to a completed order and can be reviewed.
- `orderItemId: 3` represents the same user buying the same product again in a different order, so it can also be reviewed.
- `orderItemId: 4` belongs to a pending order, so it cannot be reviewed.

## API Reference

### Health

#### `GET /api/health`

Checks whether the API is running.

---

### Products

#### `GET /api/products`

Returns all products with their rating summary.

The rating summary comes from `product_review_summary`.

#### `GET /api/products/:id/review-summary`

Returns the approved review count and average rating for a single product.

#### `GET /api/products/:id/reviews`

Returns approved reviews for a single product.

---

### Reviews

#### `POST /api/reviews`

Creates a new pending review.

Example body:

```json
{
  "orderItemId": 1,
  "rating": 4,
  "comment": "The product quality was good, but the delivery was late."
}
```

Rules:

- the order item must exist;
- the related order must be completed;
- the order item must not have already been reviewed;
- rating must be between 1 and 5;
- comment is required.

#### `GET /api/reviews`

Returns reviews.

Optional status filter:

```http
GET /api/reviews?status=pending
GET /api/reviews?status=approved
GET /api/reviews?status=rejected
```

This is useful for moderation workflows.

#### `GET /api/reviews/:id`

Returns one review by ID.

#### `PUT /api/reviews/:id`

Fully updates a pending review.

Example body:

```json
{
  "rating": 3,
  "comment": "I edited my review. The product is okay, but delivery was late."
}
```

Rules:

- only pending reviews can be edited;
- both `rating` and `comment` are required.

#### `PATCH /api/reviews/:id/approve`

Approves a pending review.

Approving a review also updates the related product summary.

#### `PATCH /api/reviews/:id/reject`

Rejects a pending review.

Rejected reviews do not update product summaries.

## Example Workflow

1. Reset the database:

```bash
npm run reset-db
```

2. Start the server:

```bash
npm start
```

3. Check the products:

```http
GET /api/products
```

4. Create a review:

```http
POST /api/reviews
```

```json
{
  "orderItemId": 1,
  "rating": 5,
  "comment": "Great product"
}
```

5. Check pending reviews:

```http
GET /api/reviews?status=pending
```

6. Edit the review while it is still pending:

```http
PUT /api/reviews/1
```

```json
{
  "rating": 4,
  "comment": "Updated comment after thinking again"
}
```

7. Approve the review:

```http
PATCH /api/reviews/1/approve
```

8. Check the product summary:

```http
GET /api/products/1/review-summary
```

9. Try to edit the approved review:

```http
PUT /api/reviews/1
```

This should return a conflict response because approved reviews are final.

## AI Assistance Note

AI tools were used as a development assistant during this project for brainstorming, refactoring suggestions, test ideas, documentation structure, and the minimal frontend demo.

The project scope, backend decisions, simplifications, and final implementation were reviewed and adapted to keep the API focused and explainable.

## Future Improvements

- Authentication and authorization.
- Admin-only moderation permissions.
- Pagination for large review lists.
- Real AI or NLP analysis instead of mock analysis.
- Production logging and monitoring.
- Deployment configuration.
- Optional image support using cloud storage and a separate image metadata table.

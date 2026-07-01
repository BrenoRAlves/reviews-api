# Review Insights API

A small backend project built with Node.js, Express, and SQLite.

This project was inspired by a review analysis challenge. The goal is not to build a full e-commerce system. The goal is to build a focused backend API for product reviews, with realistic backend concerns:

- preventing duplicate reviews for the same purchased item;
- allowing the same user to review the same product again after a separate purchase;
- moderating reviews before they affect product ratings;
- avoiding recalculating product ratings on every page load;
- using transactions to keep review status and rating summaries consistent;
- connecting review data to simple mock analysis;
- filtering reviews by moderation status;
- providing a very small frontend demo for presentation and manual testing.

## Tech stack

- Node.js
- Express
- SQLite
- better-sqlite3
- Jest and Supertest
- Plain HTML, CSS, and JavaScript for the demo frontend

## Main idea

Users can review products they purchased.

The important design decision is that a review is linked to an `order_item`, not directly to a `user_id` and `product_id`.

That means:

- one purchased item can only be reviewed once;
- the same user can review the same product again if they bought it again in another order.

## Database tables

- `users`
- `products`
- `orders`
- `order_items`
- `reviews`
- `review_analysis`
- `product_review_summary`

## Review lifecycle

The review lifecycle is intentionally simple:

```txt
new review -> pending
pending -> approved
pending -> rejected
approved -> final state
rejected -> final state
```

A review can only be edited while it is still `pending`.

Once a review is approved, it has already affected the product rating summary, so editing is blocked in this MVP. Once a review is rejected, it is also treated as final.

This keeps the project easier to reason about and avoids extra complexity around removing old ratings from summaries when approved reviews are edited.

## Main backend concerns

### 1. Duplicate reviews

The `reviews` table has:

```sql
UNIQUE(order_item_id)
```

This prevents the same purchased item from being reviewed twice.

### 2. Verified purchase rule

Before creating a review, the API checks that:

- the `order_item_id` exists;
- the order status is `completed`.

This means users cannot review products from pending or cancelled orders.

### 3. Product rating performance

Instead of recalculating the average rating from all approved reviews every time a product page loads, the API stores:

- `approved_rating_sum`
- `approved_review_count`

in the `product_review_summary` table.

The average is calculated as:

```txt
approved_rating_sum / approved_review_count
```

### 4. Race conditions and transactions

Approving a review changes two things:

1. the review status;
2. the product review summary.

Those changes happen inside a transaction.

The update is also conditional:

```sql
UPDATE reviews
SET status = 'approved'
WHERE id = ? AND status = 'pending';
```

This prevents the same review from being approved twice and counted twice.

### 5. Simple review editing

Editing is a full update using:

```http
PUT /api/reviews/:id
```

The request must include both `rating` and `comment`.

Editing is only allowed while the review is still `pending`:

```sql
UPDATE reviews
SET rating = ?, comment = ?
WHERE id = ? AND status = 'pending';
```

That keeps the lifecycle simple. Approved and rejected reviews are final in this MVP.



### 6. Review listing for moderation

The product frontend does not need to fetch every review just to display average ratings. Product lists use `product_review_summary` for `averageRating` and `approvedReviewCount`.

The review listing endpoint exists mainly for moderation:

```http
GET /api/reviews?status=pending
GET /api/reviews?status=approved
GET /api/reviews?status=rejected
```

This makes it easy to build an admin/moderation screen without mixing that flow with the customer-facing product list.

### 7. Mock analysis

When a review is created or edited, the comment is analysed by a simple mock analysis service.

It returns:

- sentiment;
- topic;
- urgency;
- summary.

This is intentionally simple. In a real implementation, this could later be replaced by an AI API or a proper NLP model.

## How to run

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm run dev
```

The API runs at:

```txt
http://localhost:3000
```

The simple demo frontend is served by the same Express app at:

```txt
http://localhost:3000
```

The frontend is intentionally minimal. It exists only to make the backend flow easier to present and manually test.

Reset the database:

```bash
npm run reset-db
```

Run the automated tests:

```bash
npm test
```

The tests use Jest and Supertest. They focus on the main business rules instead of testing every small implementation detail: duplicate prevention, completed-order validation, pending-only editing, approval/rejection status transitions, status filtering, and product summary updates.

## Simple frontend demo

The project includes a small static frontend in:

```txt
public/
  index.html
  styles.css
  app.js
```

It is not intended to be a full frontend application. It is only a presentation and manual testing interface for the backend API.

The frontend can:

- load products and their rating summaries;
- create a pending review;
- list reviews by moderation status;
- edit a pending review using full `PUT`;
- approve or reject pending reviews;
- fetch a product review summary;
- display the latest API response or error.

Strong interview explanation:

“The frontend is intentionally simple. I added it only to present and manually test the backend workflow more easily. The main focus of the project is still the API design, business rules, database constraints, transactions, and automated tests.”


## Seed data

The database is automatically seeded with sample users, products, orders, and order items.

Useful seed cases:

- `orderItemId: 1` can be reviewed.
- `orderItemId: 3` is the same user buying the same product again in a different order, so it can also be reviewed.
- `orderItemId: 4` belongs to a pending order, so it cannot be reviewed.

## API endpoints

### Health check

```http
GET /api/health
```

### Get products

```http
GET /api/products
```

### Get product review summary

```http
GET /api/products/:id/review-summary
```

### Get approved product reviews

```http
GET /api/products/:id/reviews
```

### Create review

```http
POST /api/reviews
```

Example body:

```json
{
  "orderItemId": 1,
  "rating": 4,
  "comment": "The product quality was good, but the delivery was late."
}
```

### Get reviews

```http
GET /api/reviews
GET /api/reviews?status=pending
GET /api/reviews?status=approved
GET /api/reviews?status=rejected
```

The status filter is useful for the moderation workflow. For example, a moderator can request only pending reviews before deciding whether to approve or reject them.

### Get one review

```http
GET /api/reviews/:id
```

### Fully edit a pending review

```http
PUT /api/reviews/:id
```

Example body:

```json
{
  "rating": 3,
  "comment": "I edited my review. The product is okay, but delivery was late."
}
```

### Approve review

```http
PATCH /api/reviews/:id/approve
```

### Reject review

```http
PATCH /api/reviews/:id/reject
```

Only pending reviews can be rejected. Approved and rejected reviews are final in this MVP.

## Automated tests

The project includes a small integration test suite in:

```txt
tests/reviews.test.js
```

The tests call the Express app directly with Supertest and reset the SQLite database before each test. The goal is to prove the core lifecycle rules are protected:

- valid review creation returns `201`;
- duplicate review for the same `orderItemId` returns `409`;
- reviews for non-completed orders are blocked;
- repeat product reviews are allowed when they come from different `order_item` records;
- pending reviews can be edited with full `PUT`;
- approved reviews cannot be edited;
- approval updates `product_review_summary`;
- rejected reviews do not update the product summary;
- approved reviews cannot be rejected;
- review listing can be filtered by status.

## Suggested demo flow

You can run this flow through the simple frontend at `http://localhost:3000` or through Thunder Client.

1. `GET /api/health`
2. `GET /api/products` to show products with average rating and review count.
3. `POST /api/reviews` with `orderItemId: 1`.
4. Try `POST /api/reviews` again with the same `orderItemId` to show duplicate prevention.
5. `GET /api/reviews?status=pending` to show the moderation queue.
6. `PUT /api/reviews/1` while the review is still pending.
7. `PATCH /api/reviews/1/approve`.
8. `GET /api/products/1/review-summary` to show that the approved review updated the summary.
9. Try `PUT /api/reviews/1` again to show approved reviews cannot be edited.
10. Create another review with `orderItemId: 3`.
11. `PATCH /api/reviews/2/reject`.
12. Try `PATCH /api/reviews/1/reject` to show approved reviews cannot be rejected.
13. Try `PUT /api/reviews/2` to show rejected reviews cannot be edited.

## Interview explanation

This is a backend-focused project inspired by the AI Challenge. I wanted to connect my data background with backend development, so I built a review system where customer feedback is validated, stored, analysed, moderated, and used to update product rating summaries.

The main design decision is linking reviews to `order_item_id`. This prevents duplicate reviews for the same purchase while still allowing a user to review the same product again if they bought it again in another order.

I also added a `product_review_summary` table to avoid recalculating average ratings on every product page load. Approval is wrapped in a transaction because it changes both the review status and the product summary. Rejection is simpler because it only moves a pending review to rejected and does not affect the summary.

I added a focused Jest and Supertest integration test suite for the review lifecycle. The tests are not trying to cover every line of code; they protect the most important business rules, such as duplicate prevention, pending-only approval/rejection, editing only before approval, and product summary updates only after approval.

I intentionally removed image support from the MVP because it would add file upload handling, cloud storage, file validation, and image moderation concerns. If image support were added later, I would store the actual files in cloud storage and keep only the URL and metadata in a separate table linked to the review.


## Note on AI assistance

AI tools were used as a development assistant during this project, especially for brainstorming, refactoring suggestions, test ideas, and the simple frontend demo.

The frontend is intentionally basic and exists only for presentation. The backend scope decisions, review lifecycle, database model, and final behaviour were reviewed and adapted to keep the project focused and explainable.

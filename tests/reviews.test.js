process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";

const request = require("supertest");
const app = require("../src/app");
const { resetDatabase } = require("../src/database");

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});

beforeEach(() => {
  resetDatabase();
});

describe("Review Insights API - review lifecycle", () => {
  test("creates a pending review for a completed order item", async () => {
    const response = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 5,
        comment: "Great product"
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      orderItemId: 1,
      rating: 5,
      comment: "Great product",
      status: "pending"
    });
    expect(response.body.data).toHaveProperty("sentiment");
    expect(response.body.data).toHaveProperty("summary");
  });

  test("prevents duplicate reviews for the same order item", async () => {
    await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 5,
        comment: "Great product"
      })
      .expect(201);

    const duplicateResponse = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 4,
        comment: "Trying to review the same purchase again"
      });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.message).toBe("This order item has already been reviewed");
  });

  test("does not allow reviews for non-completed orders", async () => {
    const response = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 4,
        rating: 5,
        comment: "This order has not been completed yet"
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Only completed orders can be reviewed");
  });

  test("allows repeat product reviews when they come from different purchases", async () => {
    await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 5,
        comment: "First purchase was excellent"
      })
      .expect(201);

    const secondPurchaseResponse = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 3,
        rating: 4,
        comment: "Second purchase was still good"
      });

    expect(secondPurchaseResponse.status).toBe(201);
    expect(secondPurchaseResponse.body.data).toMatchObject({
      orderItemId: 3,
      rating: 4,
      status: "pending"
    });
  });

  test("updates a pending review using a full PUT request", async () => {
    const createResponse = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 5,
        comment: "Initial comment"
      });

    const reviewId = createResponse.body.data.id;

    const updateResponse = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .send({
        rating: 3,
        comment: "Updated full review comment"
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data).toMatchObject({
      id: reviewId,
      rating: 3,
      comment: "Updated full review comment",
      status: "pending"
    });
  });

  test("requires both rating and comment when updating a review", async () => {
    const createResponse = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 5,
        comment: "Initial comment"
      });

    const reviewId = createResponse.body.data.id;

    const updateResponse = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .send({
        rating: 3
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.message).toBe("Comment is required");
  });

  test("approves a pending review and updates the product summary", async () => {
    const createResponse = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 5,
        comment: "Excellent product"
      });

    const reviewId = createResponse.body.data.id;

    const beforeApproval = await request(app).get("/api/products/1/review-summary");
    expect(beforeApproval.body.data.approvedReviewCount).toBe(0);
    expect(beforeApproval.body.data.averageRating).toBe(0);

    const approvalResponse = await request(app)
      .patch(`/api/reviews/${reviewId}/approve`);

    expect(approvalResponse.status).toBe(200);
    expect(approvalResponse.body.data.status).toBe("approved");

    const afterApproval = await request(app).get("/api/products/1/review-summary");
    expect(afterApproval.body.data.approvedReviewCount).toBe(1);
    expect(afterApproval.body.data.averageRating).toBe(5);
  });

  test("cannot approve the same review twice", async () => {
    const createResponse = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 5,
        comment: "Great product"
      });

    const reviewId = createResponse.body.data.id;

    await request(app)
      .patch(`/api/reviews/${reviewId}/approve`)
      .expect(200);

    const secondApprovalResponse = await request(app)
      .patch(`/api/reviews/${reviewId}/approve`);

    expect(secondApprovalResponse.status).toBe(409);
  });

  test("cannot edit an approved review", async () => {
    const createResponse = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 5,
        comment: "Great product"
      });

    const reviewId = createResponse.body.data.id;

    await request(app)
      .patch(`/api/reviews/${reviewId}/approve`)
      .expect(200);

    const updateResponse = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .send({
        rating: 3,
        comment: "Changed my mind"
      });

    expect(updateResponse.status).toBe(409);
  });

  test("rejects a pending review but does not update the product summary", async () => {
    const createResponse = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 2,
        comment: "Not good"
      });

    const reviewId = createResponse.body.data.id;

    const rejectResponse = await request(app)
      .patch(`/api/reviews/${reviewId}/reject`);

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data.status).toBe("rejected");

    const summaryResponse = await request(app).get("/api/products/1/review-summary");
    expect(summaryResponse.body.data.approvedReviewCount).toBe(0);
    expect(summaryResponse.body.data.averageRating).toBe(0);
  });

  test("cannot reject an approved review", async () => {
    const createResponse = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 5,
        comment: "Great product"
      });

    const reviewId = createResponse.body.data.id;

    await request(app)
      .patch(`/api/reviews/${reviewId}/approve`)
      .expect(200);

    const rejectResponse = await request(app)
      .patch(`/api/reviews/${reviewId}/reject`);

    expect(rejectResponse.status).toBe(409);
  });

  test("filters reviews by status", async () => {
    const approvedReview = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 1,
        rating: 5,
        comment: "Approved review"
      });

    const rejectedReview = await request(app)
      .post("/api/reviews")
      .send({
        orderItemId: 2,
        rating: 1,
        comment: "Rejected review"
      });

    await request(app)
      .patch(`/api/reviews/${approvedReview.body.data.id}/approve`)
      .expect(200);

    await request(app)
      .patch(`/api/reviews/${rejectedReview.body.data.id}/reject`)
      .expect(200);

    const approvedReviewsResponse = await request(app)
      .get("/api/reviews?status=approved");

    expect(approvedReviewsResponse.status).toBe(200);
    expect(approvedReviewsResponse.body.data).toHaveLength(1);
    expect(approvedReviewsResponse.body.data[0].status).toBe("approved");
  });
});

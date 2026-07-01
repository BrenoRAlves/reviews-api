function analyseReview(comment) {
  const text = comment.toLowerCase();

  let sentiment = "neutral";
  let topic = "general";
  let urgency = "low";

  const positiveWords = ["good", "great", "excellent", "amazing", "love", "perfect", "happy"];
  const negativeWords = ["bad", "terrible", "poor", "broken", "damaged", "late", "awful", "refund"];

  if (positiveWords.some((word) => text.includes(word))) {
    sentiment = "positive";
  }

  if (negativeWords.some((word) => text.includes(word))) {
    sentiment = "negative";
  }

  if (
    text.includes("delivery") ||
    text.includes("shipping") ||
    text.includes("late")
  ) {
    topic = "delivery";
  }

  if (
    text.includes("price") ||
    text.includes("expensive") ||
    text.includes("cheap")
  ) {
    topic = "pricing";
  }

  if (
    text.includes("quality") ||
    text.includes("broken") ||
    text.includes("damaged")
  ) {
    topic = "product quality";
  }

  if (
    text.includes("urgent") ||
    text.includes("immediately") ||
    text.includes("refund") ||
    text.includes("complaint")
  ) {
    urgency = "high";
  }

  return {
    sentiment,
    topic,
    urgency,
    summary: comment.length > 120 ? `${comment.slice(0, 117)}...` : comment
  };
}

module.exports = {
  analyseReview
};

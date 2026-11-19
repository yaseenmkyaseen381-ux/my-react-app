import mongoose from "mongoose";

const productReviewSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  productName: { type: String, required: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  customerName: { type: String, required: true, trim: true },
  customerEmail: { type: String, required: true, lowercase: true, trim: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 1200 },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
}, { timestamps: true });

productReviewSchema.index({ productId: 1, customerId: 1 }, { unique: true });

export default mongoose.model("ProductReview", productReviewSchema);

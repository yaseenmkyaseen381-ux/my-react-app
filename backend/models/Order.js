import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  idempotencyKey: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  customer: { name: String, email: String, phone: String },
  address: { label: String, fullName: String, phone: String, line1: String, line2: String, city: String, state: String, postalCode: String, country: String },
  items: [{ productId: String, variantId: String, name: String, variantName: String, image: String, price: Number, quantity: Number, lineTotal: Number }],
  subtotal: { type: Number, required: true }, shipping: { type: Number, default: 0 }, tax: { type: Number, default: 0 }, total: { type: Number, required: true },
  paymentMethod: { type: String, enum: ["cod", "razorpay", "wallet"], required: true },
  paymentOrderId: { type: String, default: "" },
  paymentId: { type: String, default: "" },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
  refundStatus: { type: String, enum: ["none", "pending", "processing", "refunded", "failed"], default: "none" },
  paymentHistory: [{ event: String, reference: String, note: String, at: { type: Date, default: Date.now } }],
  status: { type: String, enum: ["Pending", "Confirmed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"], default: "Pending", index: true },
  stockRestored: { type: Boolean, default: false },
  cancellationReason: { type: String, default: "" },
  returnRequest: { reason: String, status: { type: String, enum: ["none", "requested", "accepted", "rejected", "completed"], default: "none" }, requestedAt: Date, reviewedAt: Date },
}, { timestamps: true });

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });
export default mongoose.model("Order", orderSchema);

import mongoose from "mongoose";

const walletTopUpSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  source: { type: String, enum: ["razorpay", "admin_credit"], default: "razorpay" },
  requestKey: { type: String, required: true },
  amountPaise: { type: Number, required: true, min: 1 },
  receipt: { type: String, default: "" },
  description: { type: String, default: "" },
  paymentOrderId: { type: String, default: undefined },
  paymentId: { type: String, default: "" },
  status: { type: String, enum: ["pending", "credited", "failed"], default: "pending" },
}, { timestamps: true });

walletTopUpSchema.index({ user: 1, requestKey: 1 }, { unique: true });
walletTopUpSchema.index({ paymentOrderId: 1 }, { unique: true, sparse: true });

export default mongoose.model("WalletTopUp", walletTopUpSchema);

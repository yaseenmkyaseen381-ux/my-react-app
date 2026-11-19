import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["credit", "debit", "refund", "cashback"], required: true },
  source: { type: String, enum: ["topup", "admin_credit", "order", "order_refund", "cashback"], required: true },
  description: { type: String, required: true, trim: true, maxlength: 180 },
  amountPaise: { type: Number, required: true, min: 1 },
  reference: { type: String, required: true, trim: true },
  status: { type: String, enum: ["completed", "pending", "failed"], default: "completed" },
}, { timestamps: true });

const walletSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  balancePaise: { type: Number, min: 0, default: 0 },
  transactions: { type: [transactionSchema], default: [] },
}, { timestamps: true });

export default mongoose.model("Wallet", walletSchema);

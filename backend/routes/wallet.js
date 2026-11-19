import { Router } from "express";
import { protect } from "../middleware/auth.js";
import Wallet from "../models/Wallet.js";
import WalletTopUp from "../models/WalletTopUp.js";
import Order from "../models/Order.js";

const router = Router();
const inrPaise = (rupees) => Math.round(rupees * 100);

async function readWallet(userId) {
  return Wallet.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { balancePaise: 0, transactions: [] } },
    { new: true, upsert: true },
  );
}

router.use(protect);

router.get("/", async (req, res) => {
  try {
    const [wallet, topUps, refunds] = await Promise.all([
      readWallet(req.user._id),
      WalletTopUp.find({ user: req.user._id, status: { $in: ["pending", "failed"] } }).sort({ createdAt: -1 }).limit(50).lean(),
      Order.find({ user: req.user._id, paymentMethod: { $ne: "wallet" }, refundStatus: { $in: ["pending", "processing", "failed"] } }).sort({ updatedAt: -1 }).limit(50).lean(),
    ]);
    const transactions = [
      ...wallet.transactions.map((entry) => ({ ...entry.toObject(), balanceChange: true })),
      ...topUps.map((topUp) => ({
        type: "credit", source: topUp.source, description: topUp.description || (topUp.source === "admin_credit" ? "Admin wallet credit" : "Wallet top-up"), amountPaise: topUp.amountPaise,
        reference: topUp.receipt || topUp.requestKey, status: topUp.status === "pending" ? "pending" : topUp.status === "failed" ? "failed" : "completed", balanceChange: false, createdAt: topUp.updatedAt,
      })),
      ...refunds.map((order) => ({
        type: "refund", source: "order_refund", description: `Order return refund · ${order.paymentMethod === "razorpay" ? "original payment method" : "offline refund"}`,
        amountPaise: inrPaise(order.total), reference: order.orderNumber,
        status: order.refundStatus === "refunded" ? "completed" : order.refundStatus === "failed" ? "failed" : "pending",
        balanceChange: false, createdAt: order.updatedAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
    return res.json({ balancePaise: wallet.balancePaise, transactions });
  } catch (error) {
    console.error("Wallet read failed:", error.message);
    return res.status(500).json({ message: "Could not load your wallet." });
  }
});

router.post("/topups", async (req, res) => {
  return res.status(410).json({ message: "Wallet top-ups are disabled. Wallet balance can be used during checkout, and refunds are credited here." });
});

router.post("/topups/verify", async (req, res) => {
  return res.status(410).json({ message: "Wallet top-ups are disabled." });
});

router.post("/topups/failure", async (req, res) => {
  return res.status(410).json({ message: "Wallet top-ups are disabled." });
});




export default router;

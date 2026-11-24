import { Router } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Wallet from "../models/Wallet.js";
import Coupon from "../models/Coupon.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();
const transitions = {
  Pending: [
    "Confirmed",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ],
  Confirmed: [
    "Pending",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ],
  Shipped: ["Out for Delivery", "Delivered"],
  "Out for Delivery": ["Delivered"],
  Delivered: [],
  Cancelled: [],
};
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const amount = (n) => Math.round(n * 100);
const hasRazorpayConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
  return (
    /^(rzp_test_|rzp_live_)[A-Za-z0-9]+$/.test(keyId) &&
    keySecret.length >= 16 &&
    !/your_|placeholder|replace_with/i.test(keySecret)
  );
};

async function changeStock(item, quantity, session) {
  const options = session ? { session } : {};
  if (item.variantId) {
    return Product.updateOne(
      { _id: item.productId, "variants._id": item.variantId },
      { $inc: { "variants.$.stock": quantity, stock: quantity } },
      options,
    );
  }
  return Product.updateOne(
    { _id: item.productId },
    { $inc: { stock: quantity } },
    options,
  );
}

async function reserveStock(items, session) {
  for (const item of items) {
    const query = {
      _id: item.productId,
      published: true,
      blocked: false,
      deletedAt: null,
    };
    if (item.variantId)
      query.variants = {
        $elemMatch: { _id: item.variantId, stock: { $gte: item.quantity } },
      };
    else query.stock = { $gte: item.quantity };
    const update = item.variantId
      ? { $inc: { "variants.$.stock": -item.quantity, stock: -item.quantity } }
      : { $inc: { stock: -item.quantity } };
    const result = await Product.updateOne(query, update, { session });
    if (!result.modifiedCount)
      throw Object.assign(
        new Error("A product is out of stock. Review your cart."),
        { status: 409 },
      );
  }
}

async function restoreStock(order, session) {
  if (order.stockRestored) return;
  for (const item of order.items) {
    const result = await changeStock(item, item.quantity, session);
    if (!result.modifiedCount)
      throw new Error(`Could not restore stock for product ${item.productId}.`);
  }
  order.stockRestored = true;
  await order.save({ session });
}

async function refundWalletOrder(order, session, note) {
  const reference = `refund-${order._id}`;
  const wallet = await Wallet.findOneAndUpdate(
    { user: order.user },
    { $setOnInsert: { balancePaise: 0, transactions: [] } },
    { new: true, upsert: true, session, setDefaultsOnInsert: true },
  );
  if (!wallet.transactions.some((entry) => entry.reference === reference)) {
    wallet.balancePaise += amount(order.total);
    wallet.transactions.push({
      type: "refund",
      source: "order_refund",
      description: `Refund for order ${order.orderNumber}`,
      amountPaise: amount(order.total),
      reference,
      status: "completed",
    });
    if (wallet.transactions.length > 500)
      wallet.transactions.splice(0, wallet.transactions.length - 500);
    await wallet.save({ session });
  }
  order.paymentStatus = "refunded";
  order.refundStatus = "refunded";
  order.paymentHistory.push({ event: "wallet_refund", reference, note });
}

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function razorpayCall(path, body) {
  if (!hasRazorpayConfig())
    throw Object.assign(
      new Error(
        "Online payment is not configured. Add valid Razorpay test or live keys to backend/.env, then restart the backend.",
      ),
      { status: 503 },
    );
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw Object.assign(
      new Error(
        "Could not connect to Razorpay. Check the backend internet connection and try again.",
      ),
      { status: 502 },
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(result.error?.description || "Razorpay request failed."),
      { status: 502 },
    );
  return result;
}

router.use(protect);

async function priceCartItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 50)
    throw Object.assign(new Error("Your cart is empty or invalid."), {
      status: 400,
    });
  const normalized = new Map();
  for (const entry of items) {
    if (
      typeof entry.productId !== "string" ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1 ||
      entry.quantity > 10
    )
      throw Object.assign(new Error("Cart contains an invalid quantity."), {
        status: 400,
      });
    const key = `${entry.productId}:${entry.variantId || ""}`;
    normalized.set(key, {
      productId: entry.productId,
      variantId: entry.variantId || "",
      quantity: (normalized.get(key)?.quantity || 0) + entry.quantity,
    });
  }
  const orderItems = [];
  for (const entry of normalized.values()) {
    const product = await Product.findOne({
      _id: entry.productId,
      published: true,
      blocked: false,
      deletedAt: null,
    }).populate("category", "name");
    if (
      !product ||
      !(await Category.exists({
        _id: product.category?._id,
        deletedAt: null,
      }))
    )
      throw Object.assign(new Error("A product is no longer available."), {
        status: 409,
      });
    const variant = entry.variantId
      ? product.variants.id(entry.variantId)
      : null;
    if (product.variants.length && !variant)
      throw Object.assign(
        new Error(`Choose a valid option for ${product.name}.`),
        { status: 400 },
      );
    const price = variant?.price ?? product.price;
    orderItems.push({
      ...entry,
      name: product.name,
      variantName: variant?.name || "",
      image: product.images?.[0] || "",
      price,
      lineTotal: price * entry.quantity,
    });
  }
  return orderItems;
}

async function quoteCoupon(code, subtotal) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(normalizedCode))
    throw Object.assign(new Error("Enter a valid coupon code."), {
      status: 400,
    });
  const coupon = await Coupon.findOne({ code: normalizedCode });
  const now = new Date();
  if (
    !coupon ||
    !coupon.active ||
    (coupon.expiresAt && coupon.expiresAt <= now) ||
    (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit)
  )
    throw Object.assign(
      new Error("This coupon is invalid, expired, or no longer available."),
      { status: 400 },
    );
  if (subtotal < coupon.minSubtotal)
    throw Object.assign(
      new Error(
        `Add at least ₹${coupon.minSubtotal.toLocaleString("en-IN")} to use this coupon.`,
      ),
      { status: 400 },
    );
  let discount =
    coupon.discountType === "percentage"
      ? Math.round((subtotal * coupon.discountValue) / 100)
      : Math.round(coupon.discountValue);
  if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(subtotal, Math.max(0, discount));
  if (!discount)
    throw Object.assign(new Error("This coupon does not apply to this cart."), {
      status: 400,
    });
  return { coupon, discount };
}

router.post("/coupons/validate", async (req, res) => {
  try {
    const items = await priceCartItems(req.body?.items);
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const { coupon, discount } = await quoteCoupon(req.body?.code, subtotal);
    const shipping = subtotal >= 5000 ? 0 : 99;
    return res.json({
      code: coupon.code,
      discount,
      subtotal,
      shipping,
      total: subtotal - discount + shipping,
    });
  } catch (error) {
    return res
      .status(error.status || 400)
      .json({ message: error.message || "Could not validate this coupon." });
  }
});

router.get("/coupons/available", async (_req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({
    active: true,
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ usageLimit: 0 }, { $expr: { $lt: ["$usageCount", "$usageLimit"] } }] },
    ],
  })
    .select("code discountType discountValue minSubtotal maxDiscount expiresAt")
    .sort({ createdAt: -1 })
    .lean();
  return res.json({ coupons });
});

router.post("/", async (req, res) => {
  const { items, addressId, paymentMethod, idempotencyKey } = req.body || {};
  const couponCode = String(req.body?.couponCode || "").trim().toUpperCase();
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.length > 50 ||
    !addressId ||
    !["cod", "razorpay", "wallet"].includes(paymentMethod) ||
    !/^[\w-]{12,100}$/.test(idempotencyKey || "")
  )
    return res
      .status(400)
      .json({
        message:
          "Provide cart items, a saved address, payment method, and a valid request key.",
      });
  // Fail before reserving inventory or creating an unpaid order when keys are absent.
  if (paymentMethod === "razorpay" && !hasRazorpayConfig())
    return res
      .status(503)
      .json({
        message:
          "Online payment is not configured. Add valid Razorpay test or live keys to backend/.env, then restart the backend.",
      });
  const prior = await Order.findOne({ user: req.user._id, idempotencyKey });
  if (prior) {
    if (
      prior.paymentMethod === "razorpay" &&
      prior.paymentStatus !== "paid" &&
      prior.status !== "Cancelled"
    ) {
      try {
        const rp = await razorpayCall("/orders", {
          amount: amount(prior.total),
          currency: "INR",
          receipt: prior.orderNumber,
          notes: { orderId: String(prior._id) },
        });
        prior.paymentOrderId = rp.id;
        prior.paymentHistory.push({ event: "payment_retry", reference: rp.id });
        await prior.save();
        return res.json({
          order: prior,
          razorpay: {
            keyId: process.env.RAZORPAY_KEY_ID,
            orderId: rp.id,
            amount: rp.amount,
            currency: rp.currency,
          },
        });
      } catch (error) {
        return res
          .status(error.status || 502)
          .json({ message: error.message, order: prior });
      }
    }
    return res.status(200).json({ order: prior });
  }
  try {
    const user = await (
      await import("../models/User.js")
    ).default.findById(req.user._id);
    const address = user.addresses.id(addressId);
    if (!address)
      return res
        .status(400)
        .json({ message: "Choose one of your saved addresses." });
    const normalized = new Map();
    for (const entry of items) {
      if (
        typeof entry.productId !== "string" ||
        !Number.isInteger(entry.quantity) ||
        entry.quantity < 1 ||
        entry.quantity > 10
      )
        return res
          .status(400)
          .json({ message: "Cart contains an invalid quantity." });
      const key = `${entry.productId}:${entry.variantId || ""}`;
      normalized.set(key, {
        productId: entry.productId,
        variantId: entry.variantId || "",
        quantity: (normalized.get(key)?.quantity || 0) + entry.quantity,
      });
    }
    const orderItems = [];
    for (const entry of normalized.values()) {
      const p = await Product.findOne({
        _id: entry.productId,
        published: true,
        blocked: false,
        deletedAt: null,
      }).populate("category", "name");
      if (
        !p ||
        !(await Category.exists({ _id: p.category?._id, deletedAt: null }))
      )
        throw Object.assign(new Error("A product is no longer available."), {
          status: 409,
        });
      const variant = entry.variantId ? p.variants.id(entry.variantId) : null;
      if (p.variants.length && !variant)
        throw Object.assign(new Error(`Choose a valid option for ${p.name}.`), {
          status: 400,
        });
      const price = variant?.price ?? p.price;
      orderItems.push({
        ...entry,
        name: p.name,
        variantName: variant?.name || "",
        image: p.images?.[0] || "",
        price,
        lineTotal: price * entry.quantity,
      });
    }
    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const couponQuote = couponCode ? await quoteCoupon(couponCode, subtotal) : null;
    const discount = couponQuote?.discount || 0;
    const shipping = subtotal >= 5000 ? 0 : 99;
    const total = subtotal - discount + shipping;
    const orderDraft = {
      orderNumber: `MX${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      idempotencyKey,
      user: user._id,
      customer: { name: user.name, email: user.email, phone: address.phone },
      address: address.toObject(),
      items: orderItems,
      subtotal,
      couponCode: couponQuote?.coupon.code || "",
      discount,
      shipping,
      total,
      paymentMethod,
      paymentStatus: paymentMethod === "wallet" ? "paid" : "pending",
      status: "Pending",
      paymentHistory: [
        {
          event:
            paymentMethod === "wallet" ? "wallet_payment" : "order_created",
          note: `Payment method: ${paymentMethod}`,
        },
      ],
    };
    let order;
    await withTransaction(async (session) => {
      const existing = await Order.findOne({
        user: req.user._id,
        idempotencyKey,
      }).session(session);
      if (existing) {
        order = existing;
        return;
      }
      if (couponQuote) {
        const couponFilter = {
          _id: couponQuote.coupon._id,
          active: true,
          $or: [
            { usageLimit: 0 },
            { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
          ],
          $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }],
        };
        const claimedCoupon = await Coupon.findOneAndUpdate(
          couponFilter,
          { $inc: { usageCount: 1 } },
          { new: true, session },
        );
        if (!claimedCoupon)
          throw Object.assign(new Error("This coupon has just reached its usage limit. Try another coupon."), { status: 409 });
      }
      await reserveStock(orderItems, session);
      if (paymentMethod === "wallet") {
        const walletPayment = await Wallet.findOneAndUpdate(
          { user: user._id, balancePaise: { $gte: amount(total) } },
          {
            $inc: { balancePaise: -amount(total) },
            $push: {
              transactions: {
                $each: [
                  {
                    type: "debit",
                    source: "order",
                    description: `Paid for order ${orderDraft.orderNumber}`,
                    amountPaise: amount(total),
                    reference: orderDraft.orderNumber,
                    status: "completed",
                  },
                ],
                $slice: -500,
              },
            },
          },
          { new: true, session },
        );
        if (!walletPayment)
          throw Object.assign(
            new Error("Your wallet balance is not enough for this order."),
            { status: 409 },
          );
      }
      [order] = await Order.create([orderDraft], { session });
    });
    if (["cod", "wallet"].includes(paymentMethod))
      return res.status(201).json({ order });
    const rp = await razorpayCall("/orders", {
      amount: amount(total),
      currency: "INR",
      receipt: order.orderNumber,
      notes: { orderId: String(order._id) },
    });
    order.paymentOrderId = rp.id;
    order.paymentHistory.push({
      event: "razorpay_order_created",
      reference: rp.id,
    });
    await order.save();
    return res
      .status(201)
      .json({
        order,
        razorpay: {
          keyId: process.env.RAZORPAY_KEY_ID,
          orderId: rp.id,
          amount: rp.amount,
          currency: rp.currency,
        },
      });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Order.findOne({
        user: req.user._id,
        idempotencyKey,
      });
      if (duplicate) return res.json({ order: duplicate });
    }
    console.error("Order creation failed:", error.message);
    if (
      /Transaction numbers are only allowed|replica set|does not support transactions/i.test(
        error.message,
      )
    ) {
      return res
        .status(503)
        .json({
          message:
            "Order creation needs MongoDB transaction support. Use MongoDB Atlas or configure your local MongoDB as a replica set, then restart the backend.",
        });
    }
    return res
      .status(error.status || 500)
      .json({ message: error.message || "Could not place the order." });
  }
});

router.get("/", async (req, res) => {
  const search = String(req.query.search || "")
    .trim()
    .slice(0, 80);
  const filter = { user: req.user._id };
  if (search)
    filter.orderNumber = { $regex: escapeRegex(search), $options: "i" };
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ orders });
});

router.get("/admin", adminOnly, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1),
    limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const q = escapeRegex(String(req.query.search).slice(0, 80));
    filter.$or = [
      { orderNumber: { $regex: q, $options: "i" } },
      { "customer.name": { $regex: q, $options: "i" } },
      { "customer.email": { $regex: q, $options: "i" } },
    ];
  }
  const sort = {
    oldest: { createdAt: 1, _id: 1 },
    amountLow: { total: 1, createdAt: -1 },
    amountHigh: { total: -1, createdAt: -1 },
  }[req.query.sort] || { createdAt: -1, _id: -1 };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  res.json({
    orders,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

router.get("/:id", async (req, res) => {
  const filter = mongoose.isValidObjectId(req.params.id)
    ? { _id: req.params.id }
    : { orderNumber: req.params.id };
  if (req.user.role !== "admin") filter.user = req.user._id;
  const order = await Order.findOne(filter);
  if (!order) return res.status(404).json({ message: "Order not found." });
  res.json({ order });
});

router.get("/:id/invoice.pdf", async (req, res) => {
  const filter = { _id: req.params.id };
  if (req.user.role !== "admin") filter.user = req.user._id;
  const order = await Order.findOne(filter).lean();
  if (!order) return res.status(404).json({ message: "Order not found." });
  const lines = [
    `MOBIX INVOICE`,
    `Order: ${order.orderNumber}`,
    `Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`,
    `Customer: ${order.customer?.name || ""}`,
    `Address: ${order.address?.line1 || ""}, ${order.address?.city || ""}`,
    "",
    ...order.items.map(
      (i) => `${i.name} x ${i.quantity} - Rs. ${i.lineTotal.toFixed(2)}`,
    ),
    "",
    `Subtotal: Rs. ${order.subtotal.toFixed(2)}`,
    ...(order.discount ? [`Coupon (${order.couponCode}): -Rs. ${order.discount.toFixed(2)}`] : []),
    `Shipping: Rs. ${order.shipping.toFixed(2)}`,
    `Total: Rs. ${order.total.toFixed(2)}`,
    `Payment: ${order.paymentMethod.toUpperCase()} (${order.paymentStatus})`,
  ];
  const clean = (s) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^\x20-\x7E]/g, "?");
  const stream = `BT /F1 12 Tf 50 790 Td 18 TL ${lines.map((line, i) => `${i ? "T* " : ""}(${clean(line)}) Tj`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${order.orderNumber}-invoice.pdf"`,
  });
  res.send(Buffer.from(pdf));
});

router.patch("/:id/cancel", async (req, res) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason)
      return res
        .status(400)
        .json({ message: "A cancellation reason is required." });
    if (reason.length > 500)
      return res
        .status(400)
        .json({
          message: "Cancellation reason must be 500 characters or fewer.",
        });
    const existing = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!existing) return res.status(404).json({ message: "Order not found." });
    const updated = await withTransaction(async (session) => {
      const order = await Order.findOne({
        _id: req.params.id,
        user: req.user._id,
      }).session(session);
      if (!order)
        throw Object.assign(new Error("Order not found."), { status: 404 });
      if (order.status !== "Pending")
        throw Object.assign(
          new Error("You can cancel an order only while it is Pending."),
          { status: 409 },
        );
      if (
        order.paymentStatus === "paid" &&
        !["wallet", "razorpay"].includes(order.paymentMethod)
      )
        throw Object.assign(
          new Error(
            "This payment method requires administrator refund processing before cancellation.",
          ),
          { status: 409 },
        );
      if (order.stockRestored)
        throw Object.assign(
          new Error("Stock was already restored for this order."),
          { status: 409 },
        );
      order.status = "Cancelled";
      order.cancellationReason = reason;
      order.paymentHistory.push({ event: "cancelled", note: reason });
      if (order.paymentStatus === "paid")
        await refundWalletOrder(
          order,
          session,
          "Wallet balance returned after order cancellation.",
        );
      await restoreStock(order, session);
      return order;
    });
    return res.json({ order: updated });
  } catch (e) {
    return res
      .status(e.status || 500)
      .json({ message: e.message || "Could not cancel the order." });
  }
});

router.post("/:id/return", async (req, res) => {
  const reason = String(req.body.reason || "").trim();
  if (!reason)
    return res.status(400).json({ message: "A return reason is required." });
  if (reason.length > 1000)
    return res
      .status(400)
      .json({ message: "Return reason must be 1000 characters or fewer." });
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found." });
  if (order.status !== "Delivered" || order.returnRequest.status !== "none")
    return res
      .status(409)
      .json({
        message:
          "Only delivered orders without an existing return request are eligible.",
      });
  order.returnRequest = {
    reason: reason.slice(0, 1000),
    status: "requested",
    requestedAt: new Date(),
  };
  await order.save();
  res.json({ order });
});

router.patch("/:id/status", adminOnly, async (req, res) => {
  const next = req.body.status;
  if (!transitions[next])
    return res.status(400).json({ message: "Invalid order status." });
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.status === "Cancelled" && next === "Pending") {
      if (
        ["paid", "refunded"].includes(order.paymentStatus) ||
        order.refundStatus !== "none"
      )
        return res
          .status(409)
          .json({
            message:
              "A cancelled order with a payment or refund cannot be reopened.",
          });
      const reopened = await withTransaction(async (session) => {
        const current = await Order.findOne({
          _id: order._id,
          status: "Cancelled",
          paymentStatus: { $nin: ["paid", "refunded"] },
          refundStatus: "none",
        }).session(session);
        if (!current)
          throw Object.assign(
            new Error("This order can no longer be reopened."),
            { status: 409 },
          );
        if (current.stockRestored) {
          await reserveStock(current.items, session);
          current.stockRestored = false;
        }
        current.status = "Pending";
        current.paymentHistory.push({
          event: "status_changed",
          note: "Reopened by administrator as Pending",
        });
        await current.save({ session });
        return current;
      });
      return res.json({ order: reopened });
    }
    if (!transitions[order.status].includes(next))
      return res
        .status(409)
        .json({ message: `Cannot change ${order.status} to ${next}.` });
    if (
      next === "Confirmed" &&
      order.paymentMethod === "razorpay" &&
      order.paymentStatus !== "paid"
    )
      return res
        .status(409)
        .json({
          message: "Online orders can only be confirmed after payment.",
        });
    if (
      next === "Cancelled" &&
      order.paymentStatus === "paid" &&
      !["wallet", "razorpay"].includes(order.paymentMethod)
    )
      return res
        .status(409)
        .json({ message: "Refund the paid order before cancelling it." });
    if (next === "Cancelled") {
      const updated = await withTransaction(async (session) => {
        const current = await Order.findById(order._id).session(session);
        if (!current)
          throw Object.assign(new Error("Order not found."), { status: 404 });
        if (
          !transitions[current.status].includes("Cancelled") ||
          (current.paymentStatus === "paid" &&
            !["wallet", "razorpay"].includes(current.paymentMethod)) ||
          current.stockRestored
        )
          throw Object.assign(
            new Error(
              "The order changed before cancellation. Refresh and try again.",
            ),
            { status: 409 },
          );
        current.status = "Cancelled";
        current.cancellationReason = "Cancelled by administrator";
        current.paymentHistory.push({
          event: "status_changed",
          note: "Cancelled",
        });
        if (current.paymentStatus === "paid")
          await refundWalletOrder(
            current,
            session,
            "Wallet balance returned after administrator cancellation.",
          );
        await restoreStock(current, session);
        return current;
      });
      return res.json({ order: updated });
    }
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: order.status },
      {
        $set: { status: next },
        $push: { paymentHistory: { event: "status_changed", note: next } },
      },
      { new: true },
    );
    if (!updated)
      return res
        .status(409)
        .json({
          message:
            "The order changed before this update. Refresh and try again.",
        });
    return res.json({ order: updated });
  } catch (e) {
    return res
      .status(e.status || 500)
      .json({ message: e.message || "Could not update the order." });
  }
});

router.patch("/:id/return-review", adminOnly, async (req, res) => {
  const decision = req.body.decision;
  if (!["accepted", "rejected", "completed"].includes(decision))
    return res
      .status(400)
      .json({
        message: "Choose accept, reject, or mark the return as received.",
      });
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });
    const fromStatus = decision === "completed" ? "accepted" : "requested";
    if (order.returnRequest.status !== fromStatus)
      return res
        .status(409)
        .json({
          message:
            decision === "completed"
              ? "Only an accepted return can be marked as received."
              : "Pending return request not found.",
        });
    if (decision === "completed") {
      const updated = await withTransaction(async (session) => {
        const current = await Order.findById(order._id).session(session);
        if (!current || current.returnRequest.status !== "accepted")
          throw Object.assign(
            new Error(
              "The return request changed before completion. Refresh and try again.",
            ),
            { status: 409 },
          );
        if (current.stockRestored)
          throw Object.assign(
            new Error("Stock was already restored for this order."),
            { status: 409 },
          );
        current.returnRequest.status = "completed";
        current.returnRequest.reviewedAt = new Date();
        await refundWalletOrder(
          current,
          session,
          "Wallet balance returned after the order return was received.",
        );
        await restoreStock(current, session);
        return current;
      });
      return res.json({ order: updated });
    }
    const update = {
      $set: {
        "returnRequest.status": decision,
        "returnRequest.reviewedAt": new Date(),
      },
    };
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, "returnRequest.status": fromStatus },
      update,
      { new: true },
    );
    if (!updated)
      return res
        .status(409)
        .json({
          message:
            "The return request changed before this update. Refresh and try again.",
        });
    return res.json({ order: updated });
  } catch (e) {
    return res
      .status(e.status || 500)
      .json({ message: e.message || "Could not review the return." });
  }
});

router.post("/:id/payment/retry", async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user._id,
    paymentMethod: "razorpay",
    status: { $ne: "Cancelled" },
    paymentStatus: { $ne: "paid" },
  });
  if (!order)
    return res
      .status(404)
      .json({ message: "Payment retry is not available for this order." });
  try {
    const rp = await razorpayCall("/orders", {
      amount: amount(order.total),
      currency: "INR",
      receipt: order.orderNumber,
      notes: { orderId: String(order._id) },
    });
    order.paymentStatus = "pending";
    order.paymentOrderId = rp.id;
    order.paymentHistory.push({ event: "payment_retry", reference: rp.id });
    await order.save();
    res.json({
      order,
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: rp.id,
        amount: rp.amount,
        currency: rp.currency,
      },
    });
  } catch (e) {
    order.paymentStatus = "failed";
    order.paymentHistory.push({
      event: "payment_retry_setup_failed",
      note: e.message,
    });
    await order.save();
    res.status(e.status || 502).json({ message: e.message });
  }
});

router.post("/:id/payment/verify", async (req, res) => {
  if (!hasRazorpayConfig())
    return res
      .status(503)
      .json({
        message:
          "Online payment verification is unavailable because Razorpay is not configured on the server.",
      });
  const {
    razorpay_order_id: paymentOrderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body || {};
  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user._id,
    paymentMethod: "razorpay",
  });
  if (!order) return res.status(404).json({ message: "Order not found." });
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${paymentOrderId}|${paymentId}`)
    .digest("hex");
  if (
    !paymentOrderId ||
    paymentOrderId !== order.paymentOrderId ||
    !signature ||
    Buffer.byteLength(expected) !== Buffer.byteLength(String(signature)) ||
    !crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(String(signature)),
    )
  )
    return res
      .status(400)
      .json({ message: "Payment signature verification failed." });
  if (order.paymentStatus === "paid") return res.json({ order });
  try {
    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
    ).toString("base64");
    const resp = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    let payment = await resp.json().catch(() => ({}));
    if (
      !resp.ok ||
      payment.order_id !== paymentOrderId ||
      payment.amount !== amount(order.total) ||
      payment.currency !== "INR"
    )
      return res
        .status(400)
        .json({ message: "Razorpay payment details do not match this order." });
    if (payment.status === "authorized") {
      try {
        payment = await razorpayCall(
          `/payments/${encodeURIComponent(paymentId)}/capture`,
          { amount: amount(order.total), currency: "INR" },
        );
      } catch (captureError) {
        // A retry can race with an automatic capture; fetch the payment again before failing.
        const latestResponse = await fetch(
          `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
          { headers: { Authorization: `Basic ${auth}` } },
        );
        const latestPayment = await latestResponse.json().catch(() => ({}));
        if (!latestResponse.ok || latestPayment.status !== "captured")
          throw captureError;
        payment = latestPayment;
      }
    }
    if (
      payment.order_id !== paymentOrderId ||
      payment.amount !== amount(order.total) ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    )
      return res
        .status(400)
        .json({
          message:
            "Payment is authorized but not captured for the expected order amount. Please retry or contact support.",
        });
    const updated = await Order.findOneAndUpdate(
      {
        _id: order._id,
        user: req.user._id,
        paymentOrderId,
        status: { $ne: "Cancelled" },
        paymentStatus: { $ne: "paid" },
      },
      {
        $set: { paymentStatus: "paid", paymentId, status: "Confirmed" },
        $push: {
          paymentHistory: { event: "payment_verified", reference: paymentId },
        },
      },
      { new: true },
    );
    if (!updated) {
      const current = await Order.findById(order._id);
      if (current?.paymentStatus === "paid")
        return res.json({ order: current });
      return res
        .status(409)
        .json({
          message:
            "Order changed before payment verification completed. Contact support.",
        });
    }
    return res.json({ order: updated });
  } catch (e) {
    return res
      .status(502)
      .json({ message: "Could not verify payment with Razorpay." });
  }
});

router.post("/:id/payment/failure", async (req, res) => {
  const filter = {
    _id: req.params.id,
    user: req.user._id,
    paymentMethod: "razorpay",
    paymentStatus: { $ne: "paid" },
  };
  if (req.body.paymentOrderId) filter.paymentOrderId = req.body.paymentOrderId;
  const order = await Order.findOneAndUpdate(
    filter,
    {
      $set: { paymentStatus: "failed" },
      $push: {
        paymentHistory: {
          event: "payment_failed",
          reference: String(req.body.paymentId || ""),
          note: String(req.body.reason || "Payment was not completed.").slice(
            0,
            300,
          ),
        },
      },
    },
    { new: true },
  );
  if (!order)
    return res
      .status(409)
      .json({
        message: "Order was already paid or that payment attempt has expired.",
      });
  res.json({ order });
});

export default router;

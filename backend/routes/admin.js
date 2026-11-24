import { Router } from "express";
import mongoose from "mongoose";
import { protect, adminOnly } from "../middleware/auth.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Order from "../models/Order.js";
import ProductReview from "../models/ProductReview.js";
import Wallet from "../models/Wallet.js";
import WalletTopUp from "../models/WalletTopUp.js";
import Coupon from "../models/Coupon.js";

const router = Router();
router.use(protect, adminOnly);

router.get("/coupons", async (_req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    return res.json({ coupons });
  } catch (error) {
    console.error("Admin coupon list failed:", error.message);
    return res.status(500).json({ message: "Could not load coupons." });
  }
});

router.post("/coupons", async (req, res) => {
  try {
    const payload = normalizeCoupon(req.body);
    const coupon = await Coupon.create(payload);
    return res.status(201).json({ coupon, message: "Coupon created." });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "That coupon code already exists." });
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    return res.status(error.status || 500).json({ message: error.message || "Could not create coupon." });
  }
});

router.patch("/coupons/:id", async (req, res) => {
  try {
    const payload = normalizeCoupon(req.body);
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true, runValidators: true });
    if (!coupon) return res.status(404).json({ message: "Coupon not found." });
    return res.json({ coupon, message: "Coupon updated." });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "That coupon code already exists." });
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    return res.status(error.status || 500).json({ message: error.message || "Could not update coupon." });
  }
});

router.delete("/coupons/:id", async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found." });
    return res.json({ message: "Coupon deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Could not delete coupon." });
  }
});

function normalizeCoupon(body = {}) {
  const code = String(body.code || "").trim().toUpperCase();
  const discountType = body.discountType;
  const discountValue = Number(body.discountValue);
  const minSubtotal = Number(body.minSubtotal || 0);
  const maxDiscount = Number(body.maxDiscount || 0);
  const usageLimit = Number(body.usageLimit || 0);
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw Object.assign(new Error("Coupon code must be 3–30 letters, numbers, hyphens, or underscores."), { status: 400 });
  if (!["percentage", "fixed"].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "percentage" && discountValue > 100)) throw Object.assign(new Error("Enter a valid discount type and value."), { status: 400 });
  if (![minSubtotal, maxDiscount, usageLimit].every((value) => Number.isFinite(value) && value >= 0) || !Number.isInteger(usageLimit)) throw Object.assign(new Error("Minimum subtotal, maximum discount, and usage limit must be valid non-negative numbers."), { status: 400 });
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw Object.assign(new Error("Enter a valid expiry date."), { status: 400 });
  return { code, discountType, discountValue, minSubtotal, maxDiscount, usageLimit, expiresAt, active: body.active !== false };
}
const validVariant = (variant) =>
  Boolean(variant?.name?.trim()) &&
  variant.stock !== undefined &&
  variant.stock !== null &&
  String(variant.stock).trim() !== "" &&
  Number.isInteger(Number(variant.stock)) &&
  Number(variant.stock) >= 0 &&
  (variant.price === undefined ||
    variant.price === null ||
    variant.price === "" ||
    (Number.isFinite(Number(variant.price)) && Number(variant.price) >= 0));

router.get("/reports", async (_req, res) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setMonth(monthStart.getMonth() - 5);
    const [
      users,
      products,
      categories,
      totalOrders,
      revenue,
      monthlySales,
      paymentMethods,
      orderStatuses,
      topCustomers,
      topProducts,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Product.countDocuments({ deletedAt: null }),
      Category.countDocuments({ deletedAt: null }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { status: { $ne: "Cancelled" } } },
        {
          $group: {
            _id: null,
            amount: { $sum: "$total" },
            orders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            status: { $ne: "Cancelled" },
            createdAt: { $gte: monthStart },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            amount: { $sum: "$total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: "$paymentMethod",
            orders: { $sum: 1 },
            amount: { $sum: "$total" },
            paidAmount: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0],
              },
            },
          },
        },
        { $sort: { orders: -1 } },
      ]),
      Order.aggregate([
        { $group: { _id: "$status", orders: { $sum: 1 } } },
        { $sort: { orders: -1 } },
      ]),
      Order.aggregate([
        {
          $match: {
            status: { $ne: "Cancelled" },
            "customer.email": { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: "$customer.email",
            name: { $first: "$customer.name" },
            orders: { $sum: 1 },
            amount: { $sum: "$total" },
          },
        },
        { $sort: { amount: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([
        { $match: { status: { $ne: "Cancelled" } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            name: { $first: "$items.name" },
            quantity: { $sum: "$items.quantity" },
            amount: { $sum: "$items.lineTotal" },
          },
        },
        { $sort: { quantity: -1, amount: -1 } },
        { $limit: 5 },
      ]),
    ]);
    return res.json({
      users,
      products,
      categories,
      totalOrders,
      totalSales: revenue[0]?.amount || 0,
      averageOrderValue: revenue[0]?.orders
        ? revenue[0].amount / revenue[0].orders
        : 0,
      monthlySales,
      paymentMethods,
      orderStatuses,
      topCustomers,
      topProducts,
    });
  } catch (error) {
    console.error("Admin reports failed:", error.message);
    return res.status(500).json({ message: "Could not load admin reports." });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 100);
    const filter =
      req.query.deleted === "true"
        ? { deletedAt: { $exists: true, $ne: null } }
        : { deletedAt: null };
    if (search)
      filter.name = {
        $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    const [total, categories] = await Promise.all([
      Category.countDocuments(filter),
      Category.find(filter)
        .populate("parent", "name")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    return res.json({
      categories,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Admin category list failed:", error.message);
    return res.status(500).json({ message: "Could not load categories." });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const id = String(
      req.body?.id ||
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
    ).trim();
    const parentId = String(req.body?.parentId || "").trim();
    if (!name || name.length > 80 || !id || id.length > 80)
      return res
        .status(400)
        .json({ message: "Enter a category name (up to 80 characters)." });
    if (parentId) {
      const parent = await Category.findOne({ _id: parentId, deletedAt: null });
      if (!parent || parent.parent)
        return res
          .status(400)
          .json({
            message: "Choose an active top-level category as the parent.",
          });
    }
    const category = await Category.create({
      _id: id,
      name,
      parent: parentId || null,
    });
    return res.status(201).json({ category, message: "Category created." });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: "That category ID already exists." });
    if (error.name === "ValidationError")
      return res.status(400).json({ message: error.message });
    console.error("Admin category create failed:", error.message);
    return res.status(500).json({ message: "Could not create category." });
  }
});

router.patch("/categories/:id", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const parentId = String(req.body?.parentId || "").trim();
    if (!name || name.length > 80)
      return res
        .status(400)
        .json({ message: "Enter a category name up to 80 characters." });
    if (parentId) {
      if (parentId === req.params.id)
        return res
          .status(400)
          .json({ message: "A category cannot be its own parent." });
      const parent = await Category.findOne({ _id: parentId, deletedAt: null });
      if (!parent || parent.parent)
        return res
          .status(400)
          .json({
            message: "Choose an active top-level category as the parent.",
          });
    }
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { name, parent: parentId || null } },
      { new: true, runValidators: true },
    );
    if (!category)
      return res.status(404).json({ message: "Category not found." });
    return res.json({ category, message: "Category updated." });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: "That category name is already in use." });
    console.error("Admin category update failed:", error.message);
    return res.status(500).json({ message: "Could not update category." });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const deletedAt = new Date();
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { deletedAt } },
      { new: true },
    );
    if (!category)
      return res.status(404).json({ message: "Category not found." });
    await Category.updateMany(
      { parent: category._id, deletedAt: null },
      { $set: { deletedAt } },
    );
    return res.json({
      message: "Category removed. Its products are hidden from the store.",
    });
  } catch (error) {
    console.error("Admin category delete failed:", error.message);
    return res.status(500).json({ message: "Could not remove category." });
  }
});

router.post("/categories/:id/restore", async (req, res) => {
  try {
    const deletedCategory = await Category.findOne({
      _id: req.params.id,
      deletedAt: { $exists: true, $ne: null },
    });
    if (!deletedCategory)
      return res.status(404).json({ message: "Deleted category not found." });
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id },
      { $set: { deletedAt: null } },
      { new: true },
    );
    await Category.updateMany(
      { parent: category._id, deletedAt: deletedCategory.deletedAt },
      { $set: { deletedAt: null } },
    );
    return res.json({ category, message: "Category restored." });
  } catch (error) {
    console.error("Admin category restore failed:", error.message);
    return res.status(500).json({ message: "Could not restore category." });
  }
});

router.get("/products", async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 100);
    const category = String(req.query.category || "")
      .trim()
      .slice(0, 80);
    const status = String(req.query.status || "").trim();
    const filter =
      req.query.deleted === "true"
        ? { deletedAt: { $exists: true, $ne: null } }
        : { deletedAt: null };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { _id: { $regex: escaped, $options: "i" } },
      ];
    }
    if (category) {
      const childCategories = await Category.find({
        parent: category,
        deletedAt: null,
      }).distinct("_id");
      filter.category = { $in: [category, ...childCategories] };
    }
    if (status === "published") filter.published = true;
    if (status === "draft") filter.published = false;
    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("category", "name")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    return res.json({
      products: products.map((product) => ({
        ...product.toObject(),
        categoryName: product.category?.name || "",
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Admin product list failed:", error.message);
    return res.status(500).json({ message: "Could not load products." });
  }
});

router.post("/products", async (req, res) => {
  try {
    const {
      id,
      name,
      description,
      subtitle = "",
      tag = "",
      highlights = [],
      category,
      price,
      oldPrice,
      stock,
      images = [],
      variants = [],
      published = false,
    } = req.body;
    if (
      !id ||
      !name ||
      !description ||
      !category ||
      !Number.isFinite(Number(price)) ||
      !Number.isFinite(Number(oldPrice)) ||
      !Number.isInteger(Number(stock))
    ) {
      return res
        .status(400)
        .json({
          message:
            "Enter an ID, name, description, category, valid prices, and whole-number stock.",
        });
    }
    if (!(await Category.exists({ _id: category, deletedAt: null })))
      return res.status(400).json({ message: "Choose an active category." });
    if (
      !Array.isArray(images) ||
      images.length > 3 ||
      images.some(
        (image) => typeof image !== "string" || image.length > 2_000_000,
      )
    )
      return res
        .status(400)
        .json({ message: "Upload up to 3 valid product images." });
    if (
      !Array.isArray(highlights) ||
      highlights.length > 12 ||
      highlights.some(
        (item) => typeof item !== "string" || item.trim().length > 160,
      )
    )
      return res
        .status(400)
        .json({
          message:
            "Enter up to 12 highlights, each no longer than 160 characters.",
        });
    if (
      !Array.isArray(variants) ||
      variants.length > 30 ||
      variants.some((variant) => !validVariant(variant))
    )
      return res
        .status(400)
        .json({
          message:
            "Each variant needs a name and a whole-number stock value. Variant prices must be non-negative.",
        });
    const normalizedVariants = variants.map((variant) => ({
      name: variant.name.trim(),
      stock: Number(variant.stock),
      ...(variant.price !== undefined &&
      variant.price !== null &&
      variant.price !== ""
        ? { price: Number(variant.price) }
        : {}),
      sku: String(variant.sku || "").trim(),
    }));
    const product = await Product.create({
      _id: String(id).trim(),
      name,
      description,
      subtitle,
      tag,
      highlights,
      category,
      price: Number(price),
      oldPrice: Number(oldPrice),
      stock: normalizedVariants.length
        ? normalizedVariants.reduce((sum, variant) => sum + variant.stock, 0)
        : Number(stock),
      variants: normalizedVariants,
      images,
      published: Boolean(published),
    });
    return res.status(201).json({ product, message: "Product created." });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: "A product with that ID already exists." });
    if (error.name === "ValidationError")
      return res.status(400).json({ message: error.message });
    console.error("Admin product create failed:", error.message);
    return res.status(500).json({ message: "Could not create product." });
  }
});

router.patch("/products/:id", async (req, res) => {
  try {
    const changes = { ...req.body };
    delete changes._id;
    delete changes.id;
    if (!(await Product.exists({ _id: req.params.id, deletedAt: null })))
      return res.status(404).json({ message: "Product not found." });
    const existingImages =
      changes.images === undefined
        ? (
            await Product.findOne({ _id: req.params.id, deletedAt: null })
              .select("images")
              .lean()
          )?.images
        : changes.images;
    if (
      !Array.isArray(existingImages) ||
      existingImages.length > 3 ||
      existingImages.some(
        (image) => typeof image !== "string" || image.length > 2_000_000,
      )
    )
      return res
        .status(400)
        .json({ message: "Upload up to 3 valid product images." });
    if (
      changes.highlights !== undefined &&
      (!Array.isArray(changes.highlights) ||
        changes.highlights.length > 12 ||
        changes.highlights.some(
          (item) => typeof item !== "string" || item.trim().length > 160,
        ))
    )
      return res
        .status(400)
        .json({ message: "Enter up to 12 valid product highlights." });
    if (
      changes.variants !== undefined &&
      (!Array.isArray(changes.variants) ||
        changes.variants.length > 30 ||
        changes.variants.some((variant) => !validVariant(variant)))
    )
      return res
        .status(400)
        .json({
          message:
            "Each variant needs a name and a whole-number stock value. Variant prices must be non-negative.",
        });
    if (changes.variants !== undefined) {
      changes.variants = changes.variants.map((variant) => ({
        name: variant.name.trim(),
        stock: Number(variant.stock),
        ...(variant.price !== undefined &&
        variant.price !== null &&
        variant.price !== ""
          ? { price: Number(variant.price) }
          : {}),
        sku: String(variant.sku || "").trim(),
      }));
      if (changes.variants.length > 0)
        changes.stock = changes.variants.reduce(
          (sum, variant) => sum + variant.stock,
          0,
        );
    }
    if (
      changes.category &&
      !(await Category.exists({ _id: changes.category, deletedAt: null }))
    )
      return res.status(400).json({ message: "Choose an active category." });
    for (const field of ["price", "oldPrice", "stock"])
      if (changes[field] !== undefined) changes[field] = Number(changes[field]);
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: changes },
      { new: true, runValidators: true },
    ).populate("category", "name");
    if (!product)
      return res.status(404).json({ message: "Product not found." });
    return res.json({ product, message: "Product updated." });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError")
      return res.status(400).json({ message: error.message });
    console.error("Admin product update failed:", error.message);
    return res.status(500).json({ message: "Could not update product." });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { deletedAt: new Date(), published: false } },
      { new: true },
    );
    if (!product)
      return res.status(404).json({ message: "Product not found." });
    return res.json({ message: "Product removed from the catalogue." });
  } catch (error) {
    console.error("Admin product delete failed:", error.message);
    return res.status(500).json({ message: "Could not remove product." });
  }
});

router.post("/products/:id/restore", async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, deletedAt: { $exists: true, $ne: null } },
      { $set: { deletedAt: null, published: false } },
      { new: true },
    );
    if (!product)
      return res.status(404).json({ message: "Deleted product not found." });
    return res.json({
      product,
      message: "Product restored as a draft. Publish it when ready.",
    });
  } catch (error) {
    console.error("Admin product restore failed:", error.message);
    return res.status(500).json({ message: "Could not restore product." });
  }
});

router.get("/me", (req, res) =>
  res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  }),
);

router.get("/profile", async (req, res) => {
  try {
    const profile = req.user.adminProfile || {};
    const defaults = {};
    if (!profile.name) defaults["adminProfile.name"] = req.user.name;
    if (!profile.email) defaults["adminProfile.email"] = req.user.email;
    if (profile.profileImage === undefined)
      defaults["adminProfile.profileImage"] = req.user.profileImage || "";
    if (Object.keys(defaults).length)
      await User.updateOne({ _id: req.user._id }, { $set: defaults });
    return res.json({
      id: req.user._id,
      name: profile.name || defaults["adminProfile.name"] || req.user.name,
      email: profile.email || defaults["adminProfile.email"] || req.user.email,
      profileImage:
        profile.profileImage ?? defaults["adminProfile.profileImage"] ?? "",
      role: req.user.role,
      blocked: req.user.blocked,
    });
  } catch (error) {
    console.error("Admin profile load failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not load the admin profile." });
  }
});

router.get("/reviews", async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const status = ["pending", "approved", "rejected"].includes(
      req.query.status,
    )
      ? req.query.status
      : "";
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 100);
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const expression = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      filter.$or = [
        { productName: expression },
        { customerName: expression },
        { customerEmail: expression },
        { comment: expression },
      ];
    }
    const [total, reviews] = await Promise.all([
      ProductReview.countDocuments(filter),
      ProductReview.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    return res.json({
      reviews,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Admin reviews list failed:", error.message);
    return res.status(500).json({ message: "Could not load reviews." });
  }
});

router.patch("/reviews/:id/status", async (req, res) => {
  const status = String(req.body?.status || "");
  if (!["approved", "rejected"].includes(status))
    return res.status(400).json({ message: "Choose approved or rejected." });
  const review = await ProductReview.findByIdAndUpdate(
    req.params.id,
    { $set: { status } },
    { new: true, runValidators: true },
  );
  if (!review) return res.status(404).json({ message: "Review not found." });
  return res.json({ review, message: `Review ${status}.` });
});

router.delete("/reviews/:id", async (req, res) => {
  const review = await ProductReview.findByIdAndDelete(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found." });
  return res.json({ message: "Review deleted." });
});

router.put("/profile", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const profileImage =
      typeof req.body?.profileImage === "string"
        ? req.body.profileImage.trim()
        : "";
    if (!name || name.length > 80)
      return res
        .status(400)
        .json({ message: "Name must be between 1 and 80 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return res.status(400).json({ message: "Enter a valid email address." });
    if (
      profileImage &&
      !/^https:\/\//i.test(profileImage) &&
      !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/i.test(
        profileImage,
      )
    )
      return res.status(400).json({ message: "Choose a valid profile image." });
    if (profileImage.length > 1_500_000)
      return res
        .status(413)
        .json({
          message: "Profile image is too large. Choose a smaller photo.",
        });
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "adminProfile.name": name,
          "adminProfile.email": email,
          "adminProfile.profileImage": profileImage,
        },
      },
      { new: true, runValidators: true },
    ).select("name email role blocked profileImage adminProfile");
    const profile = user.adminProfile || {};
    return res.json({
      id: user._id,
      name: profile.name,
      email: profile.email,
      profileImage: profile.profileImage || "",
      role: user.role,
      blocked: user.blocked,
    });
  } catch (error) {
    console.error("Admin profile update failed:", error.message);
    return res.status(500).json({ message: "Could not update admin profile." });
  }
});

router.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const search = (req.query.search || "").trim().slice(0, 100);
    const query = { role: "user" };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }
    const [totalUsers, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    const wallets = await Wallet.find({
      user: { $in: users.map((user) => user._id) },
    })
      .select("user balancePaise")
      .lean();
    const walletBalances = new Map(
      wallets.map((wallet) => [String(wallet.user), wallet.balancePaise || 0]),
    );
    const enrichedUsers = users.map((user) => ({
      ...user.toObject(),
      walletBalancePaise: walletBalances.get(String(user._id)) || 0,
    }));
    return res.json({
      users: enrichedUsers,
      page,
      limit,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
    });
  } catch (error) {
    console.error("Admin user list failed:", error.message);
    return res.status(500).json({ message: "Could not load users." });
  }
});

router.patch("/users/:id/block", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid user id." });
    if (typeof req.body.blocked !== "boolean")
      return res
        .status(400)
        .json({ message: "blocked must be true or false." });
    if (String(req.user._id) === req.params.id)
      return res
        .status(400)
        .json({ message: "You cannot block your own administrator account." });
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "user" },
      { $set: { blocked: req.body.blocked } },
      { new: true, runValidators: true },
    ).select("-password");
    if (!user)
      return res.status(404).json({ message: "Customer account not found." });
    return res.json({
      message: req.body.blocked ? "User blocked." : "User unblocked.",
      user,
    });
  } catch (error) {
    console.error("User status update failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not update the user status." });
  }
});

router.get("/users/:id/wallet", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid user id." });
    const user = await User.findOne({ _id: req.params.id, role: "user" })
      .select("_id")
      .lean();
    if (!user)
      return res.status(404).json({ message: "Customer account not found." });
    const [wallet, topUps] = await Promise.all([
      Wallet.findOne({ user: user._id }).lean(),
      WalletTopUp.find({
        user: user._id,
        status: { $in: ["pending", "failed"] },
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);
    const transactions = [
      ...(wallet?.transactions || []).map((item) => ({
        ...item,
        balanceChange: true,
      })),
      ...topUps.map((item) => ({
        type: "credit",
        source: item.source,
        description:
          item.description ||
          (item.source === "admin_credit"
            ? "Admin wallet credit"
            : "Wallet top-up"),
        amountPaise: item.amountPaise,
        reference: item.receipt || item.requestKey,
        status: item.status === "credited" ? "completed" : item.status,
        balanceChange: false,
        createdAt: item.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 100);
    return res.json({ balancePaise: wallet?.balancePaise || 0, transactions });
  } catch (error) {
    console.error("Admin wallet history failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not load the customer wallet history." });
  }
});

router.post("/users/:id/wallet/credit", async (req, res) => {
  let activity;
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid user id." });
    const amount = Number(req.body?.amount);
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000)
      return res
        .status(400)
        .json({
          message:
            "Enter an amount greater than ₹0 and no more than ₹10,00,000.",
        });
    if (!reason || reason.length > 180)
      return res
        .status(400)
        .json({ message: "Enter a reason (up to 180 characters)." });
    const amountPaise = Math.round(amount * 100);
    if (amountPaise < 1)
      return res
        .status(400)
        .json({ message: "Enter an amount of at least ₹0.01." });
    const user = await User.findOne({ _id: req.params.id, role: "user" })
      .select("_id")
      .lean();
    if (!user)
      return res.status(404).json({ message: "Customer account not found." });
    const requestKey = `admin-${new mongoose.Types.ObjectId()}`;
    activity = await WalletTopUp.create({
      user: user._id,
      source: "admin_credit",
      requestKey,
      amountPaise,
      description: reason,
    });
    const wallet = await Wallet.findOneAndUpdate(
      { user: user._id },
      {
        $setOnInsert: { user: user._id },
        $inc: { balancePaise: amountPaise },
        $push: {
          transactions: {
            $each: [
              {
                type: "credit",
                source: "admin_credit",
                description: reason,
                amountPaise,
                reference: `admin-${new mongoose.Types.ObjectId()}`,
                status: "completed",
              },
            ],
            $slice: -500,
          },
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).select("balancePaise");
    await WalletTopUp.updateOne(
      { _id: activity._id, status: "pending" },
      { $set: { status: "credited" } },
    );
    return res.json({
      message: "Wallet credited successfully.",
      balancePaise: wallet.balancePaise,
    });
  } catch (error) {
    if (activity)
      await WalletTopUp.updateOne(
        { _id: activity._id, status: "pending" },
        { $set: { status: "failed" } },
      ).catch(() => {});
    console.error("Admin wallet credit failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not credit the customer wallet." });
  }
});

export default router;

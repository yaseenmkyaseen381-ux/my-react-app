import { Router } from "express";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import ProductReview from "../models/ProductReview.js";
import Order from "../models/Order.js";
import { protect } from "../middleware/auth.js";

const router = Router();
const MAX_CART_QUANTITY = 10;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function serializeProduct(product) {
  const value = product.toObject ? product.toObject() : product;
  const categoryName = value.category?.name || value.category;
  return {
    id: value._id,
    name: value.name,
    category: categoryName,
    categoryId: value.category?._id || value.category,
    description: value.description,
    detail: value.subtitle || "",
    highlights: value.highlights || [],
    price: value.price,
    oldPrice: value.oldPrice,
    stock: value.stock,
    variants: value.variants || [],
    published: value.published,
    blocked: value.blocked,
    tag: value.tag || "",
    images: value.images || [],
    image: value.images?.[0] || "",
    icon:
      {
        Mobiles: "📱",
        Laptops: "💻",
        Tablets: "▭",
        Audio: "🎧",
        Wearables: "⌚",
        Gaming: "🎮",
        Accessories: "▣",
      }[categoryName] || "▣",
  };
}

router.get("/categories", async (_req, res) => {
  try {
    const categories = await Category.find({ deletedAt: null })
      .populate("parent", "name")
      .sort({ name: 1 })
      .select("_id name parent")
      .lean();
    return res.json({
      categories: categories.map(({ _id, name, parent }) => ({
        id: _id,
        name,
        parentId: parent?._id || null,
        parentName: parent?.name || "",
      })),
    });
  } catch (error) {
    console.error("Category list failed:", error.message);
    return res.status(500).json({ message: "Could not load categories." });
  }
});

router.get("/wishlist", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("wishlist").lean();
    const activeCategories = await Category.find({ deletedAt: null }).distinct(
      "_id",
    );
    const activeIds = await Product.find({
      _id: { $in: user?.wishlist || [] },
      published: true,
      blocked: false,
      deletedAt: null,
      category: { $in: activeCategories },
    }).distinct("_id");
    return res.json({ productIds: activeIds });
  } catch (error) {
    console.error("Wishlist load failed:", error.message);
    return res.status(500).json({ message: "Could not load your wishlist." });
  }
});

router.get("/my-reviews", protect, async (req, res) => {
  if (req.user.role !== "user")
    return res.status(403).json({ message: "Customer account required." });
  try {
    const reviews = await ProductReview.find({ customerId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ reviews });
  } catch (error) {
    console.error("Customer reviews list failed:", error.message);
    return res.status(500).json({ message: "Could not load your reviews." });
  }
});

router.post("/wishlist/:productId", protect, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.productId,
      published: true,
      blocked: false,
      deletedAt: null,
    });
    if (!product)
      return res
        .status(404)
        .json({ message: "This product is no longer available." });
    if (!(await Category.exists({ _id: product.category, deletedAt: null })))
      return res
        .status(404)
        .json({ message: "This product is no longer available." });
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { wishlist: product._id } },
    );
    return res.json({
      message: "Product saved to your wishlist.",
      productId: product._id,
    });
  } catch (error) {
    console.error("Wishlist save failed:", error.message);
    return res.status(500).json({ message: "Could not update your wishlist." });
  }
});

router.delete("/wishlist/:productId", protect, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { wishlist: req.params.productId } },
    );
    return res.json({
      message: "Product removed from your wishlist.",
      productId: req.params.productId,
    });
  } catch (error) {
    console.error("Wishlist removal failed:", error.message);
    return res.status(500).json({ message: "Could not update your wishlist." });
  }
});

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 8),
    );
    const search = String(req.query.search || req.query.q || "")
      .trim()
      .slice(0, 100);
    const category = String(req.query.category || "")
      .trim()
      .slice(0, 80);
    const minPrice =
      req.query.minPrice === undefined || req.query.minPrice === ""
        ? undefined
        : Number(req.query.minPrice);
    const maxPrice =
      req.query.maxPrice === undefined || req.query.maxPrice === ""
        ? undefined
        : Number(req.query.maxPrice);
    if (
      (minPrice !== undefined &&
        (!Number.isFinite(minPrice) || minPrice < 0)) ||
      (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0))
    ) {
      return res
        .status(400)
        .json({ message: "Enter a valid non-negative price range." });
    }
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      return res
        .status(400)
        .json({
          message: "Minimum price cannot be greater than maximum price.",
        });
    }

    const activeCategories = await Category.find({ deletedAt: null }).distinct(
      "_id",
    );
    // Keep published products visible even when inventory reaches zero so customers
    // can still see the item and its out-of-stock status.
    const filter = {
      published: true,
      blocked: false,
      deletedAt: null,
      category: { $in: activeCategories },
    };
    if (category) {
      if (!activeCategories.includes(category))
        filter.category = "__no_such_category__";
      else {
        const childCategories = await Category.find({
          parent: category,
          deletedAt: null,
        }).distinct("_id");
        filter.category = { $in: [category, ...childCategories] };
      }
    }
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      const matchingCategories = await Category.find({
        deletedAt: null,
        name: expression,
      }).distinct("_id");
      const matchingChildCategories = matchingCategories.length
        ? await Category.find({
            deletedAt: null,
            parent: { $in: matchingCategories },
          }).distinct("_id")
        : [];
      filter.$or = [
        { name: expression },
        { description: expression },
        { subtitle: expression },
        {
          category: {
            $in: [...matchingCategories, ...matchingChildCategories],
          },
        },
      ];
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    const sortBy = {
      "price-low": { price: 1, _id: 1 },
      "price-high": { price: -1, _id: 1 },
      "name-az": { name: 1, _id: 1 },
      "name-za": { name: -1, _id: 1 },
      newest: { createdAt: -1, _id: -1 },
    }[req.query.sort] || { createdAt: -1, _id: -1 };

    const [total, rows] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("category", "name")
        .collation({ locale: "en", strength: 2 })
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    return res.json({
      products: rows.map(serializeProduct),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Product listing failed:", error.message);
    return res.status(500).json({ message: "Could not load products." });
  }
});

async function validateCart(req, res) {
  try {
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length > 50) {
      return res
        .status(400)
        .json({
          message: "Cart items must be a list with no more than 50 products.",
        });
    }

    const quantities = new Map();
    for (const item of items) {
      if (
        typeof item?.productId !== "string" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res
          .status(400)
          .json({
            message:
              "Each cart item needs a valid product and a quantity of at least one.",
          });
      }
      const key = `${item.productId}::${item.variantId || ""}`;
      quantities.set(key, {
        productId: item.productId,
        variantId: item.variantId || "",
        quantity: (quantities.get(key)?.quantity || 0) + item.quantity,
      });
    }

    const validatedItems = [];
    for (const { productId, variantId, quantity } of quantities.values()) {
      const product = await Product.findOne({
        _id: productId,
        published: true,
        blocked: false,
        deletedAt: null,
      }).populate("category", "name");
      if (!product)
        return res
          .status(404)
          .json({
            message: "A product in your cart is no longer available.",
            productId,
          });
      if (
        !(await Category.exists({
          _id: product.category?._id || product.category,
          deletedAt: null,
        }))
      )
        return res
          .status(404)
          .json({
            message: "A product category in your cart is no longer available.",
            productId,
          });
      const variant = variantId
        ? product.variants.find((option) => option._id.toString() === variantId)
        : null;
      if (product.variants.length && !variant)
        return res
          .status(400)
          .json({
            message: `Choose a valid variant for ${product.name}.`,
            productId,
          });
      const stock = variant
        ? variant.stock
        : product.variants.length
          ? 0
          : product.stock;
      if (stock < 1)
        return res
          .status(409)
          .json({
            message: `${product.name}${variant ? ` (${variant.name})` : ""} is out of stock.`,
            productId,
            stock,
          });
      const allowedQuantity = Math.min(stock, MAX_CART_QUANTITY);
      if (quantity > allowedQuantity) {
        return res
          .status(409)
          .json({
            message: `You can add up to ${allowedQuantity} ${product.name} item${allowedQuantity === 1 ? "" : "s"}.`,
            productId,
            stock: product.stock,
            maxQuantity: allowedQuantity,
          });
      }
      validatedItems.push({
        productId: product._id,
        variantId: variant?._id?.toString() || "",
        variantName: variant?.name || "",
        name: product.name,
        category: product.category?.name || "",
        image: product.images?.[0] || "",
        price: variant?.price ?? product.price,
        stock,
        quantity,
        lineTotal: product.price * quantity,
      });
    }

    return res.json({
      items: validatedItems,
      total: validatedItems.reduce((sum, item) => sum + item.lineTotal, 0),
      valid: true,
    });
  } catch (error) {
    console.error("Cart validation failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not verify your cart. Please try again." });
  }
}

router.post("/cart/validate", validateCart);
router.post("/cart/checkout/validate", validateCart);

router.get("/:productId", async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.productId,
      published: true,
      blocked: false,
      deletedAt: null,
    }).populate("category", "name");
    if (!product)
      return res
        .status(404)
        .json({ message: "This product is unavailable or has been removed." });
    if (
      !(await Category.exists({
        _id: product.category?._id || product.category,
        deletedAt: null,
      }))
    )
      return res
        .status(404)
        .json({ message: "This product is unavailable or has been removed." });
    const relatedRows =
      product.stock > 0
        ? await Product.find({
            _id: { $ne: product._id },
            category: product.category?._id,
            published: true,
            blocked: false,
            deletedAt: null,
            stock: { $gt: 0 },
          })
            .populate("category", "name")
            .sort({ createdAt: -1 })
            .limit(4)
        : [];
    const reviews = await ProductReview.find({
      productId: product._id,
      status: "approved",
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("customerName rating comment createdAt")
      .lean();
    return res.json({
      product: serializeProduct(product),
      related: relatedRows.map(serializeProduct),
      reviews,
    });
  } catch (error) {
    console.error("Product details failed:", error.message);
    return res.status(500).json({ message: "Could not load this product." });
  }
});

router.post("/:productId/reviews", protect, async (req, res) => {
  try {
    if (req.user.role !== "user")
      return res
        .status(403)
        .json({
          message: "Only customer accounts can submit product reviews.",
        });
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return res
        .status(400)
        .json({ message: "Choose a rating from 1 to 5 stars." });
    if (!comment || comment.length > 1200)
      return res
        .status(400)
        .json({ message: "Write a review up to 1200 characters." });
    const deliveredOrder = await Order.findOne({
      user: req.user._id,
      status: "Delivered",
      "items.productId": String(req.params.productId),
    })
      .select("items")
      .lean();
    const purchasedItem = deliveredOrder?.items.find(
      (item) => String(item.productId) === String(req.params.productId),
    );
    if (!purchasedItem)
      return res
        .status(403)
        .json({
          message:
            "You can review a product only after it has been delivered to you.",
        });
    const review = await ProductReview.create({
      productId: String(req.params.productId),
      productName: purchasedItem.name,
      customerId: req.user._id,
      customerName: req.user.name,
      customerEmail: req.user.email,
      rating,
      comment,
    });
    return res
      .status(201)
      .json({ review, message: "Review submitted for admin approval." });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: "You have already reviewed this product." });
    console.error("Product review submission failed:", error.message);
    return res.status(500).json({ message: "Could not submit your review." });
  }
});

export default router;

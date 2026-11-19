import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  _id: { type: String, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 140, index: true },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  subtitle: { type: String, trim: true, maxlength: 200, default: "" },
  tag: { type: String, trim: true, maxlength: 40, default: "" },
  highlights: { type: [String], default: [] },
  category: { type: String, required: true, ref: "Category", index: true },
  price: { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, required: true, min: 0 },
  images: { type: [String], default: [] },
  variants: [{
    name: { type: String, required: true, trim: true, maxlength: 80 },
    sku: { type: String, trim: true, maxlength: 80, default: "" },
    price: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
  }],
  stock: { type: Number, required: true, min: 0, default: 0, index: true },
  published: { type: Boolean, default: false, index: true },
  blocked: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

productSchema.index({ name: "text", description: "text" });

export default mongoose.model("Product", productSchema);

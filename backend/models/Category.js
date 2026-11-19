import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  _id: { type: String, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  parent: { type: String, ref: "Category", default: null, index: true },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

export default mongoose.model("Category", categorySchema);

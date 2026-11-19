import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { seedCategories, seedProducts } from "./catalog.js";

export default async function seedCatalog() {
  await Category.bulkWrite(seedCategories.map((category) => ({
    updateOne: { filter: { _id: category._id }, update: { $setOnInsert: category }, upsert: true },
  })));
  if (await Product.estimatedDocumentCount() === 0) {
    await Product.insertMany(seedProducts, { ordered: true });
    console.log(`Seeded ${seedProducts.length} demo products and ${seedCategories.length} categories`);
  }
}

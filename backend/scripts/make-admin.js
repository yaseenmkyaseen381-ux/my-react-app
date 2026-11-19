import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- user@example.com");
  process.exit(1);
}

try {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured.");
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOneAndUpdate(
    { email, emailVerified: true, blocked: false },
    { $set: { role: "admin" } },
    { new: true },
  );
  if (!user) throw new Error("No active, verified account exists for that email. Sign up, verify the email, and try again.");
  console.log(`Administrator access enabled for ${user.email}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

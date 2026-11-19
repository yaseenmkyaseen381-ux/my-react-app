import "dotenv/config";
import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import walletRoutes from "./routes/wallet.js";
import User from "./models/User.js";
import seedCatalog from "./data/seedCatalog.js";

const app = express();
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error("MONGO_URI and JWT_SECRET must be configured before the API can start.");
  process.exit(1);
}

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173").split(",").map((value) => value.trim()).filter(Boolean);
const port = Number.parseInt(process.env.PORT || "5000", 10);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "16mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wallet", walletRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use((err, _req, res, _next) => {
  console.error("Request failed:", err.message);
  res.status(500).json({ message: "Server error" });
});

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await seedCatalog();
    // Existing accounts created before email verification was introduced stay valid.
    await User.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
    console.log("MongoDB connected");

    await new Promise((resolve, reject) => {
      const server = app.listen(port, () => resolve(server));
      server.once("error", reject);
    });
    console.log(`API running on port ${port}`);
  } catch (error) {
    if (error.message.includes("ECONNREFUSED")) {
      console.error("MongoDB refused the connection. Start the MongoDB Server service or set MONGO_URI to a reachable database.");
    } else if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Stop the other process or set a different PORT in backend/.env.`);
    } else {
      console.error("Backend startup failed:", error.message);
    }
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  }
}

startServer();

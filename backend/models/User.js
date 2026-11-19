import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, default: "Home" },
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  line1: { type: String, required: true, trim: true },
  line2: { type: String, trim: true, default: "" },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  postalCode: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true, default: "India" },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false },
    googleId: { type: String, unique: true, sparse: true, select: false },
    authProvider: { type: String, enum: ["local", "google", "both"], default: "local" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    blocked: { type: Boolean, default: false, index: true },
    emailVerified: { type: Boolean, default: false },
    profileImage: { type: String, trim: true, default: "" },
    adminProfile: {
      name: { type: String, trim: true, maxlength: 80 },
      email: { type: String, trim: true, lowercase: true, maxlength: 254 },
      profileImage: { type: String, trim: true, default: "" },
    },
    addresses: { type: [addressSchema], default: [] },
    wishlist: { type: [String], default: [] },
    emailOtpHash: { type: String, select: false },
    emailOtpExpiresAt: { type: Date, select: false },
    emailOtpAttempts: { type: Number, default: 0, select: false },
    pendingEmail: { type: String, lowercase: true, trim: true, select: false },
    pendingEmailOtpHash: { type: String, select: false },
    pendingEmailOtpExpiresAt: { type: Date, select: false },
    pendingEmailOtpAttempts: { type: Number, default: 0, select: false },
    resetOtpHash: { type: String, select: false },
    resetOtpExpiresAt: { type: Date, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
    otpLastSentAt: { type: Date, select: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);

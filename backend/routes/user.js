import { Router } from "express";
import bcrypt from "bcryptjs";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import { deliverOtp, isMatchingOtp, otpHash, OTP_TTL_MS } from "./auth.js";
import { otpLimiter } from "../middleware/rateLimit.js";

const router = Router();
router.use(protect);

router.get("/me", (req, res) => res.json(req.user));

router.put("/me", async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const profileImage = typeof req.body.profileImage === "string" ? req.body.profileImage.trim() : undefined;
    if (!name || name.length > 80) return res.status(400).json({ message: "Name must be between 1 and 80 characters." });
    if (profileImage !== undefined && profileImage && !/^https:\/\//i.test(profileImage) && !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/i.test(profileImage))
      return res.status(400).json({ message: "Profile image must be an HTTPS URL or an uploaded image." });
    if (profileImage && profileImage.length > 1_500_000)
      return res.status(413).json({ message: "Profile image is too large. Choose a smaller photo." });
    const updates = { name };
    if (profileImage !== undefined) updates.profileImage = profileImage;
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true }).select("-password");
    return res.json(user);
  } catch (error) {
    console.error("Profile update failed:", error.message);
    return res.status(500).json({ message: "Could not update your profile." });
  }
});

router.patch("/me/password", async (req, res) => {
  try {
    const currentPassword = req.body.currentPassword || "";
    const newPassword = req.body.newPassword || "";
    if (newPassword.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters." });
    const user = await User.findById(req.user._id).select("+googleId");
    if (!user.password) return res.status(400).json({ message: "This account uses Google sign-in. Use password reset if you want to add a password." });
    if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ message: "Current password is incorrect." });
    user.password = await bcrypt.hash(newPassword, 12);
    user.authProvider = user.googleId ? "both" : "local";
    await user.save();
    return res.json({ message: "Password updated." });
  } catch (error) {
    console.error("Password change failed:", error.message);
    return res.status(500).json({ message: "Could not update your password." });
  }
});

router.post("/me/email-change", otpLimiter, async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
    if (email === req.user.email) return res.status(400).json({ message: "That is already your email address." });
    if (await User.exists({ email })) return res.status(409).json({ message: "That email address is already in use." });
    const user = await User.findById(req.user._id).select("+pendingEmail +pendingEmailOtpHash +pendingEmailOtpExpiresAt +pendingEmailOtpAttempts +otpLastSentAt");
    const waitSeconds = user.otpLastSentAt ? Math.max(0, Math.ceil((60_000 - (Date.now() - user.otpLastSentAt.getTime())) / 1000)) : 0;
    if (waitSeconds > 0) return res.status(429).json({ message: `Please wait ${waitSeconds} seconds before requesting another code.` });
    const delivery = await deliverOtp(email, "email verification");
    if (delivery.error) return res.status(503).json({ message: delivery.error });
    user.pendingEmail = email;
    user.pendingEmailOtpHash = otpHash(delivery.code);
    user.pendingEmailOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.pendingEmailOtpAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();
    return res.json({ message: "A verification code was sent to your new email address.", expiresInSeconds: OTP_TTL_MS / 1000 });
  } catch (error) {
    console.error("Email change request failed:", error.message);
    return res.status(500).json({ message: "Could not start email verification." });
  }
});

router.post("/me/email-change/verify", otpLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+pendingEmail +pendingEmailOtpHash +pendingEmailOtpExpiresAt +pendingEmailOtpAttempts");
    if (!user.pendingEmail || !user.pendingEmailOtpExpiresAt || user.pendingEmailOtpExpiresAt < new Date())
      return res.status(400).json({ message: "The email verification code expired. Start the change again." });
    if (user.pendingEmailOtpAttempts >= 5) return res.status(429).json({ message: "Too many incorrect codes. Start the change again." });
    if (!isMatchingOtp(req.body.otp, user.pendingEmailOtpHash)) {
      user.pendingEmailOtpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "That code is incorrect." });
    }
    if (await User.exists({ email: user.pendingEmail, _id: { $ne: user._id } }))
      return res.status(409).json({ message: "That email address is already in use." });
    user.email = user.pendingEmail;
    user.emailVerified = true;
    user.pendingEmail = undefined;
    user.pendingEmailOtpHash = undefined;
    user.pendingEmailOtpExpiresAt = undefined;
    user.pendingEmailOtpAttempts = 0;
    await user.save();
    return res.json({ message: "Email address verified.", user: { id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified } });
  } catch (error) {
    console.error("Email change verification failed:", error.message);
    return res.status(500).json({ message: "Could not verify the new email address." });
  }
});

router.get("/me/addresses", (req, res) => res.json(req.user.addresses || []));

const addressFields = ["label", "fullName", "phone", "line1", "line2", "city", "state", "postalCode", "country"];
function readAddress(body) {
  const address = Object.fromEntries(addressFields.map((field) => [field, typeof body[field] === "string" ? body[field].trim() : ""]));
  const missing = ["fullName", "phone", "line1", "city", "state", "postalCode"].filter((field) => !address[field]);
  if (missing.length) return { error: `Required address details missing: ${missing.join(", ")}.` };
  if (address.phone.length > 30 || address.postalCode.length > 20) return { error: "Phone or postal code is too long." };
  address.label = (address.label || "Home").slice(0, 40);
  address.country = (address.country || "India").slice(0, 60);
  return { address };
}

router.post("/me/addresses", async (req, res) => {
  try {
    const parsed = readAddress(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const user = await User.findById(req.user._id);
    const makeDefault = Boolean(req.body.isDefault) || user.addresses.length === 0;
    if (makeDefault) user.addresses.forEach((address) => { address.isDefault = false; });
    user.addresses.push({ ...parsed.address, isDefault: makeDefault });
    await user.save();
    return res.status(201).json(user.addresses);
  } catch (error) {
    console.error("Address create failed:", error.message);
    return res.status(500).json({ message: "Could not save the address." });
  }
});

router.put("/me/addresses/:addressId", async (req, res) => {
  try {
    const parsed = readAddress(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ message: "Address not found." });
    Object.assign(address, parsed.address);
    if (req.body.isDefault) user.addresses.forEach((entry) => { entry.isDefault = entry._id.equals(address._id); });
    await user.save();
    return res.json(user.addresses);
  } catch (error) {
    console.error("Address update failed:", error.message);
    return res.status(500).json({ message: "Could not update the address." });
  }
});

router.patch("/me/addresses/:addressId/default", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ message: "Address not found." });
    user.addresses.forEach((entry) => { entry.isDefault = entry._id.equals(address._id); });
    await user.save();
    return res.json(user.addresses);
  } catch (error) {
    console.error("Default address update failed:", error.message);
    return res.status(500).json({ message: "Could not set the default address." });
  }
});

router.delete("/me/addresses/:addressId", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ message: "Address not found." });
    const wasDefault = address.isDefault;
    address.deleteOne();
    if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
    await user.save();
    return res.json(user.addresses);
  } catch (error) {
    console.error("Address delete failed:", error.message);
    return res.status(500).json({ message: "Could not delete the address." });
  }
});

export default router;

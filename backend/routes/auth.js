import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendOtpEmail } from "../utils/email.js";
import {
  loginLimiter,
  otpLimiter,
  registrationLimiter,
} from "../middleware/rateLimit.js";

const router = Router();
const OTP_TTL_MS = 10 * 60 * 1000;
const EMAIL_OTP_TTL_MS = 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
let googleJwks = { keys: [], expiresAt: 0 };

const makeToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  authProvider: user.authProvider,
  blocked: user.blocked,
  emailVerified: user.emailVerified,
  profileImage: user.profileImage || "",
  addresses: user.addresses || [],
});
const otpHash = (otp) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET).update(otp).digest("hex");
const isMatchingOtp = (otp, storedHash) => {
  if (!storedHash || !/^\d{6}$/.test(otp || "")) return false;
  const provided = Buffer.from(otpHash(otp), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return (
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected)
  );
};
const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const newOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
const otpCooldownSeconds = (user) =>
  user.otpLastSentAt
    ? Math.max(
        0,
        Math.ceil(
          (OTP_RESEND_MS - (Date.now() - user.otpLastSentAt.getTime())) / 1000,
        ),
      )
    : 0;

async function deliverOtp(email, purpose) {
  if (
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.EMAIL_FROM
  )
    return {
      error:
        "Email delivery is not configured. Add SMTP_USER, SMTP_PASS, and EMAIL_FROM to backend/.env.",
    };
  const code = newOtp();
  const sent = await sendOtpEmail(email, code, purpose);
  if (!sent)
    return {
      error:
        "We could not send the email right now. Check the email service settings and try again.",
    };
  return { code };
}

async function getGoogleSigningKey(kid) {
  if (googleJwks.expiresAt <= Date.now()) {
    let response;
    try {
      response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
    } catch {
      throw new Error("Google signing keys are temporarily unavailable.");
    }
    if (!response.ok)
      throw new Error("Google signing keys are temporarily unavailable.");
    const data = await response.json();
    const cacheHeader = response.headers.get("cache-control") || "";
    const maxAge = Number(cacheHeader.match(/max-age=(\d+)/)?.[1] || 3600);
    googleJwks = {
      keys: data.keys || [],
      expiresAt: Date.now() + maxAge * 1000,
    };
  }
  const jwk = googleJwks.keys.find(
    (key) => key.kid === kid && key.alg === "RS256",
  );
  if (!jwk) throw new Error("Google signing key was not found.");
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

async function verifyGoogleCredential(credential, expectedNonce) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId)
    throw new Error("Google sign-in is not configured on the server.");
  const parts = (credential || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid Google credential.");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(
    Buffer.from(encodedHeader, "base64url").toString("utf8"),
  );
  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  );
  if (header.alg !== "RS256" || !header.kid)
    throw new Error("Unsupported Google credential signature.");
  const signingKey = await getGoogleSigningKey(header.kid);
  const validSignature = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    signingKey,
    Buffer.from(encodedSignature, "base64url"),
  );
  const audienceMatches = Array.isArray(payload.aud)
    ? payload.aud.includes(clientId)
    : payload.aud === clientId;
  const now = Math.floor(Date.now() / 1000);
  if (
    !validSignature ||
    !audienceMatches ||
    !["accounts.google.com", "https://accounts.google.com"].includes(
      payload.iss,
    ) ||
    !payload.sub ||
    !payload.email ||
    !(payload.email_verified === true || payload.email_verified === "true") ||
    !payload.exp ||
    !payload.iat ||
    payload.exp < now ||
    payload.iat > now + 60 ||
    payload.nonce !== expectedNonce
  ) {
    throw new Error("Google could not verify this sign-in. Please try again.");
  }
  return payload;
}

router.post("/signup", registrationLimiter, async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    if (!name || name.length > 80 || !validEmail(email) || password.length < 8)
      return res
        .status(400)
        .json({
          message:
            "Enter your name, a valid email, and a password with at least 8 characters.",
        });

    let user = await User.findOne({ email }).select(
      "+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts +otpLastSentAt",
    );
    if (user?.emailVerified)
      return res
        .status(409)
        .json({ message: "Email already registered. Please log in." });
    if (user && otpCooldownSeconds(user) > 0)
      return res
        .status(429)
        .json({
          message: `Please wait ${otpCooldownSeconds(user)} seconds before requesting another code.`,
        });
    if (!user) user = new User({ name, email });
    user.name = name;
    user.password = await bcrypt.hash(password, 12);
    user.emailOtpAttempts = 0;
    const delivery = await deliverOtp(email, "email verification");
    if (delivery.error)
      return res.status(503).json({ message: delivery.error });
    user.emailOtpHash = otpHash(delivery.code);
    user.emailOtpExpiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);
    user.otpLastSentAt = new Date();
    await user.save();
    return res.status(202).json({
      message: "A verification code has been sent to your email.",
      email,
      expiresInSeconds: EMAIL_OTP_TTL_MS / 1000,
    });
  } catch (error) {
    console.error("Signup failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not create your account. Please try again." });
  }
});

router.post("/verify-email", otpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const user = await User.findOne({ email, emailVerified: false }).select(
      "+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts +otpLastSentAt",
    );
    if (!user)
      return res
        .status(400)
        .json({
          message:
            "This verification request is no longer valid. Please sign up again.",
        });
    if (!user.emailOtpExpiresAt || user.emailOtpExpiresAt < new Date())
      return res
        .status(400)
        .json({ message: "That code has expired. Request a new one." });
    if (user.emailOtpAttempts >= 5)
      return res
        .status(429)
        .json({ message: "Too many incorrect codes. Request a new code." });
    if (!isMatchingOtp(req.body.otp, user.emailOtpHash)) {
      user.emailOtpAttempts += 1;
      await user.save();
      return res
        .status(400)
        .json({ message: "That code is incorrect. Please try again." });
    }
    user.emailVerified = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpiresAt = undefined;
    user.emailOtpAttempts = 0;
    await user.save();
    return res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (error) {
    console.error("Email verification failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not verify your email. Please try again." });
  }
});

router.post("/resend-otp", otpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const user = await User.findOne({ email, emailVerified: false }).select(
      "+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts +otpLastSentAt",
    );
    const generic = "If the account can be verified, a new code has been sent.";
    if (!user) return res.json({ message: generic });
    const waitSeconds = otpCooldownSeconds(user);
    if (waitSeconds > 0) return res.json({ message: generic });
    const delivery = await deliverOtp(email, "email verification");
    if (delivery.error)
      return res.status(503).json({ message: delivery.error });
    user.emailOtpHash = otpHash(delivery.code);
    user.emailOtpExpiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);
    user.otpLastSentAt = new Date();
    user.emailOtpAttempts = 0;
    await user.save();
    return res.json({
      message: "A new verification code has been sent to your email.",
      expiresInSeconds: EMAIL_OTP_TTL_MS / 1000,
    });
  } catch (error) {
    console.error("OTP resend failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not send a new code. Please try again." });
  }
});

async function signIn(req, res, adminOnly) {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password || "";
  if (!validEmail(email) || !password)
    return res
      .status(400)
      .json({ message: "Enter a valid email and password." });
  const user = await User.findOne({ email });
  if (!user)
    return res
      .status(404)
      .json({
        code: "ACCOUNT_NOT_FOUND",
        message:
          "No account exists with that email. Create an account to continue.",
      });
  if (!user.password || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: "Invalid email or password." });
  if (!user.emailVerified)
    return res
      .status(403)
      .json({ message: "Verify your email before signing in." });
  if (user.blocked)
    return res
      .status(403)
      .json({ message: "This account is blocked. Contact an administrator." });
  if (adminOnly && user.role !== "admin")
    return res.status(403).json({ message: "Administrator access only." });
  return res.json({ token: makeToken(user), user: publicUser(user) });
}

router.post("/login", loginLimiter, async (req, res) => {
  try {
    return await signIn(req, res, false);
  } catch (error) {
    console.error("Login failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not sign in. Please try again." });
  }
});

router.post("/google", loginLimiter, async (req, res) => {
  try {
    const payload = await verifyGoogleCredential(
      req.body.credential,
      req.body.nonce,
    );
    const email = normalizeEmail(payload.email);
    let user = await User.findOne({
      $or: [{ googleId: payload.sub }, { email }],
    }).select("+googleId");
    if (!user && req.body.mode !== "signup")
      return res
        .status(404)
        .json({
          code: "ACCOUNT_NOT_FOUND",
          email,
          message:
            "No account exists with that Google email. Create an account to continue.",
        });
    if (user?.blocked)
      return res
        .status(403)
        .json({
          message: "This account is blocked. Contact an administrator.",
        });
    if (user?.googleId && user.googleId !== payload.sub)
      return res
        .status(409)
        .json({
          message: "This email is linked to a different Google account.",
        });
    if (!user)
      user = new User({ email, name: payload.name || email.split("@")[0] });

    user.googleId = payload.sub;
    user.email = email;
    user.emailVerified = true;
    if (!user.name) user.name = payload.name || email.split("@")[0];
    if (!user.profileImage && /^https:\/\//i.test(payload.picture || ""))
      user.profileImage = payload.picture;
    user.authProvider = user.password ? "both" : "google";
    await user.save();
    return res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({
          message:
            "This Google account is already linked. Please sign in again.",
        });
    const notConfigured =
      error.message.includes("not configured") ||
      error.message.includes("temporarily unavailable");
    if (!notConfigured) console.warn("Google sign-in rejected:", error.message);
    return res.status(notConfigured ? 503 : 401).json({
      message: notConfigured
        ? "Google sign-in is temporarily unavailable. Check the OAuth configuration."
        : "Google sign-in could not be verified. Please try again.",
    });
  }
});

router.post("/admin-login", loginLimiter, async (req, res) => {
  try {
    return await signIn(req, res, true);
  } catch (error) {
    console.error("Admin login failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not sign in. Please try again." });
  }
});

router.post("/forgot-password", otpLimiter, async (req, res) => {
  const generic =
    "If a verified account uses that email, a reset code has been sent.";
  try {
    const email = normalizeEmail(req.body.email);
    if (!validEmail(email))
      return res.status(400).json({ message: "Enter a valid email address." });
    const user = await User.findOne({ email, emailVerified: true }).select(
      "+resetOtpHash +resetOtpExpiresAt +resetOtpAttempts +otpLastSentAt",
    );
    if (!user) return res.json({ message: generic });
    const waitSeconds = otpCooldownSeconds(user);
    if (waitSeconds > 0) return res.json({ message: generic });
    const delivery = await deliverOtp(email, "password reset");
    if (delivery.error)
      return res.status(503).json({ message: delivery.error });
    user.resetOtpHash = otpHash(delivery.code);
    user.resetOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.otpLastSentAt = new Date();
    user.resetOtpAttempts = 0;
    await user.save();
    return res.json({
      message:
        "If a verified account uses that email, a reset code has been sent.",
      expiresInSeconds: OTP_TTL_MS / 1000,
    });
  } catch (error) {
    console.error("Password reset request failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not process your request. Please try again." });
  }
});

router.post("/reset-password", otpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    if (password.length < 8)
      return res
        .status(400)
        .json({ message: "Choose a password with at least 8 characters." });
    const user = await User.findOne({ email, emailVerified: true }).select(
      "+resetOtpHash +resetOtpExpiresAt +resetOtpAttempts +googleId",
    );
    if (!user || !user.resetOtpExpiresAt || user.resetOtpExpiresAt < new Date())
      return res
        .status(400)
        .json({
          message: "That reset code is invalid or expired. Request a new one.",
        });
    if (user.resetOtpAttempts >= 5)
      return res
        .status(429)
        .json({ message: "Too many incorrect codes. Request a new one." });
    if (!isMatchingOtp(req.body.otp, user.resetOtpHash)) {
      user.resetOtpAttempts += 1;
      await user.save();
      return res
        .status(400)
        .json({ message: "That reset code is incorrect. Please try again." });
    }
    user.password = await bcrypt.hash(password, 12);
    user.authProvider = user.googleId ? "both" : "local";
    user.resetOtpHash = undefined;
    user.resetOtpExpiresAt = undefined;
    user.resetOtpAttempts = 0;
    await user.save();
    return res.json({
      message: "Your password has been reset. You can now sign in.",
    });
  } catch (error) {
    console.error("Password reset failed:", error.message);
    return res
      .status(500)
      .json({ message: "Could not reset your password. Please try again." });
  }
});

export {
  makeToken,
  publicUser,
  otpHash,
  isMatchingOtp,
  deliverOtp,
  OTP_TTL_MS,
  EMAIL_OTP_TTL_MS,
};
export default router;

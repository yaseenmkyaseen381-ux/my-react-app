import { rateLimit } from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

function makeRateLimiter(limit, message) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ message }),
  });
}

export const loginLimiter = makeRateLimiter(
  10,
  "Too many sign-in attempts. Please wait 15 minutes and try again.",
);

export const registrationLimiter = makeRateLimiter(
  5,
  "Too many registration attempts. Please wait 15 minutes and try again.",
);

export const otpLimiter = makeRateLimiter(
  6,
  "Too many verification-code requests or attempts. Please wait 15 minutes and try again.",
);

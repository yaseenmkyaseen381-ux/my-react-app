import nodemailer from "nodemailer";

export async function sendOtpEmail(email, code, purpose) {
  const user = process.env.SMTP_USER;
  // Google displays app passwords in four groups; whitespace in the copied
  // value must be removed before it is sent to Gmail SMTP.
  const password = process.env.SMTP_PASS?.replace(/\s+/g, "");
  const from = process.env.EMAIL_FROM;
  if (!user || !password || !from) {
    console.error(
      "Email delivery is not configured: SMTP_USER, SMTP_PASS, and EMAIL_FROM are required.",
    );
    return false;
  }

  const reset = purpose === "password reset";
  const subject = reset
    ? "Your MOBIX password reset code"
    : "Verify your MOBIX email";
  const heading = reset ? "Reset your password" : "Verify your email address";
  const expiryDuration = reset ? "10 minutes" : "1 minute";
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject,
      html: `<div style="font-family:Arial,sans-serif;color:#172744"><h1>${heading}</h1><p>Your one-time MOBIX code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in ${expiryDuration}. If you did not request it, you can ignore this email.</p></div>`,
    });
    return true;
  } catch (error) {
    console.error("Email delivery failed:", error.message);
    return false;
  }
}

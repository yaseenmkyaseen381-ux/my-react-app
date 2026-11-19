import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword, resetPassword } from "../api";
import OtpInput from "../components/OtpInput";
import "./auth.css";
import "./ForgotPassword.css";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState("request");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendLeft, setResendLeft] = useState(0);

  useEffect(() => {
    if (step !== "reset") return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
      setResendLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const requestCode = async (event) => {
    event?.preventDefault(); setError(""); setMessage(""); setLoading(true);
    try {
      const data = await forgotPassword({ email });
      setOtp("");
      setMessage(data.message);
      setSecondsLeft(data.expiresInSeconds || 0);
      setResendLeft(60);
      setStep("reset");
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };

  const submitReset = async (event) => {
    event.preventDefault(); setError(""); setMessage("");
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const data = await resetPassword({ email, otp, password });
      setMessage(data.message);
      window.setTimeout(() => navigate("/user", { replace: true }), 1200);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };

  return <div className="auth-page forgot-page">
    <header className="auth-header">
      <button className="back" type="button" onClick={() => navigate(-1)} aria-label="Go back">←</button>
      <Link className="logo auth-brand" to="/"><span className="auth-brand-icon">M</span><span>MOBIX</span></Link>
    </header>
    <main className="auth-wrap forgot-wrap">
      <form className={`auth-card forgot-card ${step === "reset" ? "forgot-reset-card" : ""}`} onSubmit={step === "request" ? requestCode : submitReset}>
        <div className="lock-badge forgot-badge" aria-hidden="true">↻</div>
        <h1 className="auth-title">{step === "request" ? "Forgot Password?" : "Create New Password"}</h1>
        <p className="auth-sub">{step === "request" ? "Don't worry! Enter your email address and we'll help you reset your password." : <>Enter the code sent to <b>{email}</b>.</>}</p>

        {error && <div className="error" role="alert">{error}</div>}
        {step === "request" ? <>
          <div className="field">
            <div className="forgot-label-row"><label htmlFor="reset-email">Email Address</label><span>Registered account</span></div>
            <div className="input-box"><input id="reset-email" type="email" autoComplete="email" placeholder="Enter your registered email address" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          </div>
          <button className="btn-primary forgot-primary" disabled={loading}>{loading ? "Sending…" : <>Reset Password <span aria-hidden="true">→</span></>}</button>
          <Link to="/user" className="forgot-back">← Back to Login</Link>
        </> : <>
          {message && <div className="success" role="status">{message}</div>}
          {secondsLeft > 0 && <p className="otp-timer">Code expires in <b>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</b></p>}
          {secondsLeft === 0 && <div className="hint">If you did not receive a code, request a new one below.</div>}
          <div className="field"><label>One-time code</label><OtpInput id="reset-otp" value={otp} onChange={setOtp} label="Password reset code" /></div>
          <div className="field"><label htmlFor="new-password">New password</label><div className="input-box"><input id="new-password" type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required value={password} onChange={(event) => setPassword(event.target.value)} /></div></div>
          <div className="field"><label htmlFor="confirm-password">Confirm new password</label><div className="input-box"><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} placeholder="Re-enter your password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div></div>
          <button className="btn-primary forgot-primary" disabled={loading || secondsLeft === 0}>{loading ? "Updating…" : "Reset Password"}</button>
          <button className="text-button" type="button" disabled={loading || resendLeft > 0} onClick={() => requestCode()}>{resendLeft > 0 ? `Resend code in ${Math.floor(resendLeft / 60)}:${String(resendLeft % 60).padStart(2, "0")}` : "Send a new code"}</button>
          <button className="text-button" type="button" disabled={loading} onClick={() => { setStep("request"); setMessage(""); setError(""); }}>Use another email</button>
        </>}
      </form>
      <p className="forgot-secure"><span aria-hidden="true">✓</span> Encrypted 256-bit secure recovery channel</p>
      {step === "reset" && <p className="switch">Remember your password? <Link to="/user">Log in</Link></p>}
    </main>
  </div>;
}

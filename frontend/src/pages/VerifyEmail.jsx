import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resendOtp, verifyEmail } from "../api";
import { saveSession } from "../authSession";
import OtpInput from "../components/OtpInput";
import "./auth.css";

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || sessionStorage.getItem("pendingSignupEmail") || "";
  const [otp, setOtp] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [resendLeft, setResendLeft] = useState(60);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
      setResendLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleVerify = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const { token, user } = await verifyEmail({ email, otp });
      saveSession("user", token, user);
      sessionStorage.removeItem("pendingSignupEmail");
      navigate("/home", { replace: true });
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const handleResend = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await resendOtp({ email });
      setOtp("");
      setSecondsLeft(result.expiresInSeconds || 600);
      setResendLeft(60);
      setMessage(result.message);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  if (!email) return <div className="auth-page signup"><header className="auth-header"><Link className="logo" to="/">MOBIX</Link></header><div className="auth-wrap"><div className="auth-card"><h1 className="auth-title">Verification link missing</h1><p className="auth-sub">Start by creating your account.</p><Link className="btn-primary auth-action-link" to="/signup">Create account</Link></div></div></div>;

  return <div className="auth-page signup verify-page">
    <header className="auth-header"><Link className="logo" to="/">MOBIX</Link></header>
    <main className="auth-wrap">
      <div className="lock-badge">✉</div><h1 className="auth-title">Verify your email</h1>
      <p className="auth-sub">Enter the 6-digit code sent to <b>{email}</b>.</p>
      <form className="auth-card" onSubmit={handleVerify}>
        {error && <div className="error" role="alert">{error}</div>}{message && <div className="success" role="status">{message}</div>}
        <div className="field"><label>Verification code</label><OtpInput id="verify-otp" value={otp} onChange={setOtp} label="Email verification code" /></div>
        <p className="otp-timer">Code expires in <b>{formatTime(secondsLeft)}</b></p>
        <button className="btn-primary" disabled={busy || secondsLeft === 0}>{busy ? "Verifying…" : "Verify email"}</button>
        <button className="text-button" type="button" disabled={busy || resendLeft > 0} onClick={handleResend}>{resendLeft > 0 ? `Resend code in ${formatTime(resendLeft)}` : "Resend code"}</button>
      </form>
      <p className="switch"><Link to="/signup">Back to sign up</Link></p>
    </main>
  </div>;
}

import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { login } from "../api";
import { getSessionToken, getSessionUser, saveSession } from "../authSession";
import "./auth.css";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const savedUser = getSessionUser("user");
  const savedToken = getSessionToken("user");
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountUnblocked, setAccountUnblocked] = useState(false);
  useEffect(() => {
    const loginUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const keepLoginPage = () => {
      window.history.pushState({ mobixLoginPage: true }, "", loginUrl);
    };
    const onPopState = (event) => {
      event.stopImmediatePropagation();
      keepLoginPage();
    };
    keepLoginPage();
    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("blocked")) return;
    url.searchParams.delete("blocked");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);
  useEffect(() => {
    const checkUnblocked = () => {
      const email = localStorage.getItem("mobix.blocked-email") || "";
      if (!email) return setAccountUnblocked(false);
      const emailKey = encodeURIComponent(email.trim().toLowerCase());
      const blockedAt = Number(
        localStorage.getItem(`mobix.user-blocked-at:${emailKey}`) || 0,
      );
      const unblockedAt = Number(
        localStorage.getItem(`mobix.user-unblocked:${emailKey}`) || 0,
      );
      setAccountUnblocked(unblockedAt > 0 && unblockedAt >= blockedAt);
    };
    checkUnblocked();
    window.addEventListener("storage", checkUnblocked);
    return () => window.removeEventListener("storage", checkUnblocked);
  }, []);
  const sessionNotice = accountUnblocked
    ? "Your account has been unblocked. You can sign in now."
    : "";

  // Returning customers who already have a valid local session should land on Home.
  if (savedToken && savedUser?.role === "user")
    return <Navigate to="/home" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setVerificationRequired(false);
    setLoading(true);
    try {
      const { token, user } = await login(form);
      if (user?.role === "admin") {
        setError("Administrator accounts must sign in through /admin.");
        return;
      }
      saveSession("user", token, user);
      navigate("/home", { replace: true });
    } catch (err) {
      if (err.code === "ACCOUNT_NOT_FOUND") {
        navigate("/signup", {
          state: {
            email: form.email.trim(),
            message:
              "No account was found for that email. Create your account to continue.",
          },
        });
        return;
      }
      setError(err.message);
      setVerificationRequired(
        err.status === 403 &&
          err.message === "Verify your email before signing in.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page login">
      <main className="login-layout">
        <aside className="login-visual" aria-label="MOBIX electronics">
          <img src="/hero-devices.jpg" alt="Smartphones, laptop, smartwatch, and earbuds" />
          <div className="login-visual-copy">
            <span>WELCOME TO MOBIX</span>
            <h2>Technology for every day.</h2>
            <p>Discover the devices that keep you connected.</p>
          </div>
        </aside>

        <section className="login-content" aria-label="Sign in">
          <div className="login-brandbar">
            <Link className="logo auth-brand" to="/">
              <span className="auth-brand-icon" aria-hidden="true" />
              <span>MOBIX</span>
            </Link>
          </div>
          <div className="auth-wrap">
    
            <h1 className="auth-title">Welcome Back!</h1>
            <p className="auth-sub">Login to your account</p>

            <form className="auth-card" onSubmit={handleSubmit}>
          {sessionNotice && (
            <div
              className={accountUnblocked ? "success" : "error"}
              role="status"
            >
              {sessionNotice}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {verificationRequired && (
            <div className="verify-hint">
              <p>
                Check your inbox or spam folder for the 6-digit verification
                code.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate("/verify-email", {
                    state: { email: form.email.trim() },
                  })
                }
              >
                Enter verification code
              </button>
            </div>
          )}

          <div className="field">
            <label>Email Address</label>
            <div className="input-box">
              <input
                type="email"
                autoComplete="off"
                placeholder="Enter your email address"
                required
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setVerificationRequired(false);
                }}
              />
            </div>
          </div>

          <div className="field">
            <label>Password</label>
            <div className="input-box">
              <input
                type={showPw ? "text" : "password"}
                placeholder="Enter your password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                className="eye"
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-pressed={showPw}
                title={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw(!showPw)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {showPw ? (
                    <>
                      <path d="m3 3 18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.3 4.2 9 7-.2.8-.7 1.7-1.4 2.5" />
                      <path d="M6.2 6.2C3.9 7.6 2.4 9.8 2 12c.7 2.8 4 7 10 7 1 0 2-.2 2.9-.5" />
                    </>
                  ) : (
                    <>
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <Link to="/forgot-password" className="forgot">
            Forgot Password?
          </Link>
          <button className="btn-primary" disabled={loading}>
            {loading ? "Logging in..." : "Login →"}
          </button>
            </form>

            <p className="switch">
              First time here? <Link to="/signup">Create an account</Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

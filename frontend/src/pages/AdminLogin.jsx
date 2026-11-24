import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminLogin } from "../api";
import { saveSession } from "../authSession";
import "./auth.css";
import "./Admin.css";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchToCustomer = () => {
    navigate("/user", { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await adminLogin({ email, password });
      saveSession("admin", token, user);
      navigate("/admin/users", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page admin-auth-page">
      <header className="auth-header">
        <Link className="logo" to="/">
          <span className="auth-brand-icon" aria-hidden="true" />
          MOBIX
        </Link>
        <span className="admin-header-label">ADMIN PORTAL</span>
      </header>
      <main className="auth-wrap">
        <div className="lock-badge admin-badge">A</div>
        <h1 className="auth-title">Administrator sign in</h1>
        <p className="auth-sub">
          Use the same email and password as your verified account. Admin access
          must be enabled for that account.
        </p>
        <form className="auth-card" onSubmit={submit}>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="admin-email">Email address</label>
            <div className="input-box">
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                placeholder="Enter your administrator email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <div className="input-box">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your account password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="eye"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                ◉
              </button>
            </div>
          </div>
          <Link to="/forgot-password" className="forgot">
            Forgot password?
          </Link>
          <button className="btn-primary admin-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in to admin"}
          </button>
        </form>
        <p className="switch">
          Customer account?{" "}
          <Link to="/user" onClick={switchToCustomer}>
            Sign in as a customer
          </Link>
        </p>
      </main>
    </div>
  );
}

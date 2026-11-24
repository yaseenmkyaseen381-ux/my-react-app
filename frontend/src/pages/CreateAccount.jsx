import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signup } from "../api";
import "./auth.css";
import "./CreateAccount.css";

export default function CreateAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    name: "",
    email: location.state?.email || "",
    password: "",
    confirm: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice] = useState(location.state?.message || "");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm)
      return setError("Passwords do not match");
    setError("");
    setLoading(true);
    try {
      const result = await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      sessionStorage.setItem("pendingSignupEmail", result.email);
      navigate("/verify-email", { state: { email: result.email } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page signup create-account-page">
      <header className="auth-header">
        <button
          className="back"
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          ←
        </button>
        <Link className="logo auth-brand" to="/">
          <span className="auth-brand-icon">M</span>
          <span>MOBIX</span>
        </Link>
      </header>

      <div className="auth-wrap">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-sub">please enter your details</p>
          {notice && (
            <div className="success" role="status">
              {notice}
            </div>
          )}
          {error && <div className="error">{error}</div>}

          <div className="field">
            <label>Name</label>
            <div className="input-box">
              <input
                placeholder="Enter your name"
                required
                value={form.name}
                onChange={set("name")}
              />
            </div>
          </div>

          <div className="field">
            <label>Email</label>
            <div className="input-box">
              <input
                type="email"
                autoComplete="off"
                placeholder="Enter your email address"
                required
                value={form.email}
                onChange={set("email")}
              />
            </div>
          </div>

          <div className="field">
            <label>Password</label>
            <div className="input-box">
              <input
                type={showPw ? "text" : "password"}
                placeholder="At least 8 characters"
                required
                minLength={8}
                value={form.password}
                onChange={set("password")}
              />
              <button
                type="button"
                className="eye"
                onClick={() => setShowPw(!showPw)}
              >
                👁
              </button>
            </div>
          </div>

          <div className="field">
            <label>Confirm Password</label>
            <div className="input-box">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your password"
                required
                minLength={8}
                value={form.confirm}
                onChange={set("confirm")}
              />
              <button
                type="button"
                className="eye"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                👁
              </button>
            </div>
          </div>

          <button className="btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Sign Up"}
          </button>

          <p className="switch">
            Already have an account? <Link to="/user">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

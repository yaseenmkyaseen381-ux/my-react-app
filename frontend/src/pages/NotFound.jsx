import { Link } from "react-router-dom";
import "./auth.css";

export default function NotFound() {
  return (
    <main className="auth-page signup">
      <header className="auth-header">
        <Link className="logo" to="/">
          <span className="auth-brand-icon" aria-hidden="true" />
          MOBIX
        </Link>
      </header>
      <section className="auth-wrap" style={{ textAlign: "center" }}>
        <div className="lock-badge" aria-hidden="true">
          404
        </div>
        <h1 className="auth-title">Page not found</h1>
        <p className="auth-sub">The page you’re looking for doesn’t exist.</p>
        <Link
          className="btn-primary"
          style={{
            display: "grid",
            placeItems: "center",
            textDecoration: "none",
          }}
          to="/"
        >
          Back to home
        </Link>
      </section>
    </main>
  );
}

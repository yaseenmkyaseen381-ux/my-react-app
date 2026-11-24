import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  deleteAdminReview,
  getAdminReviews,
  updateAdminReviewStatus,
} from "../api";
import { clearSession } from "../authSession";
import AdminNavigation from "../components/AdminNavigation";
import AdminProfileBadge from "../components/AdminProfileBadge";
import "./Admin.css";

export default function AdminReviews() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminReviews({
        page,
        limit: 10,
        status,
        search: appliedSearch,
      });
      setReviews(result.reviews || []);
      setPages(Math.max(1, result.totalPages || 1));
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) {
        clearSession("admin");
        navigate("/admin", { replace: true });
      } else setError(requestError.message || "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, [page, status, appliedSearch, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (review, nextStatus) => {
    setBusyId(String(review._id));
    setError("");
    setNotice("");
    try {
      const result = await updateAdminReviewStatus(review._id, nextStatus);
      setNotice(result.message);
      await load();
    } catch (requestError) {
      setError(requestError.message || "Could not update the review.");
    } finally {
      setBusyId("");
    }
  };

  const remove = async (review) => {
    if (!window.confirm(`Delete the review for ${review.productName}?`)) return;
    setBusyId(String(review._id));
    setError("");
    setNotice("");
    try {
      const result = await deleteAdminReview(review._id);
      setNotice(result.message);
      await load();
    } catch (requestError) {
      setError(requestError.message || "Could not delete the review.");
    } finally {
      setBusyId("");
    }
  };

  const logout = () => {
    clearSession("admin");
    localStorage.removeItem("adminProfile");
    navigate("/admin", { replace: true });
  };

  return (
    <>
      <header className="site-header admin-header">
        <Link className="brand" to="/home">
          <span className="brand-icon">M</span>
          <b>MOBIX</b>
        </Link>
        <span className="admin-header-label">ADMIN PANEL</span>
        <AdminProfileBadge />
        <nav className="admin-nav">
          <AdminNavigation active="reviews" onLogout={logout} />
        </nav>
      </header>
      <main className="admin-page">
        <p className="breadcrumb">
          <Link to="/home">Store</Link> <span>/</span> Admin <span>/</span>{" "}
          Reviews
        </p>
        <div className="section-head admin-title">
          <div>
            <span className="eyebrow">CUSTOMER FEEDBACK</span>
            <h1>Product reviews</h1>
            <p>Approve customer reviews before they appear on product pages.</p>
          </div>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="success" role="status">
            {notice}
          </div>
        )}
        <section className="panel admin-users-panel">
          <form
            className="admin-toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setAppliedSearch(search.trim());
            }}
          >
            <div>
              <h2>
                {status === "pending"
                  ? "Pending reviews"
                  : `${status[0].toUpperCase()}${status.slice(1)} reviews`}
              </h2>
              <p>Newest reviews first.</p>
            </div>
            <div className="admin-search-row">
              <select
                aria-label="Review status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="">All statuses</option>
              </select>
              <input
                aria-label="Search reviews"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product or customer"
              />
              <button className="btn admin-search-button">Search</button>
            </div>
          </form>
          <div className="table-wrap">
            <table className="admin-review-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Customer</th>
                  <th>Rating</th>
                  <th>Review</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="admin-empty">
                      Loading reviews…
                    </td>
                  </tr>
                ) : reviews.length ? (
                  reviews.map((review) => (
                    <tr key={review._id}>
                      <td>
                        <b>{review.productName}</b>
                      </td>
                      <td>
                        <b>{review.customerName}</b>
                        <small>{review.customerEmail}</small>
                      </td>
                      <td className="admin-review-rating">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </td>
                      <td className="admin-review-comment">{review.comment}</td>
                      <td>
                        {new Date(review.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td>
                        <div className="admin-product-actions">
                          {review.status !== "approved" && (
                            <button
                              className="outline-btn admin-action unblock-action"
                              disabled={busyId === String(review._id)}
                              onClick={() => changeStatus(review, "approved")}
                            >
                              Approve
                            </button>
                          )}
                          {review.status !== "rejected" && (
                            <button
                              className="outline-btn admin-action block-action"
                              disabled={busyId === String(review._id)}
                              onClick={() => changeStatus(review, "rejected")}
                            >
                              Reject
                            </button>
                          )}
                          <button
                            className="outline-btn admin-action"
                            disabled={busyId === String(review._id)}
                            onClick={() => remove(review)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="admin-empty">
                      No reviews found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>
              Page {page} of {pages}
            </span>
            <div>
              <button
                className="outline-btn"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <button
                className="outline-btn"
                disabled={page >= pages || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { getMyProductReviews, getOrders, submitProductReview } from "../api";
import "./MyReviews.css";

export default function MyReviews() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getOrders(), getMyProductReviews()])
      .then(([orderResult, reviewResult]) => {
        if (!active) return;
        setOrders(orderResult.orders || []);
        setReviews(reviewResult.reviews || []);
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.status === 401 || requestError.status === 403) navigate("/user", { replace: true });
        else setError(requestError.message || "Could not load your reviews.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [navigate]);

  const deliveredProducts = useMemo(() => {
    const unique = new Map();
    orders.filter((order) => order.status === "Delivered").forEach((order) => (order.items || []).forEach((item) => {
      const id = String(item.productId || "");
      if (id && !unique.has(id)) unique.set(id, item);
    }));
    return [...unique.values()];
  }, [orders]);
  const reviewByProduct = useMemo(() => new Map(reviews.map((review) => [String(review.productId), review])), [reviews]);

  const submit = async (product) => {
    const id = String(product.productId);
    const draft = drafts[id] || { rating: "5", comment: "" };
    if (!draft.comment.trim()) { setError("Write your review before submitting."); return; }
    setBusyId(id); setError(""); setNotice("");
    try {
      const result = await submitProductReview(id, { rating: Number(draft.rating), comment: draft.comment.trim() });
      setReviews((current) => [result.review, ...current]);
      setNotice(result.message || "Review submitted for admin approval.");
    } catch (requestError) { setError(requestError.message || "Could not submit your review."); }
    finally { setBusyId(""); }
  };

  return <><SiteHeader /><main className="catalog-page my-reviews-page">
    <p className="catalog-breadcrumb"><Link to="/home">Home</Link> / <Link to="/account">My Account</Link> / My Reviews</p>
    <div className="catalog-title"><div><span className="eyebrow">YOUR FEEDBACK</span><h1>My Reviews</h1><p>Review products after they have been delivered to you.</p></div></div>
    {error && <p className="my-reviews-error" role="alert">{error}</p>}{notice && <p className="my-reviews-notice" role="status">{notice}</p>}
    {loading ? <p className="my-reviews-empty">Loading your delivered products…</p> : deliveredProducts.length ? <div className="my-reviews-list">{deliveredProducts.map((product) => {
      const id = String(product.productId);
      const review = reviewByProduct.get(id);
      const draft = drafts[id] || { rating: "5", comment: "" };
      return <article className="my-review-card" key={id}>
        {product.image && <img src={product.image} alt="" />}
        <div className="my-review-product"><span className="eyebrow">DELIVERED PRODUCT</span><h2>{product.name}</h2>{product.variantName && <small>{product.variantName}</small>}
          {review ? <div className="my-review-existing"><span className="my-review-status">Review {review.status}</span><span className="detail-review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span><p>{review.comment}</p><small>Submitted {new Date(review.createdAt).toLocaleDateString("en-IN")}</small></div> : <form className="my-review-form" onSubmit={(event) => { event.preventDefault(); submit(product); }}>
            <label>Rating<select value={draft.rating} onChange={(event) => setDrafts((current) => ({ ...current, [id]: { ...draft, rating: event.target.value } }))}><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></label>
            <label>Your review<textarea required maxLength={1200} rows="3" placeholder="Share your experience with this product" value={draft.comment} onChange={(event) => setDrafts((current) => ({ ...current, [id]: { ...draft, comment: event.target.value } }))} /></label>
            <button className="detail-add-button" disabled={busyId === id || !draft.comment.trim()}>{busyId === id ? "Submitting…" : "Submit review"}</button><small>Reviews are sent to admin for approval.</small>
          </form>}
        </div>
      </article>;
    })}</div> : <div className="my-reviews-empty"><h2>No delivered products yet</h2><p>After an order is delivered, you can write a review here.</p><Link className="outline-btn" to="/orders">View my orders</Link></div>}
  </main></>;
}

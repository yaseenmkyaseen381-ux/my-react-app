import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import ProductCard from "../components/ProductCard";
import { addProductToCart } from "../cart";
import { getProduct } from "../api";
import { loadWishlist, toggleWishlist } from "../wishlist";
import "./Catalog.css";

const money = (value) => `₹${value.toLocaleString("en-IN")}`;

export default function ProductDetails() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setProduct(null);
    getProduct(productId)
      .then((result) => {
        if (active) {
          setProduct(result.product);
          setRelated(result.related || []);
          setActiveImage(0);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active)
          setError(requestError.message || "This product is unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    loadWishlist()
      .then((ids) => {
        if (active) setWishlist(ids);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [productId]);

  const addToCart = async (item) => {
    try {
      const result = await addProductToCart(item.id, selectedVariant);
      if (result.wishlistUpdated)
        setWishlist((ids) => ids.filter((id) => id !== item.id));
      setNotice(
        result.wishlistUpdated
          ? `${item.name} added to cart and removed from wishlist.`
          : `${item.name} added to cart. Wishlist could not sync; try removing it again.`,
      );
    } catch (requestError) {
      setNotice(requestError.message || "Could not verify stock.");
    }
  };
  const buyNow = (item) => {
    navigate("/checkout", {
      state: {
        buyNowItem: {
          productId: item.id,
          variantId: selectedVariant,
          quantity: 1,
          name: item.name,
          price: chosenVariant?.price ?? item.price,
        },
      },
    });
  };
  const changeWishlist = async (item) => {
    try {
      setWishlist(await toggleWishlist(item.id));
    } catch (requestError) {
      setNotice(requestError.message || "Could not update wishlist.");
    }
  };

  if (loading)
    return (
      <>
        <SiteHeader />
        <main className="catalog-page">
          <div className="catalog-loading">Loading product…</div>
        </main>
      </>
    );
  if (error || !product)
    return (
      <>
        <SiteHeader />
        <main className="catalog-page">
          <p className="catalog-breadcrumb">
            <Link to="/home">Home</Link> / <Link to="/products">Products</Link>{" "}
            / Unavailable
          </p>
          <div className="empty-results">
            <h1>Product unavailable</h1>
            <p>{error || "This product cannot be found."}</p>
            <Link className="outline-btn" to="/products">
              Browse available products
            </Link>
          </div>
        </main>
      </>
    );

  const images = product.images?.length
    ? product.images
    : product.image
      ? [product.image]
      : [];
  const variants = product.variants || [];
  const chosenVariant = variants.find(
    (variant) => variant._id === selectedVariant,
  );
  const image = images[activeImage] || "";
  const outOfStock = variants.length
    ? !chosenVariant || chosenVariant.stock < 1
    : product.stock < 1;

  return (
    <>
      <SiteHeader />
      <main className="catalog-page product-detail-page">
        <p className="catalog-breadcrumb">
          <Link to="/home">Home</Link> / <Link to="/products">Products</Link> /{" "}
          {product.category} / {product.name}
        </p>
        <button className="detail-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <section className="detail-layout">
          <div className="detail-gallery">
            <button
              className="detail-image-frame"
              onClick={() => image && setZoomOpen(true)}
              aria-label={
                image ? `Zoom in on ${product.name}` : `${product.name} image`
              }
            >
              {image ? (
                <img
                  src={image}
                  alt={`${product.name} product view ${activeImage + 1}`}
                />
              ) : (
                <span className="detail-placeholder">▣</span>
              )}
              {image && <small>Click image to zoom</small>}
            </button>
            {images.length > 1 && (
              <div className="detail-thumbnails" aria-label="Product images">
                {images.map((src, index) => (
                  <button
                    className={activeImage === index ? "active" : ""}
                    key={src}
                    onClick={() => setActiveImage(index)}
                    aria-label={`Show product image ${index + 1}`}
                  >
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="detail-copy">
            <span className="eyebrow">{product.category}</span>
            <h1>{product.name}</h1>
            <p className="detail-subtitle">{product.detail}</p>
            <div className="detail-price">
              <b>{money(chosenVariant?.price ?? product.price)}</b>
              {product.oldPrice > (chosenVariant?.price ?? product.price) && (
                <>
                  <del>{money(product.oldPrice)}</del>
                  <span>
                    {Math.round(
                      (1 -
                        (chosenVariant?.price ?? product.price) /
                          product.oldPrice) *
                        100,
                    )}
                    % off
                  </span>
                </>
              )}
            </div>
            {variants.length > 0 && (
              <label className="variant-picker">
                Choose an option
                <select
                  value={selectedVariant}
                  onChange={(event) => setSelectedVariant(event.target.value)}
                >
                  <option value="">Select variant</option>
                  {variants.map((variant) => (
                    <option
                      key={variant._id}
                      value={variant._id}
                      disabled={variant.stock < 1}
                    >
                      {variant.name}
                      {variant.stock < 1
                        ? " · Out of stock"
                        : ` · ${variant.stock} available`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className={`detail-stock ${outOfStock ? "is-out" : ""}`}>
              {outOfStock
                ? variants.length && !chosenVariant
                  ? "Choose a variant"
                  : "Currently unavailable"
                : `In stock · ${variants.length ? chosenVariant.stock : product.stock} available`}
            </p>
            <p className="detail-description">{product.description}</p>
            <h2>Highlights</h2>
            <ul className="detail-highlights">
              {product.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
            <div className="detail-actions">
              <button
                className="detail-add-button"
                disabled={outOfStock}
                onClick={() => addToCart(product)}
              >
                {outOfStock ? "Out of stock" : "Add to cart"}
              </button>
              <button
                className="detail-buy-button"
                disabled={outOfStock}
                onClick={() => buyNow(product)}
              >
                {outOfStock ? "Unavailable" : "Buy now"}
              </button>
              <button
                className={`detail-wishlist ${wishlist.includes(product.id) ? "is-saved" : ""}`}
                onClick={() => changeWishlist(product)}
                aria-label={`${wishlist.includes(product.id) ? "Remove from" : "Add to"} wishlist`}
              >
                {wishlist.includes(product.id) ? "♥ Saved" : "♡ Wishlist"}
              </button>
            </div>
            {outOfStock && (
              <p className="detail-unavailable">
                This item is currently unavailable.{" "}
                <Link to="/products">Browse available products</Link>.
              </p>
            )}
          </div>
        </section>
        {related.length > 0 && (
          <section className="section detail-related">
            <div className="section-head">
              <div>
                <h2>Related products</h2>
                <p>More from {product.category}.</p>
              </div>
              <Link
                className="text-link"
                to={`/products?category=${encodeURIComponent(product.categoryId)}`}
              >
                View all →
              </Link>
            </div>
            <div className="product-grid">
              {related.map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                  saved={wishlist.includes(item.id)}
                  onToggleSaved={changeWishlist}
                  onAddToBag={addToCart}
                />
              ))}
            </div>
          </section>
        )}
      </main>
      {zoomOpen && (
        <div
          className="image-zoom"
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} enlarged image`}
          onClick={() => setZoomOpen(false)}
        >
          <button aria-label="Close zoom" onClick={() => setZoomOpen(false)}>
            ×
          </button>
          <img src={image} alt={product.name} />
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </>
  );
}

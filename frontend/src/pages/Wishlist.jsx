import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import ProductCard from "../components/ProductCard";
import { addProductToCart } from "../cart";
import { getProduct } from "../api";
import { loadWishlist, toggleWishlist } from "../wishlist";
import "./Catalog.css";

export default function Wishlist() {
  const [wishlistIds, setWishlistIds] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    loadWishlist()
      .then(async (ids) => {
        if (!active) return;
        setWishlistIds(ids);
        const results = await Promise.all(
          ids.map((id) => getProduct(id).catch(() => null)),
        );
        if (active) {
          const available = results
            .map((result) => result?.product)
            .filter(Boolean);
          setProducts(available);
          setWishlistIds(available.map((product) => product.id));
        }
      })
      .catch((error) => {
        if (active) setNotice(error.message || "Could not load your wishlist.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const removeSaved = async (product) => {
    try {
      setWishlistIds(await toggleWishlist(product.id));
      setProducts((items) => items.filter((item) => item.id !== product.id));
      setNotice("Removed from wishlist.");
    } catch (error) {
      setNotice(error.message || "Could not update your wishlist.");
    }
  };
  const addToCart = async (product) => {
    try {
      const result = await addProductToCart(product.id);
      if (result.wishlistUpdated) {
        setWishlistIds((ids) => ids.filter((id) => id !== product.id));
        setProducts((items) => items.filter((item) => item.id !== product.id));
        setNotice(`${product.name} added to cart and removed from wishlist.`);
      } else
        setNotice(
          `${product.name} added to cart, but the wishlist could not sync. Try removing it again.`,
        );
    } catch (error) {
      setNotice(error.message || "Could not verify product stock.");
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="catalog-page wishlist-page">
        <p className="catalog-breadcrumb">
          <Link to="/home">Home</Link> / Wishlist
        </p>
        <div className="catalog-title">
          <div>
            <span className="eyebrow">SAVED FOR LATER</span>
            <h1>My wishlist</h1>
            <p>
              {wishlistIds.length} saved{" "}
              {wishlistIds.length === 1 ? "product" : "products"}
            </p>
          </div>
          <Link className="catalog-cart-link" to="/products">
            Browse products
          </Link>
        </div>
        {loading ? (
          <div className="catalog-loading">Loading wishlist…</div>
        ) : products.length ? (
          <div className="product-grid catalog-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                saved
                onToggleSaved={removeSaved}
                onAddToBag={addToCart}
              />
            ))}
          </div>
        ) : (
          <div className="empty-results cart-empty">
            <span className="cart-empty-icon">♡</span>
            <h2>Your wishlist is empty</h2>
            <p>Save products here and come back to them later.</p>
            <Link className="outline-btn" to="/products">
              Discover products
            </Link>
          </div>
        )}
      </main>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </>
  );
}

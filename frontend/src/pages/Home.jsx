import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMe, getProducts } from "../api";
import ProductCard from "../components/ProductCard";
import CategoryArtwork from "../components/CategoryArtwork";
import laptopBanner from "../assets/laptop-banner.jpg";
import ProfileMenu from "../components/ProfileMenu";
import { addProductToCart, readCart, validateAndSaveCart } from "../cart";
import { loadWishlist, toggleWishlist } from "../wishlist";
import "./Home.css";
import {
  clearSession,
  getSessionToken,
  getSessionUser,
  saveSession,
} from "../authSession";

const categories = [
  { name: "Smartphones", filter: "phones" },
  { name: "Laptops", filter: "laptops" },
  { name: "Tablets", filter: "tablets" },
  { name: "Audio", filter: "audio" },
  { name: "Smartwatches", filter: "wearables" },
  { name: "Accessories", filter: "accessories" },
];

const money = (value) => `₹${value.toLocaleString("en-IN")}`;

function readStoredUser() {
  return getSessionUser("user");
}

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(readStoredUser);
  const [products, setProducts] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [query, setQuery] = useState(
    () => new URLSearchParams(window.location.search).get("q") || "",
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [bag, setBag] = useState(readCart);
  const [bagOpen, setBagOpen] = useState(false);
  const [saved, setSaved] = useState([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    getProducts({ page: 1, limit: 50, sort: "newest" })
      .then((result) => {
        if (active) {
          setProducts(result.products || []);
          setCatalogError("");
        }
      })
      .catch((error) => {
        if (active)
          setCatalogError(
            error.message || "Could not load the product catalogue.",
          );
      });
    loadWishlist()
      .then((ids) => {
        if (active) setSaved(ids);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!getSessionToken("user")) return;
    getMe()
      .then((freshUser) => {
        setUser(freshUser);
        saveSession("user", getSessionToken("user"), freshUser);
      })
      .catch(() => {
        clearSession("user");
        setUser(null);
        navigate("/user", { replace: true });
      });
  }, []);

  useEffect(() => {
    const syncUser = () => setUser(readStoredUser());
    window.addEventListener("mobix-user-session-updated", syncUser);
    return () =>
      window.removeEventListener("mobix-user-session-updated", syncUser);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory =
          category === "All" || product.categoryId === category;
        const matchesQuery =
          `${product.name} ${product.category} ${product.detail}`
            .toLowerCase()
            .includes(query.toLowerCase().trim());
        return matchesCategory && matchesQuery;
      }),
    [products, category, query],
  );
  const hasProductFilter = Boolean(query.trim()) || category !== "All";
  const mobilePhones = products
    .filter((product) => product.categoryId === "phones")
    .slice(0, 4);
  const laptops = products
    .filter((product) => product.categoryId === "laptops")
    .slice(0, 4);
  const accessories = products
    .filter((product) => product.categoryId === "accessories")
    .slice(0, 4);
  const bagProducts = bag.map((item) => ({
    product: products.find((product) => product.id === item.productId) || item,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.price,
  }));
  const bagTotal = bagProducts.reduce(
    (total, item) =>
      total + (item.unitPrice ?? item.product.price) * item.quantity,
    0,
  );

  const logout = () => {
    clearSession("user");
    setUser(null);
    navigate("/user");
  };

  const updateCart = async (next, successMessage) => {
    try {
      const result = await validateAndSaveCart(next);
      setBag(result.cart);
      setNotice(successMessage);
    } catch (error) {
      setNotice(
        error.message || "Could not check product availability. Try again.",
      );
    }
  };

  const addToBag = (product) => {
    addProductToCart(product.id)
      .then(({ cart: next, wishlistUpdated }) => {
        setBag(next);
        if (wishlistUpdated)
          setSaved((ids) => ids.filter((id) => id !== product.id));
        setNotice(
          wishlistUpdated
            ? `${product.name} added to cart and removed from your wishlist.`
            : `${product.name} added to cart. Wishlist could not sync; try removing it again.`,
        );
      })
      .catch((error) => setNotice(error.message || "Could not verify stock."));
  };

  const changeQuantity = (productId, change) => {
    const next = bag
      .map((item) =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + change }
          : item,
      )
      .filter((item) => item.quantity > 0);
    updateCart(next, "Cart updated");
  };

  const removeFromCart = (productId) => {
    const next = bag.filter((item) => item.productId !== productId);
    updateCart(next, "Product removed from cart");
  };

  const toggleSaved = async (product) => {
    const isSaved = saved.includes(product.id);
    try {
      setSaved(await toggleWishlist(product.id));
      setNotice(isSaved ? "Removed from wishlist" : "Added to wishlist");
    } catch (error) {
      setNotice(error.message || "Could not update wishlist.");
    }
  };

  const showProducts = (selectedCategory = "All") => {
    setCategory(selectedCategory);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <header className="site-header home-header">
        <Link className="brand" to="/home" aria-label="MOBIX home">
          <span className="brand-icon">M</span>
          <b>MOBIX</b>
        </Link>
        <nav aria-label="Main navigation">
          <a
            href="#top"
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
          >
            Home
          </a>
          <Link to="/products">Products</Link>
          <Link to="/categories">Categories</Link>
          <a href="#deals">Offers</a>
          {user && (
            <button className="home-side-logout" type="button" onClick={logout}>
              <span aria-hidden="true">↪</span> Log out
            </button>
          )}
        </nav>
        <form
          className={`searchbox header-search ${searchOpen ? "is-open" : "is-closed"}`}
          onSubmit={(event) => {
            event.preventDefault();
            navigate(`/products?q=${encodeURIComponent(query.trim())}`);
          }}
        >
          <button
            className="search-toggle"
            type="button"
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="10.8"
                cy="10.8"
                r="6.7"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="m16 16 4.2 4.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          {searchOpen && (
            <input
              autoFocus
              aria-label="Search products"
              placeholder="Search phones, audio, and more"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCategory("All");
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearchOpen(false);
              }}
            />
          )}
        </form>
        <div className="header-actions">
          {user ? (
            <ProfileMenu user={user} onLogout={logout} />
          ) : (
            <Link className="header-login" to="/user">
              Log in
            </Link>
          )}
          <Link
            className="wishlist-button"
            to="/wishlist"
            aria-label="Open wishlist"
            title="Wishlist"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20.8 8.7c0 5.1-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.7A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.7Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <button
            className="bag-button"
            onClick={() => setBagOpen((open) => !open)}
            aria-label={`Shopping bag with ${bag.length} items`}
            aria-expanded={bagOpen}
            aria-controls="shopping-bag"
          >
            <span className="bag-glyph" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 4h2l2.15 11.2a2 2 0 0 0 1.97 1.62h8.54a2 2 0 0 0 1.94-1.5L21 8H6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 11h8M10 8v6M15 8v6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="10" cy="20" r="1.35" fill="currentColor" />
                <circle cx="18" cy="20" r="1.35" fill="currentColor" />
              </svg>
            </span>
            {bag.length > 0 && (
              <span className="bag-count">
                {bag.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {bagOpen && (
        <aside
          className="bag-panel"
          id="shopping-bag"
          aria-label="Shopping bag"
        >
          <div className="bag-panel-head">
            <div>
              <b>Your bag</b>
              <small>
                {bag.length} {bag.length === 1 ? "item" : "items"}
              </small>
            </div>
            <button
              className="bag-close"
              aria-label="Close shopping bag"
              onClick={() => setBagOpen(false)}
            >
              ×
            </button>
          </div>
          {bagProducts.length ? (
            <>
              <ul className="bag-list">
                {bagProducts.map(
                  ({ product, productId, quantity, unitPrice }) => (
                    <li key={productId}>
                      <span className="bag-item-art" aria-hidden="true">
                        {product.icon || "▣"}
                      </span>
                      <span className="bag-item-info">
                        <b>{product.name}</b>
                        <small>{money(unitPrice ?? product.price)} each</small>
                        <span className="bag-quantity">
                          <button
                            onClick={() => changeQuantity(productId, -1)}
                            aria-label={`Decrease ${product.name} quantity`}
                          >
                            −
                          </button>
                          <b>{quantity}</b>
                          <button
                            onClick={() => changeQuantity(productId, 1)}
                            aria-label={`Increase ${product.name} quantity`}
                          >
                            +
                          </button>
                        </span>
                      </span>
                      <button
                        className="bag-remove"
                        onClick={() => removeFromCart(productId)}
                        aria-label={`Remove ${product.name}`}
                      >
                        Remove
                      </button>
                    </li>
                  ),
                )}
              </ul>
              <div className="bag-subtotal">
                <span>Subtotal</span>
                <b>{money(bagTotal)}</b>
              </div>
              <p className="bag-note">
                Taxes and delivery are calculated at checkout.
              </p>
              <button
                className="bag-checkout"
                disabled={!bagProducts.length}
                onClick={() => navigate("/cart")}
              >
                Review cart
              </button>
            </>
          ) : (
            <div className="bag-empty">
              <span aria-hidden="true">▱</span>
              <b>Your bag is empty</b>
              <p>Add something you love and it will show up here.</p>
              <button
                onClick={() => {
                  setBagOpen(false);
                  showProducts();
                }}
              >
                Explore products
              </button>
            </div>
          )}
        </aside>
      )}

      <main className="home" id="top">
        {user && (
          <p className="store-welcome">
            Welcome back, <b>{user.name?.split(" ")[0] || "there"}</b>. Find
            something you'll love.
          </p>
        )}
        <section className="home-hero" aria-labelledby="home-hero-title">
          <span className="home-hero-eyebrow">THE MOBIX EDIT</span>
          <h1 id="home-hero-title">Discover our collection</h1>
          <p>Find the right tech for every mood, moment, and everyday need.</p>
          <button className="home-hero-button" onClick={() => showProducts()}>
            Explore products <span aria-hidden="true">→</span>
          </button>
          <img
            className="home-hero-image"
            src="/hero-devices.jpg"
            alt="Phones, laptop, earbuds, and other MOBIX devices"
          />
        </section>
        {catalogError && (
          <p className="catalog-notice" role="alert">
            {catalogError}
          </p>
        )}

        <section className="section" id="deals">
          <div className="section-head">
            <div>
              <h2>Offers &amp; Deals</h2>
              <p>Browse this week's featured picks.</p>
            </div>
            <button className="text-link" onClick={() => showProducts()}>
              View all products <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="deal-grid">
            <article className="deal-card deal-blue">
              <div className="deal-copy">
                <span className="deal-label">SMARTPHONE DEALS</span>
                <h3>Find your next phone</h3>
                <p>Explore everyday phones and upgrades.</p>
                <button onClick={() => showProducts("phones")}>
                  Shop phones <span aria-hidden="true">→</span>
                </button>
              </div>
              <div className="deal-visual deal-visual-phone" aria-hidden="true">
                <img
                  src="https://images.unsplash.com/photo-1589492477829-5e65395b66cc?auto=format&fit=crop&w=900&q=82"
                  alt=""
                  loading="lazy"
                />
              </div>
            </article>
            <article className="deal-card deal-violet">
              <div className="deal-copy">
                <span className="deal-label">LAPTOP OFFERS</span>
                <h3>Ready for what’s next</h3>
                <p>Browse laptops for work and study.</p>
                <button onClick={() => showProducts("laptops")}>
                  Shop laptops <span aria-hidden="true">→</span>
                </button>
              </div>
              <div
                className="deal-visual deal-visual-laptop"
                aria-hidden="true"
              >
                <img src={laptopBanner} alt="" loading="lazy" />
              </div>
            </article>
            <article className="deal-card deal-peach">
              <div className="deal-copy">
                <span className="deal-label">ACCESSORIES</span>
                <h3>Small things, big help</h3>
                <p>Explore useful everyday add-ons.</p>
                <button onClick={() => showProducts("accessories")}>
                  Shop accessories <span aria-hidden="true">→</span>
                </button>
              </div>
              <div className="deal-visual deal-visual-audio" aria-hidden="true">
                <img
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=82"
                  alt=""
                  loading="lazy"
                />
              </div>
            </article>
          </div>
        </section>

        <section className="section" id="products">
          {hasProductFilter ? (
            <>
              <div className="section-head">
                <div>
                  <h2>
                    {query
                      ? "Search results"
                      : `${categories.find((item) => item.filter === category)?.name || category} picks`}
                  </h2>
                  <p>
                    {query
                      ? `Products matching “${query}”`
                      : `Browse products in ${categories.find((item) => item.filter === category)?.name || category}.`}
                  </p>
                </div>
                <button
                  className="text-link"
                  onClick={() => {
                    setQuery("");
                    setCategory("All");
                  }}
                >
                  Clear filter
                </button>
              </div>
              {filteredProducts.length ? (
                <div className="product-grid">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      saved={saved.includes(product.id)}
                      onToggleSaved={toggleSaved}
                      onAddToBag={addToBag}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-results">
                  <span className="icon-glyph" aria-hidden="true">
                    ⌕
                  </span>
                  <h3>No products found</h3>
                  <p>Try another search or browse all our popular picks.</p>
                  <button
                    className="outline-btn"
                    onClick={() => {
                      setQuery("");
                      setCategory("All");
                    }}
                  >
                    Show all products
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="section-head">
                <div>
                  <h2>Latest Mobile Phones</h2>
                  <p>New arrivals and popular phones.</p>
                </div>
                <button
                  className="text-link"
                  onClick={() => showProducts("phones")}
                >
                  View all phones <span aria-hidden="true">→</span>
                </button>
              </div>
              <div className="product-grid">
                {mobilePhones.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    saved={saved.includes(product.id)}
                    onToggleSaved={toggleSaved}
                    onAddToBag={addToBag}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="trade">
          <div>
            <span className="eyebrow">COMING SOON</span>
            <h2>Trade in your current gear.</h2>
            <p>
              We’re preparing a simple way to trade in eligible devices.
              Trade-in requests aren’t available in this demo yet.
            </p>
            <button className="btn" onClick={() => showProducts()}>
              Browse devices <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="trade-box">
            <b>MOBIX Trade-in</b>
            <br />
            Device assessment
            <br />
            Trade-in value
            <br />
            Applied to your next upgrade
          </div>
        </section>

        {!hasProductFilter && (
          <section className="section" id="laptops">
            <div className="section-head">
              <div>
                <h2>Latest Laptops</h2>
                <p>Everyday and performance laptops.</p>
              </div>
              <button
                className="text-link"
                onClick={() => showProducts("laptops")}
              >
                View all laptops <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="product-grid">
              {laptops.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  saved={saved.includes(product.id)}
                  onToggleSaved={toggleSaved}
                  onAddToBag={addToBag}
                />
              ))}
            </div>
          </section>
        )}
        {!hasProductFilter && accessories.length > 0 && (
          <section className="section" id="accessories">
            <div className="section-head">
              <div>
                <h2>Latest Accessories</h2>
                <p>Useful add-ons for your everyday devices.</p>
              </div>
              <button
                className="text-link"
                onClick={() => showProducts("accessories")}
              >
                View all accessories <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="product-grid">
              {accessories.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  saved={saved.includes(product.id)}
                  onToggleSaved={toggleSaved}
                  onAddToBag={addToBag}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div>
          <Link className="brand" to="/home">
            <span className="brand-icon">M</span>
            <b>MOBIX</b>
          </Link>
          <p>Everyday tech, made easier to find.</p>
        </div>
        <div>
          <b>Explore</b>
          <a href="#products" onClick={() => setCategory("All")}>
            All products
          </a>
          <Link to="/categories">Categories</Link>
          <a href="#deals">Current deals</a>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/cart">Shopping cart</Link>
        </div>
        <div>
          <b>Your account</b>
          {user ? (
            <>
              <Link to="/account">Account details</Link>
              <button className="footer-link-button" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/user">Log in</Link>
              <Link to="/signup">Create account</Link>
            </>
          )}
        </div>
        <div>
          <b>Need help?</b>
          <p>For account assistance, contact your MOBIX store administrator.</p>
          <Link to="/forgot-password">Password reset</Link>
          <a
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Back to top
          </a>
        </div>
        <small>
          © {new Date().getFullYear()} MOBIX. Product details and prices shown
          are examples.
        </small>
      </footer>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </>
  );
}

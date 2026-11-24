import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { readCart, saveCartLocally, validateAndSaveCart } from "../cart";
import { validateCheckoutCart } from "../api";
import "./Catalog.css";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function Cart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(readCart);
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const [cartValid, setCartValid] = useState(false);
  const lines = useMemo(() => cart, [cart]);
  const total = lines.reduce(
    (sum, line) => sum + (line.price || 0) * line.quantity,
    0,
  );
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);

  useEffect(() => {
    if (!cart.length) {
      setCartValid(true);
      return;
    }
    setChecking(true);
    validateAndSaveCart(cart)
      .then(({ cart: validated }) => {
        setCart(validated);
        setCartValid(true);
        setNotice("");
      })
      .catch((error) => {
        setCartValid(false);
        setNotice(
          error.message ||
            "Could not verify current product availability. Remove unavailable items or try again.",
        );
      })
      .finally(() => setChecking(false));
    // Validate once when the cart page opens; quantity changes validate explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCart = async (next) => {
    setChecking(true);
    try {
      const result = await validateAndSaveCart(next);
      setCart(result.cart);
      setCartValid(true);
      setNotice("Cart updated and current stock confirmed.");
    } catch (error) {
      setCartValid(false);
      setNotice(
        error.message || "Could not verify current product availability.",
      );
    } finally {
      setChecking(false);
    }
  };

  const removeItem = (productId, variantId = "") => {
    const item = cart.find(
      (line) =>
        line.productId === productId && (line.variantId || "") === variantId,
    );
    const next = cart.filter(
      (line) =>
        !(
          line.productId === productId &&
          (line.variantId || "") === (item?.variantId || "")
        ),
    );
    // Removing is always allowed, including when another item became unavailable.
    saveCartLocally(next);
    setCart(next);
    setCartValid(next.length === 0);
    setNotice(
      next.length
        ? "Item removed. Check the remaining cart before checkout."
        : "Item removed.",
    );
    if (next.length) updateCart(next);
  };

  const checkout = async () => {
    setChecking(true);
    try {
      const result = await validateCheckoutCart(
        cart.map(({ productId, variantId, quantity }) => ({
          productId,
          variantId,
          quantity,
        })),
      );
      const currentCart = result.items.map(
        ({
          productId,
          variantId,
          variantName,
          name,
          category,
          image,
          quantity,
          price,
          stock,
          lineTotal,
        }) => ({
          productId,
          variantId,
          variantName,
          name,
          category,
          image,
          quantity,
          price,
          stock,
          lineTotal,
        }),
      );
      saveCartLocally(currentCart);
      setCart(currentCart);
      setCartValid(true);
      setNotice(
        "Your cart is verified. Continue to checkout to place your order.",
      );
      navigate("/checkout");
    } catch (error) {
      setCartValid(false);
      setNotice(
        error.message ||
          "One or more cart items are no longer available. Update your cart and try again.",
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="catalog-page cart-page">
        <p className="catalog-breadcrumb">
          <Link to="/home">Home</Link> / Cart
        </p>
        <div className="catalog-title">
          <div>
            <span className="eyebrow">YOUR MOBIX BAG</span>
            <h1>Shopping cart</h1>
            <p>
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </p>
          </div>
          <Link className="catalog-cart-link" to="/products">
            Continue shopping
          </Link>
        </div>
        {notice && (
          <p className="cart-notice" role="status">
            {notice}
          </p>
        )}
        {lines.length ? (
          <div className="cart-layout">
            <section className="cart-items" aria-label="Items in cart">
              {lines.map((line) => (
                <article className="cart-line" key={line.productId}>
                  <Link
                    className="cart-thumb"
                    to={`/products/${line.productId}`}
                  >
                    {line.image ? (
                      <img src={line.image} alt={line.name || "Product"} />
                    ) : (
                      <span aria-hidden="true">▣</span>
                    )}
                  </Link>
                  <div className="cart-line-info">
                    <small>
                      {line.category || "Product"}
                      {line.variantName ? ` · ${line.variantName}` : ""}
                    </small>
                    <Link to={`/products/${line.productId}`}>
                      <b>{line.name || "Store product"}</b>
                    </Link>
                    <strong>{money(line.price)}</strong>
                    <div className="bag-quantity">
                      <button
                        disabled={checking || line.quantity <= 1}
                        onClick={() =>
                          updateCart(
                            cart.map((item) =>
                              item.productId === line.productId &&
                              (item.variantId || "") === (line.variantId || "")
                                ? { ...item, quantity: item.quantity - 1 }
                                : item,
                            ),
                          )
                        }
                        aria-label={`Decrease ${line.name} quantity`}
                      >
                        −
                      </button>
                      <b>{line.quantity}</b>
                      <button
                        disabled={
                          checking ||
                          line.quantity >= Math.min(line.stock || 10, 10)
                        }
                        onClick={() =>
                          updateCart(
                            cart.map((item) =>
                              item.productId === line.productId &&
                              (item.variantId || "") === (line.variantId || "")
                                ? { ...item, quantity: item.quantity + 1 }
                                : item,
                            ),
                          )
                        }
                        aria-label={`Increase ${line.name} quantity`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="cart-line-total">
                    <b>{money((line.price || 0) * line.quantity)}</b>
                    <button
                      disabled={checking}
                      onClick={() =>
                        removeItem(line.productId, line.variantId || "")
                      }
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </section>
            <aside className="cart-summary">
              <h2>Order summary</h2>
              <div>
                <span>Items ({totalItems})</span>
                <b>{money(total)}</b>
              </div>
              <div>
                <span>Delivery</span>
                <b>Calculated at checkout</b>
              </div>
              <hr />
              <div className="cart-grand-total">
                <span>Subtotal</span>
                <b>{money(total)}</b>
              </div>
              <p>
                Product prices and stock are checked by the server. They are
                rechecked when you continue to checkout.
              </p>
              <button
                disabled={!cart.length || checking || !cartValid}
                onClick={checkout}
              >
                {checking ? "Checking cart…" : "Continue to checkout"}
              </button>
              {!cartValid && (
                <p className="cart-invalid" role="alert">
                  Checkout is disabled until every cart item is available and
                  verified.
                </p>
              )}
            </aside>
          </div>
        ) : (
          <div className="empty-results cart-empty">
            <span className="cart-empty-icon" aria-hidden="true">
              <svg
                viewBox="0 0 48 48"
                width="38"
                height="38"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 8h5l4.5 22h21l5-16H12" />
                <path d="M17 36h.01M33 36h.01" />
                <circle cx="17" cy="36" r="2.5" />
                <circle cx="33" cy="36" r="2.5" />
              </svg>
            </span>
            <h2>Your cart is empty</h2>
            <p>Add products you like and they will appear here.</p>
            <Link className="outline-btn" to="/products">
              Browse products
            </Link>
          </div>
        )}
        {checking && (
          <p className="cart-checking" role="status">
            Checking current prices and stock…
          </p>
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

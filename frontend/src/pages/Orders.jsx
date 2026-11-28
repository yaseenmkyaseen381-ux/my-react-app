import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { mobixLogoDataUrl } from "../brandLogo";
import {
  getOrders,
  getOrder,
  cancelOrder,
  requestReturn,
  retryPayment,
  verifyPayment,
  recordPaymentFailure,
  downloadInvoice,
} from "../api";
import "./OrderCommerce.css";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
function openPayment(result, id) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => {
      const r = new window.Razorpay({
        key: result.razorpay.keyId,
        order_id: result.razorpay.orderId,
        amount: result.razorpay.amount,
        currency: result.razorpay.currency,
        name: "MOBIX",
        image: mobixLogoDataUrl,
        handler: async (response) => {
          try {
            await verifyPayment(id, response);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        modal: {
          ondismiss: async () => {
            await recordPaymentFailure(id, {
              paymentOrderId: result.razorpay.orderId,
              reason: "Checkout closed before payment.",
            }).catch(() => {});
            reject(Error("Payment was not completed."));
          },
        },
      });
      r.on("payment.failed", (response) => {
        recordPaymentFailure(id, {
          paymentOrderId: result.razorpay.orderId,
          paymentId: response.error?.metadata?.payment_id,
          reason: response.error?.description,
        }).catch(() => {});
        reject(Error("Payment failed. You can retry again."));
      });
      r.open();
    };
    s.onerror = () => reject(Error("Could not load Razorpay."));
    document.body.appendChild(s);
  });
}
export default function Orders() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonOption, setCancelReasonOption] = useState("");
  const [cancelFormOpen, setCancelFormOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [error, setError] = useState("");
  const reload = useCallback(
    () =>
      orderId
        ? getOrder(orderId).then(({ order: o }) => setOrder(o))
        : getOrders({ search }).then(({ orders: o }) => setOrders(o)),
    [orderId, search],
  );
  useEffect(() => {
    let active = true;
    const refresh = () =>
      reload().catch((e) => {
        if (active) setError(e.message);
      });
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const timer = window.setInterval(refresh, orderId ? 5000 : 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [reload]);
  const act = async (fn) => {
    try {
      setError("");
      await fn();
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };
  const handleCancelOrder = async () => {
    try {
      setError("");
      const reason =
        cancelReasonOption === "other"
          ? cancelReason.trim()
          : cancelReasonOption;
      if (!reason) {
        setError("Choose a reason before cancelling this order.");
        return;
      }
      await cancelOrder(order._id, reason);
      navigate("/orders", { replace: true });
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <SiteHeader />
      <main className="catalog-page cart-page">
        <p className="catalog-breadcrumb">
          <Link to="/home">Home</Link> / <Link to="/orders">Orders</Link>
        </p>
        <div className="catalog-title">
          <div>
            <span className="eyebrow">YOUR MOBIX PURCHASES</span>
            <h1>{orderId ? "Order details" : "My orders"}</h1>
          </div>
        </div>
        {error && (
          <p className="cart-notice" role="alert">
            {error}
          </p>
        )}
        {orderId ? (
          order && (
            <article className="cart-summary order-receipt">
              <header className="receipt-header">
                <div>
                  <span className="eyebrow">ORDER RECEIPT</span>
                  <h2>Order {order.orderNumber}</h2>
                </div>
                <span
                  className={`receipt-status status-${order.status.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {order.status}
                </span>
              </header>
              <div
                className={`receipt-message ${order.paymentStatus === "failed" ? "is-warning" : "is-success"}`}
              >
                <span aria-hidden="true">
                  {order.paymentStatus === "failed" ? "!" : "✓"}
                </span>
                <p>
                  {order.paymentStatus === "failed"
                    ? "Your order is saved, but payment is incomplete."
                    : "Your order has been placed successfully."}
                </p>
              </div>
              <div className="receipt-meta">
                <span>
                  Placed {new Date(order.createdAt).toLocaleString("en-IN")}
                </span>
                <span>Payment: {order.paymentStatus}</span>
              </div>
              <section className="receipt-section">
                <h3>Items ordered</h3>
                <div className="receipt-items">
                  {order.items.map((i) => (
                    <div
                      className="receipt-item-row"
                      key={i.productId + i.variantId}
                    >
                      <div className="receipt-item-thumb">
                        {i.image ? (
                          <img src={i.image} alt="" />
                        ) : (
                          <span aria-hidden="true">▣</span>
                        )}
                      </div>
                      <div className="receipt-item-copy">
                        <b>{i.name}</b>
                        {i.variantName && <small>{i.variantName}</small>}
                        <small>Quantity: {i.quantity}</small>
                      </div>
                      <b className="receipt-item-price">{money(i.lineTotal)}</b>
                    </div>
                  ))}
                </div>
              </section>
              <section className="receipt-totals">
                <div>
                  <span>Subtotal</span>
                  <b>{money(order.subtotal)}</b>
                </div>
                {order.discount > 0 && <div><span>Coupon discount ({order.couponCode})</span><b>−{money(order.discount)}</b></div>}
                <div>
                  <span>Shipping</span>
                  <b>{order.shipping ? money(order.shipping) : "Free"}</b>
                </div>
                <div className="receipt-total">
                  <span>Total paid / payable</span>
                  <b>{money(order.total)}</b>
                </div>
              </section>
              <section className="receipt-delivery">
                <span className="receipt-section-label">Delivering to</span>
                <b>{order.address?.fullName}</b>
                <p>
                  {order.address?.line1}
                  {order.address?.line2 ? `, ${order.address.line2}` : ""},{" "}
                  {order.address?.city}, {order.address?.state}{" "}
                  {order.address?.postalCode}
                </p>
                <small>{order.address?.phone}</small>
              </section>
              {order.returnRequest?.status &&
                order.returnRequest.status !== "none" &&
                order.returnRequest.status !== "completed" && (
                  <section className="receipt-return-notice" role="status">
                    <b>Return request: {order.returnRequest.status}</b>
                    <p>Reason: {order.returnRequest.reason}</p>
                    {order.returnRequest.status === "accepted" &&
                      order.refundStatus === "refunded" && (
                        <p>Your refund was added to your MOBIX wallet.</p>
                      )}
                  </section>
                )}
              {order.returnRequest?.status === "completed" && (
                <p className="receipt-return-notice" role="status">
                  {order.refundStatus === "refunded"
                    ? "Your return refund was added to your MOBIX wallet."
                    : "Your return was received. The refund is being processed to your MOBIX wallet."}
                </p>
              )}
              <div className="receipt-actions">
                <button
                  className="receipt-btn receipt-btn-secondary"
                  onClick={() => window.print()}
                >
                  Print receipt
                </button>
                <button
                  className="receipt-btn receipt-btn-primary"
                  onClick={() => act(() => downloadInvoice(order._id))}
                >
                  Download invoice PDF
                </button>
              </div>
              {order.status === "Pending" && (
                <section className="receipt-cancel-panel">
                  <label>
                    {cancelFormOpen
                      ? "Cancel this order"
                      : "Want to cancel this order?"}
                    <small>
                      {order.paymentStatus === "paid"
                        ? "The amount will be refunded to your MOBIX wallet."
                        : "Choose a reason before cancelling."}
                    </small>
                  </label>
                  {cancelFormOpen ? (
                    <>
                      <select
                        id="cancel-reason-option"
                        aria-label="Reason for cancellation"
                        required
                        value={cancelReasonOption}
                        onChange={(e) => {
                          setCancelReasonOption(e.target.value);
                          setCancelReason("");
                        }}
                      >
                        <option value="">Reason for cancellation</option>
                        <option value="I want to change the payment option">
                          I want to change the payment option
                        </option>
                        <option value="I want to change the delivery address">
                          I want to change the delivery address
                        </option>
                        <option value="other">
                          My reason is not listed here
                        </option>
                      </select>
                      {cancelReasonOption === "other" && (
                        <textarea
                          id="cancel-reason"
                          maxLength={500}
                          required
                          placeholder="Tell us your reason for cancelling"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                        />
                      )}
                      <div className="receipt-actions">
                        <button
                          className="receipt-btn receipt-btn-danger"
                          disabled={
                            !cancelReasonOption ||
                            (cancelReasonOption === "other" &&
                              !cancelReason.trim())
                          }
                          onClick={handleCancelOrder}
                        >
                          Confirm cancellation
                        </button>
                        <button
                          className="receipt-btn receipt-btn-secondary"
                          onClick={() => {
                            setCancelFormOpen(false);
                            setCancelReasonOption("");
                            setCancelReason("");
                          }}
                        >
                          Keep order
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="receipt-btn receipt-btn-danger"
                      onClick={() => setCancelFormOpen(true)}
                    >
                      Cancel order
                    </button>
                  )}
                </section>
              )}
              {order.paymentMethod === "razorpay" &&
                order.paymentStatus !== "paid" &&
                order.status !== "Cancelled" && (
                  <button
                    className="receipt-btn receipt-btn-primary receipt-retry-button"
                    onClick={() =>
                      act(async () => {
                        const r = await retryPayment(order._id);
                        await openPayment(r, order._id);
                      })
                    }
                  >
                    Retry payment
                  </button>
                )}
              {order.status === "Delivered" &&
                order.returnRequest.status === "none" && (
                  <form
                    className="receipt-return-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      act(() => requestReturn(order._id, returnReason));
                    }}
                  >
                    <label htmlFor="return-reason">
                      Request a product return
                    </label>
                    <textarea
                      id="return-reason"
                      required
                      maxLength={1000}
                      placeholder="Tell us why you want to return this product"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                    />
                    <small>
                      Admin will review your reason and return request.
                    </small>
                    <button
                      className="receipt-btn receipt-btn-secondary"
                      disabled={!returnReason.trim()}
                    >
                      Request return
                    </button>
                  </form>
                )}
              <div className="receipt-status-track">
                <b>Order progress</b>
                {order.status === "Cancelled" ? (
                  <p className="receipt-progress-cancelled">
                    This order was cancelled.
                  </p>
                ) : (
                  <ol>
                    {[
                      "Pending",
                      "Confirmed",
                      "Shipped",
                      "Out for Delivery",
                      "Delivered",
                    ].map((status) => {
                      const currentIndex = [
                        "Pending",
                        "Confirmed",
                        "Shipped",
                        "Out for Delivery",
                        "Delivered",
                      ].indexOf(order.status);
                      const index = [
                        "Pending",
                        "Confirmed",
                        "Shipped",
                        "Out for Delivery",
                        "Delivered",
                      ].indexOf(status);
                      return (
                        <li
                          className={
                            index < currentIndex
                              ? "complete"
                              : index === currentIndex
                                ? "current"
                                : ""
                          }
                          key={status}
                        >
                          {status}
                        </li>
                      );
                    })}
                  </ol>
                )}
                <small>Order status refreshes automatically.</small>
              </div>
            </article>
          )
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                reload();
              }}
              style={{ marginBottom: 20 }}
            >
              <input
                placeholder="Search order number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button>Search</button>
            </form>
            {orders.map((o) => (
              <Link
                key={o._id}
                to={`/orders/${o._id}`}
                className="cart-summary"
                style={{
                  display: "block",
                  marginBottom: 12,
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <b>{o.orderNumber}</b>
                <span>
                  {" "}
                  · {new Date(o.createdAt).toLocaleDateString("en-IN")} ·{" "}
                  {o.status}
                </span>
                <strong style={{ float: "right" }}>{money(o.total)}</strong>
              </Link>
            ))}
            {!orders.length && <p>No orders yet.</p>}
          </>
        )}
      </main>
    </>
  );
}

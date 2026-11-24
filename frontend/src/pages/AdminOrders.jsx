import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAdminOrders, updateOrderStatus, reviewReturn } from "../api";
import { clearSession } from "../authSession";
import AdminNavigation from "../components/AdminNavigation";
import "./Admin.css";
import "./OrderCommerce.css";

const nextStatuses = {
  Pending: [
    "Confirmed",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ],
  Confirmed: [
    "Pending",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ],
  Shipped: ["Out for Delivery", "Delivered"],
  "Out for Delivery": ["Delivered"],
  Delivered: [],
  Cancelled: [],
};
const statuses = [
  "Pending",
  "Confirmed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];
const availableStatuses = (order) =>
  (order.status === "Cancelled" &&
  !["paid", "refunded"].includes(order.paymentStatus)
    ? ["Pending"]
    : nextStatuses[order.status] || []
  ).filter(
    (next) =>
      !(
        next === "Confirmed" &&
        order.paymentMethod === "razorpay" &&
        order.paymentStatus !== "paid"
      ) &&
      !(
        next === "Cancelled" &&
        order.paymentStatus === "paid" &&
        !["wallet", "razorpay"].includes(order.paymentMethod)
      ),
  );
export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("");
  const [error, setError] = useState("");
  const [confirmReturnOrder, setConfirmReturnOrder] = useState(null);
  const load = () =>
    getAdminOrders({
      page,
      limit: 10,
      search: appliedSearch,
      status,
      sort,
    }).then((data) => {
      setOrders(data.orders);
      setTotalPages(data.totalPages || 1);
    });
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [page, appliedSearch, status, sort]);
  const logout = () => {
    clearSession("admin");
    navigate("/admin", { replace: true });
  };
  const act = async (fn) => {
    try {
      setError("");
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      await load().catch(() => {});
    }
  };
  const validateReturn = (order) => setConfirmReturnOrder(order);
  return (
    <>
      <header className="site-header admin-header">
        <Link className="brand" to="/home">
          <span className="brand-icon">M</span>
          <b>MOBIX</b>
        </Link>
        <span className="admin-header-label">ADMIN PANEL</span>
        <nav className="admin-nav">
          <AdminNavigation active="orders" onLogout={logout} />
        </nav>
        <button className="header-logout" onClick={logout}>
          Log out
        </button>
      </header>
      <main className="admin-page">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">STORE OPERATIONS</span>
            <h1>Orders</h1>
            <p>Review customer orders and update fulfillment.</p>
          </div>
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="admin-toolbar">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setAppliedSearch(search.trim());
            }}
          >
            <input
              placeholder="Search order ID, customer, or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button>Search</button>
          </form>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amountHigh">Amount: high to low</option>
            <option value="amountLow">Amount: low to high</option>
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status and actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td>
                    <b>{o.orderNumber}</b>
                    <details>
                      <summary>Order details</summary>
                      {o.items.map((i, n) => (
                        <p key={n}>
                          {i.name} × {i.quantity} · ₹
                          {i.lineTotal.toLocaleString("en-IN")}
                        </p>
                      ))}
                      <p>
                        {o.address?.fullName}, {o.address?.line1},{" "}
                        {o.address?.city}, {o.address?.postalCode}
                      </p>
                      <p>
                        Payment: {o.paymentMethod} / {o.paymentStatus} / refund{" "}
                        {o.refundStatus}
                      </p>
                      <details>
                        <summary>Payment history</summary>
                        {o.paymentHistory.map((h, n) => (
                          <p key={n}>
                            {new Date(h.at).toLocaleString("en-IN")} · {h.event}
                            {h.reference ? ` · ${h.reference}` : ""}
                            {h.note ? ` · ${h.note}` : ""}
                          </p>
                        ))}
                      </details>
                    </details>
                  </td>
                  <td>
                    {o.customer?.name}
                    <br />
                    <small>{o.customer?.email}</small>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                  <td>₹{o.total.toLocaleString("en-IN")}</td>
                  <td>
                    <b>
                      {{
                        cod: "Cash on delivery",
                        razorpay: "Razorpay",
                        wallet: "MOBIX Wallet",
                      }[o.paymentMethod] || o.paymentMethod}
                    </b>
                    <br />
                    <small>{o.paymentStatus}</small>
                  </td>
                  <td>
                    <b>{o.status}</b>
                    <br />
                    <select
                      value=""
                      disabled={!availableStatuses(o).length}
                      aria-label={`Update status for order ${o.orderNumber}`}
                      onChange={(e) =>
                        e.target.value &&
                        act(() => updateOrderStatus(o._id, e.target.value))
                      }
                    >
                      <option value="">
                        {availableStatuses(o).length
                          ? "Change status…"
                          : "No further status"}
                      </option>
                      {statuses.map((s) => (
                        <option
                          key={s}
                          value={s}
                          disabled={!availableStatuses(o).includes(s)}
                        >
                          {s}
                          {s === o.status ? " · Current" : ""}
                        </option>
                      ))}
                    </select>
                    {o.returnRequest?.status === "requested" && (
                      <div className="admin-return-review">
                        <b>Customer return request</b>
                        <p>{o.returnRequest.reason}</p>
                        <small>
                          Requested{" "}
                          {o.returnRequest.requestedAt
                            ? new Date(
                                o.returnRequest.requestedAt,
                              ).toLocaleDateString("en-IN")
                            : ""}
                        </small>
                        <div>
                          <button
                            onClick={() =>
                              act(() => reviewReturn(o._id, "accepted"))
                            }
                          >
                            Accept
                          </button>{" "}
                          <button
                            onClick={() =>
                              act(() => reviewReturn(o._id, "rejected"))
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                    {o.returnRequest?.status === "accepted" && (
                      <p>
                        Return accepted
                        <br />
                        <button onClick={() => validateReturn(o)}>
                          Validate return & restock
                        </button>
                      </p>
                    )}
                    {o.returnRequest?.status === "completed" &&
                      o.refundStatus === "refunded" && (
                        <p>Refund credited to MOBIX wallet</p>
                      )}
                  </td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td colSpan="6">No orders match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </main>
      {confirmReturnOrder && (
        <div
          className="admin-confirm-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setConfirmReturnOrder(null);
          }}
        >
          <section
            className="admin-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="return-confirm-title"
            aria-describedby="return-confirm-description"
          >
            <span className="admin-confirm-icon is-unblock" aria-hidden="true">
              ✓
            </span>
            <h2 id="return-confirm-title">Validate returned order?</h2>
            <p id="return-confirm-description">
              Confirm that order <b>{confirmReturnOrder.orderNumber}</b> was
              received and restocked. ₹
              {confirmReturnOrder.total.toLocaleString("en-IN")} will be
              credited to the customer’s MOBIX wallet.
            </p>
            <div className="admin-confirm-actions">
              <button
                className="outline-btn"
                type="button"
                onClick={() => setConfirmReturnOrder(null)}
              >
                Go back
              </button>
              <button
                className="btn is-unblock"
                type="button"
                onClick={() => {
                  const order = confirmReturnOrder;
                  setConfirmReturnOrder(null);
                  act(() => reviewReturn(order._id, "completed"));
                }}
              >
                Confirm & restock
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

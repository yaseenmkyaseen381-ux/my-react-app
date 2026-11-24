import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAdminOrders,
  getAdminProducts,
  getAdminReports,
  getAdminUsers,
  getCategories,
} from "../api";
import { clearSession } from "../authSession";
import AdminNavigation from "../components/AdminNavigation";
import AdminProfileBadge from "../components/AdminProfileBadge";
import "./Admin.css";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const label = (value) =>
  String(value || "Other").replace(/\b\w/g, (letter) => letter.toUpperCase());

async function loadAllOrders() {
  const first = await getAdminOrders({ page: 1, limit: 50 });
  const remaining = await Promise.all(
    Array.from(
      { length: Math.max(0, (first.totalPages || 1) - 1) },
      (_, index) => getAdminOrders({ page: index + 2, limit: 50 }),
    ),
  );
  return [
    ...(first.orders || []),
    ...remaining.flatMap((page) => page.orders || []),
  ];
}

async function loadReportFromExistingApis() {
  const [orders, productSummary, userSummary, categorySummary] =
    await Promise.all([
      loadAllOrders(),
      getAdminProducts({ page: 1, limit: 1 }),
      getAdminUsers({ page: 1, limit: 1 }),
      getCategories(),
    ]);
  const activeOrders = orders.filter((order) => order.status !== "Cancelled");
  const totalSales = activeOrders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0,
  );
  const months = new Map();
  const statuses = new Map();
  const customers = new Map();
  const products = new Map();
  const payments = new Map();
  for (const order of orders) {
    statuses.set(
      order.status || "Other",
      (statuses.get(order.status || "Other") || 0) + 1,
    );
    const method = order.paymentMethod || "other";
    const payment = payments.get(method) || {
      _id: method,
      orders: 0,
      amount: 0,
      paidAmount: 0,
    };
    payment.orders += 1;
    payment.amount += Number(order.total || 0);
    if (order.paymentStatus === "paid")
      payment.paidAmount += Number(order.total || 0);
    payments.set(method, payment);
    if (order.status !== "Cancelled") {
      const date = new Date(order.createdAt);
      if (!Number.isNaN(date.getTime())) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const month = months.get(key) || { _id: key, amount: 0, orders: 0 };
        month.amount += Number(order.total || 0);
        month.orders += 1;
        months.set(key, month);
      }
      const email = order.customer?.email || "";
      if (email) {
        const customer = customers.get(email) || {
          _id: email,
          name: order.customer?.name || "Customer",
          orders: 0,
          amount: 0,
        };
        customer.orders += 1;
        customer.amount += Number(order.total || 0);
        customers.set(email, customer);
      }
      for (const item of order.items || []) {
        const id = item.productId || item.name || "product";
        const product = products.get(id) || {
          _id: id,
          name: item.name || id,
          quantity: 0,
          amount: 0,
        };
        product.quantity += Number(item.quantity || 0);
        product.amount += Number(item.lineTotal || 0);
        products.set(id, product);
      }
    }
  }
  return {
    users: userSummary.totalUsers || 0,
    products: productSummary.total || 0,
    categories: categorySummary.categories?.length || 0,
    totalOrders: orders.length,
    totalSales,
    averageOrderValue: activeOrders.length
      ? totalSales / activeOrders.length
      : 0,
    monthlySales: [...months.values()]
      .sort((a, b) => a._id.localeCompare(b._id))
      .slice(-6),
    orderStatuses: [...statuses.entries()]
      .map(([_id, count]) => ({ _id, orders: count }))
      .sort((a, b) => b.orders - a.orders),
    topCustomers: [...customers.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
    topProducts: [...products.values()]
      .sort((a, b) => b.quantity - a.quantity || b.amount - a.amount)
      .slice(0, 5),
    paymentMethods: [...payments.values()].sort((a, b) => b.orders - a.orders),
  };
}

export default function AdminReports() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const loadReport = () => {
    setError("");
    getAdminReports()
      .then(setReport)
      .catch(async () => {
        try {
          setReport(await loadReportFromExistingApis());
        } catch (e) {
          setError(e.message || "Could not load reports. Please try again.");
        }
      });
  };
  useEffect(() => {
    loadReport();
  }, []);
  const logout = () => {
    clearSession("admin");
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
          <AdminNavigation active="reports" onLogout={logout} />
        </nav>
      </header>
      <main className="admin-page">
        <p className="breadcrumb">
          <Link to="/home">Store</Link> / Admin / Reports
        </p>
        <div className="section-head admin-title">
          <div>
            <span className="eyebrow">STORE PERFORMANCE</span>
            <h1>Reports</h1>
            <p>Sales, orders, customers, products, and payments analytics.</p>
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}{" "}
            <button
              className="outline-btn admin-report-retry"
              type="button"
              onClick={loadReport}
            >
              Try again
            </button>
          </p>
        )}
        <section className="admin-dashboard-cards" aria-label="Report totals">
          <article>
            <span>Total Sales</span>
            <b>{report ? money(report.totalSales) : "—"}</b>
          </article>
          <article>
            <span>Average Order Value</span>
            <b>{report ? money(report.averageOrderValue) : "—"}</b>
          </article>
          <article>
            <span>Total Orders</span>
            <b>{report?.totalOrders ?? "—"}</b>
          </article>
          <article>
            <span>Customers</span>
            <b>{report?.users ?? "—"}</b>
          </article>
        </section>
        <div className="admin-report-tables">
          <section className="panel admin-users-panel">
            <h2>Sales analytics · Last 6 months</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Orders</th>
                    <th>Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.monthlySales?.length ? (
                    report.monthlySales.map((item) => (
                      <tr key={item._id}>
                        <td>{item._id}</td>
                        <td>{item.orders}</td>
                        <td>{money(item.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="admin-empty">
                        {report
                          ? "No sales in this period."
                          : "Loading reports…"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel admin-users-panel">
            <h2>Order analytics · By status</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.orderStatuses?.length ? (
                    report.orderStatuses.map((item) => (
                      <tr key={item._id}>
                        <td>{label(item._id)}</td>
                        <td>{item.orders}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2" className="admin-empty">
                        {report ? "No orders yet." : "Loading reports…"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel admin-users-panel">
            <h2>Customer analytics · Top customers</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Orders</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.topCustomers?.length ? (
                    report.topCustomers.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <b>{item.name || "Customer"}</b>
                          <br />
                          <small>{item._id}</small>
                        </td>
                        <td>{item.orders}</td>
                        <td>{money(item.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="admin-empty">
                        {report
                          ? "No customer orders yet."
                          : "Loading reports…"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel admin-users-panel">
            <h2>Product analytics · Best sellers</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units</th>
                    <th>Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.topProducts?.length ? (
                    report.topProducts.map((item) => (
                      <tr key={item._id}>
                        <td>{item.name || item._id || "Product"}</td>
                        <td>{item.quantity}</td>
                        <td>{money(item.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="admin-empty">
                        {report ? "No product sales yet." : "Loading reports…"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel admin-users-panel">
            <h2>Payment analytics · By method</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Payment method</th>
                    <th>Orders</th>
                    <th>Total</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.paymentMethods?.length ? (
                    report.paymentMethods.map((item) => (
                      <tr key={item._id}>
                        <td>{label(item._id)}</td>
                        <td>{item.orders}</td>
                        <td>{money(item.amount)}</td>
                        <td>{money(item.paidAmount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="admin-empty">
                        {report ? "No payments yet." : "Loading reports…"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

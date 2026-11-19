import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAdminReports } from "../api";
import { clearSession } from "../authSession";
import AdminNavigation from "../components/AdminNavigation";
import AdminProfileBadge from "../components/AdminProfileBadge";
import "./Admin.css";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

function SalesLineChart({ data }) {
  const width = 720; const height = 270; const left = 66; const right = 20; const top = 20; const bottom = 48;
  const max = Math.max(1, ...data.map((item) => Number(item.amount) || 0));
  const points = data.map((item, index) => ({
    ...item,
    x: left + (data.length <= 1 ? 0 : index * (width - left - right) / (data.length - 1)),
    y: top + (height - top - bottom) * (1 - (Number(item.amount) || 0) / max),
  }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${points.at(-1)?.x || left},${height - bottom} L${points[0]?.x || left},${height - bottom} Z`;
  return <div className="admin-chart-scroll"><svg className="admin-sales-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly sales line chart for the last six months">
    <defs><linearGradient id="sales-area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1557d8" stopOpacity=".2"/><stop offset="100%" stopColor="#1557d8" stopOpacity="0"/></linearGradient></defs>
    {[0, 1, 2, 3].map((tick) => { const y = top + tick * (height - top - bottom) / 3; const value = max * (1 - tick / 3); return <g key={tick}><line x1={left} x2={width - right} y1={y} y2={y} className="admin-chart-gridline"/><text x={left - 9} y={y + 4} textAnchor="end" className="admin-chart-axis-label">{money(value)}</text></g>; })}
    <path d={area} fill="url(#sales-area-fill)"/><path d={line} className="admin-sales-line"/>
    {points.map((point) => <g key={point.key}><circle cx={point.x} cy={point.y} r="4" className="admin-sales-point"><title>{point.label}: {money(point.amount)} · {point.orders} orders</title></circle><text x={point.x} y={height - 16} textAnchor="middle" className="admin-chart-axis-label">{point.label}</text></g>)}
  </svg></div>;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { getAdminReports().then(setReport).catch((e) => setError(e.message)); }, []);
  const monthlySales = useMemo(() => {
    const values = new Map((report?.monthlySales || []).map((item) => [item._id, item]));
    const start = new Date(); start.setDate(1); start.setHours(12, 0, 0, 0); start.setMonth(start.getMonth() - 5);
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(start); date.setMonth(start.getMonth() + index);
      const key = monthKey(date); const value = values.get(key) || {};
      return { key, amount: Number(value.amount) || 0, orders: Number(value.orders) || 0, label: date.toLocaleDateString("en-IN", { month: "short" }) };
    });
  }, [report]);
  const orderStatuses = report?.orderStatuses || [];
  const maxStatusOrders = Math.max(1, ...orderStatuses.map((item) => item.orders || 0));
  const topProducts = report?.topProducts || [];
  const logout = () => { clearSession("admin"); navigate("/admin", { replace: true }); };

  return <>
    <header className="site-header admin-header"><Link className="brand" to="/home"><span className="brand-icon">M</span><b>MOBIX</b></Link><span className="admin-header-label">ADMIN PANEL</span><AdminProfileBadge /><nav className="admin-nav"><AdminNavigation active="dashboard" onLogout={logout} /></nav></header>
    <main className="admin-page">
      <p className="breadcrumb"><Link to="/home">Store</Link> / Admin / Dashboard</p>
      <div className="section-head admin-title"><div><span className="eyebrow">STORE OVERVIEW</span><h1>Dashboard</h1><p>Here is a summary of your store.</p></div></div>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="admin-dashboard-cards" aria-label="Store summary">
        <article><span>Total Products</span><b>{report?.products ?? "—"}</b><Link to="/admin/products">View products →</Link></article>
        <article><span>Total Orders</span><b>{report?.totalOrders ?? "—"}</b><Link to="/admin/orders">View orders →</Link></article>
        <article><span>Customers</span><b>{report?.users ?? "—"}</b><Link to="/admin/users">View users →</Link></article>
        <article><span>Total Sales</span><b>{report ? money(report.totalSales) : "—"}</b><Link to="/admin/reports">View reports →</Link></article>
        <article><span>Average Order Value</span><b>{report ? money(report.averageOrderValue) : "—"}</b><Link to="/admin/reports">View reports →</Link></article>
        <article><span>Categories</span><b>{report?.categories ?? "—"}</b><Link to="/admin/categories">View categories →</Link></article>
      </section>
      <section className="admin-dashboard-visuals">
        <article className="panel admin-dashboard-panel admin-sales-panel"><div className="admin-dashboard-panel-head"><div><h2>Sales trend</h2><p>Monthly sales over the last six months</p></div><span className="admin-chart-legend"><i/> Sales</span></div>{report ? <SalesLineChart data={monthlySales}/> : <p className="admin-dashboard-loading">Loading sales chart…</p>}</article>
        <article className="panel admin-dashboard-panel"><div className="admin-dashboard-panel-head"><div><h2>Orders by status</h2><p>Current order distribution</p></div></div>{report && orderStatuses.length ? <div className="admin-status-bars">{orderStatuses.map((item) => <div className="admin-status-bar-row" key={item._id}><span>{item._id}</span><div><i style={{ width: `${Math.max(3, item.orders / maxStatusOrders * 100)}%` }}/></div><b>{item.orders}</b></div>)}</div> : <p className="admin-dashboard-loading">{report ? "No order data yet." : "Loading order data…"}</p>}</article>
      </section>
      <section className="panel admin-dashboard-panel admin-top-products"><div className="admin-dashboard-panel-head"><div><h2>Top-selling products</h2><p>Products ranked by units sold</p></div><Link to="/admin/reports">All reports →</Link></div>{topProducts.length ? <div className="table-wrap"><table className="admin-table"><thead><tr><th>#</th><th>Product</th><th>Units sold</th><th>Sales</th></tr></thead><tbody>{topProducts.map((product, index) => <tr key={product._id}><td>{index + 1}</td><td><b>{product.name}</b></td><td>{Number(product.quantity || 0).toLocaleString("en-IN")}</td><td>{money(product.amount)}</td></tr>)}</tbody></table></div> : <p className="admin-dashboard-loading">{report ? "No sales yet." : "Loading top products…"}</p>}</section>
    </main>
  </>;
}

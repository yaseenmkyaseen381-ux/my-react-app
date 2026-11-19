import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAdminProducts } from "../api";
import { clearSession } from "../authSession";
import AdminNavigation from "../components/AdminNavigation";
import AdminProfileBadge from "../components/AdminProfileBadge";
import "./Admin.css";

const LOW_STOCK_LIMIT = 5;

export default function AdminInventory() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const first = await getAdminProducts({ page: 1, limit: 50 });
      const rest = await Promise.all(Array.from({ length: Math.max(0, (first.totalPages || 1) - 1) }, (_, index) => getAdminProducts({ page: index + 2, limit: 50 })));
      setProducts([...(first.products || []), ...rest.flatMap((page) => page.products || [])]);
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) { clearSession("admin"); navigate("/admin", { replace: true }); }
      else setError(requestError.message || "Could not load inventory.");
    } finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => products.flatMap((product) => {
    const category = product.category?.name || product.categoryName || "—";
    const variants = product.variants || [];
    const items = variants.length ? variants.map((variant) => ({ key: `${product._id}-${variant._id || variant.name}`, product, category, variant, stock: Number(variant.stock) || 0 })) : [{ key: product._id, product, category, variant: null, stock: Number(product.stock) || 0 }];
    return items;
  }), [products]);

  const counts = useMemo(() => ({ total: rows.length, low: rows.filter((row) => row.stock > 0 && row.stock <= LOW_STOCK_LIMIT).length, out: rows.filter((row) => row.stock === 0).length, units: rows.reduce((sum, row) => sum + row.stock, 0) }), [rows]);
  const filteredRows = rows.filter((row) => {
    const matchesFilter = filter === "low" ? row.stock > 0 && row.stock <= LOW_STOCK_LIMIT : filter === "out" ? row.stock === 0 : true;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [row.product.name, row.category, row.variant?.name, row.variant?.sku].some((value) => String(value || "").toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  });
  const logout = () => { clearSession("admin"); navigate("/admin", { replace: true }); };

  return <>
    <header className="site-header admin-header"><Link className="brand" to="/home"><span className="brand-icon">M</span><b>MOBIX</b></Link><span className="admin-header-label">ADMIN PANEL</span><AdminProfileBadge /><nav className="admin-nav"><AdminNavigation active="inventory" onLogout={logout} /></nav></header>
    <main className="admin-page">
      <p className="breadcrumb"><Link to="/home">Store</Link> <span>/</span> Admin <span>/</span> Inventory</p>
      <div className="admin-heading"><div><span className="eyebrow">STOCK MANAGEMENT</span><h1>Inventory</h1><p>Check available stock for every product and variant.</p></div><button className="outline-btn" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh stock"}</button></div>
      {error && <div className="error" role="alert">{error}</div>}
      <section className="admin-inventory-summary" aria-label="Inventory summary">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><span>Stock items</span><b>{counts.total}</b><small>{counts.units.toLocaleString("en-IN")} total units</small></button>
        <button className={filter === "low" ? "active" : ""} onClick={() => setFilter("low")}><span>Low stock</span><b>{counts.low}</b><small>1–{LOW_STOCK_LIMIT} units left</small></button>
        <button className={filter === "out" ? "active" : ""} onClick={() => setFilter("out")}><span>Out of stock</span><b>{counts.out}</b><small>Needs replenishment</small></button>
      </section>
      <section className="panel admin-users-panel">
        <div className="admin-toolbar"><div><h2>{filter === "low" ? "Low stock items" : filter === "out" ? "Out-of-stock items" : "All inventory"}</h2><p>Low stock means {LOW_STOCK_LIMIT} or fewer units remaining.</p></div><input aria-label="Search inventory" placeholder="Search product, category, or variant" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Variant</th><th>SKU</th><th>Available</th><th>Status</th><th>Manage</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="7" className="admin-empty">Loading inventory…</td></tr> : filteredRows.length ? filteredRows.map((row) => <tr key={row.key}><td><b>{row.product.name}</b>{!row.product.published && <small className="admin-inventory-draft">Draft product</small>}</td><td>{row.category}</td><td>{row.variant?.name || "—"}</td><td>{row.variant?.sku || "—"}</td><td><b>{row.stock}</b></td><td><span className={`admin-inventory-status ${row.stock === 0 ? "out" : row.stock <= LOW_STOCK_LIMIT ? "low" : "in"}`}>{row.stock === 0 ? "Out of stock" : row.stock <= LOW_STOCK_LIMIT ? "Low stock" : "In stock"}</span></td><td><Link className="outline-btn admin-action" to="/admin/products">Manage products</Link></td></tr>) : <tr><td colSpan="7" className="admin-empty">No inventory items match this filter.</td></tr>}
        </tbody></table></div>
      </section>
    </main>
  </>;
}

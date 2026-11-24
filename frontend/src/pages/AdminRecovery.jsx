import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAdminCategories,
  getAdminProducts,
  restoreAdminCategory,
  restoreAdminProduct,
} from "../api";
import { clearSession } from "../authSession";
import AdminNavigation from "../components/AdminNavigation";
import "./Admin.css";

export default function AdminRecovery() {
  const navigate = useNavigate();
  const [kind, setKind] = useState("products");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { deleted: true, page, limit: 10 };
      const result =
        kind === "products"
          ? await getAdminProducts(params)
          : await getAdminCategories(params);
      setItems(
        kind === "products" ? result.products || [] : result.categories || [],
      );
      setPages(Math.max(1, result.totalPages || 1));
    } catch (e) {
      if (e.status === 401 || e.status === 403)
        navigate("/admin", { replace: true });
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [kind, page, navigate]);
  useEffect(() => {
    load();
  }, [load]);

  const restore = async (item) => {
    setBusyId(String(item._id));
    setError("");
    try {
      if (kind === "products") await restoreAdminProduct(item._id);
      else await restoreAdminCategory(item._id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  };
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
        <nav className="admin-nav">
          <AdminNavigation active="recovery" onLogout={logout} />
        </nav>
        <button className="header-logout" onClick={logout}>
          Log out
        </button>
      </header>
      <main className="admin-page">
        <p className="breadcrumb">
          <Link to="/home">Store</Link> <span>/</span> Admin <span>/</span>{" "}
          Deleted items
        </p>
        <div className="section-head admin-title">
          <div>
            <span className="eyebrow">RECOVERY</span>
            <h1>Deleted items</h1>
            <p>
              Restore soft-deleted products and categories. Restored products
              return as unpublished drafts.
            </p>
          </div>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <section className="panel admin-users-panel">
          <div className="admin-toolbar">
            <div>
              <h2>
                {kind === "products"
                  ? "Deleted products"
                  : "Deleted categories"}
              </h2>
            </div>
            <div className="admin-search-row">
              <button
                className={
                  kind === "products"
                    ? "btn admin-search-button"
                    : "outline-btn"
                }
                onClick={() => {
                  setKind("products");
                  setPage(1);
                }}
              >
                Products
              </button>
              <button
                className={
                  kind === "categories"
                    ? "btn admin-search-button"
                    : "outline-btn"
                }
                onClick={() => {
                  setKind("categories");
                  setPage(1);
                }}
              >
                Categories
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {kind === "products" ? (
                    <>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Deleted</th>
                    </>
                  ) : (
                    <>
                      <th>Category</th>
                      <th>Category ID</th>
                      <th>Deleted</th>
                    </>
                  )}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="admin-empty">
                      Loading deleted items…
                    </td>
                  </tr>
                ) : items.length ? (
                  items.map((item) => (
                    <tr key={item._id}>
                      {kind === "products" ? (
                        <>
                          <td>
                            <b>{item.name}</b>
                            <br />
                            <small>{item._id}</small>
                          </td>
                          <td>
                            {item.category?.name || item.categoryName || "—"}
                          </td>
                          <td>
                            {item.deletedAt
                              ? new Date(item.deletedAt).toLocaleDateString(
                                  "en-IN",
                                )
                              : "—"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <b>{item.name}</b>
                          </td>
                          <td>{item._id}</td>
                          <td>
                            {item.deletedAt
                              ? new Date(item.deletedAt).toLocaleDateString(
                                  "en-IN",
                                )
                              : "—"}
                          </td>
                        </>
                      )}
                      <td>
                        <button
                          className="outline-btn admin-action unblock-action"
                          disabled={busyId === String(item._id)}
                          onClick={() => restore(item)}
                        >
                          {busyId === String(item._id)
                            ? "Restoring…"
                            : "Restore"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="admin-empty">
                      No deleted {kind} found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>
              Page {page} of {pages}
            </span>
            <div>
              <button
                className="outline-btn"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <button
                className="outline-btn"
                disabled={page >= pages || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

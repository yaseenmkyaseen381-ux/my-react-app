import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAdminCategory, deleteAdminCategory, getAdminCategories, getCategories, updateAdminCategory } from "../api";
import { clearSession } from "../authSession";
import AdminNavigation from "../components/AdminNavigation";
import "./Admin.css";

export default function AdminCategories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [parentOptions, setParentOptions] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [result, categoryResult] = await Promise.all([getAdminCategories({ search: appliedSearch, page, limit: 10 }), getCategories()]);
      setCategories(result.categories); setPages(Math.max(1, result.totalPages));
      setAllCategories(categoryResult.categories || []);
      setParentOptions((categoryResult.categories || []).filter((item) => !item.parentId));
    }
    catch (e) { if (e.status === 401 || e.status === 403) navigate("/admin", { replace: true }); else setError(e.message); }
    finally { setLoading(false); }
  }, [appliedSearch, page, navigate]);
  useEffect(() => { load(); }, [load]);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { const result = editingId ? await updateAdminCategory(editingId, { name, parentId }) : await createAdminCategory({ name, parentId }); setMessage(result.message); setName(""); setParentId(""); setEditingId(""); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const edit = (item) => { setEditingId(item._id || item.id); setName(item.name); setParentId(item.parent?._id || item.parentId || ""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = async (item) => { setError(""); setMessage(""); try { await deleteAdminCategory(item._id); await load(); } catch (e) { setError(e.message); } };
  const logout = () => { clearSession("admin"); navigate("/admin", { replace: true }); };
  return <>
    <header className="site-header admin-header"><Link className="brand" to="/home"><span className="brand-icon">M</span><b>MOBIX</b></Link><span className="admin-header-label">ADMIN PANEL</span><nav className="admin-nav"><AdminNavigation active="categories" onLogout={logout} /></nav><button className="header-logout" onClick={logout}>Log out</button></header>
    <main className="admin-page"><p className="breadcrumb"><Link to="/home">Store</Link> <span>/</span> Admin <span>/</span> Categories</p><div className="section-head admin-title"><div><span className="eyebrow">CATALOGUE</span><h1>Category management</h1><p>Add, update, and remove product categories.</p></div></div>
      {error && <div className="error" role="alert">{error}</div>}{message && <div className="success" role="status">{message}</div>}
      <section className="panel admin-product-form"><div className="admin-toolbar"><div><h2>{editingId ? "Edit category" : "Add a category"}</h2><p>Choose a parent to make this a subcategory.</p></div>{editingId && <button type="button" className="outline-btn" onClick={() => { setEditingId(""); setName(""); setParentId(""); }}>Cancel</button>}</div><form className="admin-search-row" onSubmit={submit}><input aria-label="Category name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name"/><select aria-label="Parent category" value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">Top-level category</option>{parentOptions.filter((item) => item.id !== editingId).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="btn admin-search-button" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Add category"}</button></form></section>
      {(() => { const audio = allCategories.find((item) => item.id === "audio" || item.name.toLowerCase() === "audio"); const children = allCategories.filter((item) => item.parentId === audio?.id); return audio && <section className="panel admin-users-panel admin-subcategory-panel"><div className="admin-toolbar"><div><h2>Audio subcategories</h2><p>Subcategories currently assigned to Audio.</p></div></div><div className="admin-subcategory-list">{children.length ? children.map((item) => <div className="admin-subcategory-item" key={item.id}><span>↳ <b>{item.name}</b></span><button className="outline-btn admin-action" type="button" onClick={() => edit(item)}>Edit</button></div>) : <p className="admin-empty">No Audio subcategories yet.</p>}</div></section>; })()}
      <section className="panel admin-users-panel"><form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); setPage(1); setAppliedSearch(search.trim()); }}><div><h2>Categories</h2><p>Newest categories appear first.</p></div><div className="admin-search-row"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories" aria-label="Search categories"/><button className="btn admin-search-button">Search</button><button type="button" className="outline-btn" onClick={() => { setSearch(""); setAppliedSearch(""); setPage(1); }}>Clear</button></div></form><div className="table-wrap"><table><thead><tr><th>Name</th><th>Parent</th><th>Category ID</th><th>Created</th><th>Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan="5" className="admin-empty">Loading categories…</td></tr> : categories.length ? categories.map((item) => <tr key={item._id}><td><b>{item.parent ? `↳ ${item.name}` : item.name}</b></td><td>{item.parent?.name || "—"}</td><td>{item._id}</td><td>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.createdAt))}</td><td><div className="admin-product-actions"><button className="outline-btn admin-action" onClick={() => edit(item)}>Edit</button><button className="outline-btn admin-action block-action" onClick={() => remove(item)}>Remove</button></div></td></tr>) : <tr><td colSpan="5" className="admin-empty">No categories found.</td></tr>}</tbody></table></div><div className="admin-pagination"><span>Page {page} of {pages}</span><div><button className="outline-btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</button><button className="outline-btn" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next</button></div></div></section>
    </main>
  </>;
}



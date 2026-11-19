import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createAdminProduct, deleteAdminProduct, getAdminProducts, getCategories, updateAdminProduct } from "../api";
import { clearSession } from "../authSession";
import AdminNavigation from "../components/AdminNavigation";
import AdminProfileBadge from "../components/AdminProfileBadge";
import "./Admin.css";

const blank = { id: "", name: "", description: "", subtitle: "", tag: "", category: "", price: "", oldPrice: "", stock: "", images: [], variantsText: "", published: false };
const ADMIN_PRODUCT_PAGE_SIZE = 50;

async function prepareImage(file, crop = "center") {
  const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  const image = await new Promise((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = source; });
  const size = 1200;
  const scale = Math.max(size / image.width, size / image.height);
  const width = Math.ceil(image.width * scale); const height = Math.ceil(image.height * scale);
  const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
  const context = canvas.getContext("2d");
  const [horizontal, vertical] = ({ center: [0.5, 0.5], top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5], "top-left": [0, 0], "top-right": [1, 0], "bottom-left": [0, 1], "bottom-right": [1, 1] })[crop];
  context.drawImage(image, (size - width) * horizontal, (size - height) * vertical, width, height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export default function AdminProducts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(false);
  const [hadVariantsOnEdit, setHadVariantsOnEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [publishingId, setPublishingId] = useState("");
  const [productToRemove, setProductToRemove] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [crop, setCrop] = useState("center");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [productResult, categoryResult] = await Promise.all([getAdminProducts({ search: appliedSearch, category: categoryFilter, status: statusFilter, page, limit: ADMIN_PRODUCT_PAGE_SIZE }), getCategories()]);
      setProducts(productResult.products || []); setCategories(categoryResult.categories || []); setTotalPages(Math.max(1, productResult.totalPages || 1)); setTotalProducts(productResult.total || 0);
    } catch (err) {
      if (err.status === 401 || err.status === 403) { clearSession("admin"); navigate("/admin", { replace: true }); }
      else setError(err.message);
    } finally { setLoading(false); }
  }, [navigate, appliedSearch, categoryFilter, statusFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("add") !== "1") return;
    setForm(blank); setEditing(false); setHadVariantsOnEdit(false); setError(""); setFormOpen(true);
    navigate("/admin/products", { replace: true });
  }, [location.search, navigate]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const startEdit = (product) => {
    setForm({ id: product._id, name: product.name, description: product.description, subtitle: product.subtitle || "", tag: product.tag || "", category: product.category?._id || product.category, price: product.price, oldPrice: product.oldPrice, stock: product.stock, images: product.images || [], variantsText: (product.variants || []).map((v) => `${v.name}|${v.stock}|${v.price ?? ""}|${v.sku || ""}`).join("\n"), published: product.published });
    setHadVariantsOnEdit(Boolean(product.variants?.length));
    setEditing(true); setFormOpen(true); setMessage(""); setError("");
  };
  const reset = () => { setForm(blank); setEditing(false); setFormOpen(false); setHadVariantsOnEdit(false); setError(""); };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const { id, variantsText, ...values } = form;
    const variants = variantsText.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [name, stock, price, sku] = line.split("|").map((part) => part.trim()); return { name, stock: Number(stock), ...(price ? { price: Number(price) } : {}), sku: sku || "" }; });
    const invalidVariantLine = variantsText.split("\n").map((line) => line.trim()).filter(Boolean).some((line) => {
      const [name, stock, price] = line.split("|").map((part) => part.trim());
      return !name || stock === undefined || stock === "" || !Number.isInteger(Number(stock)) || Number(stock) < 0 || (price !== undefined && price !== "" && (!Number.isFinite(Number(price)) || Number(price) < 0));
    });
    if (invalidVariantLine) { setBusy(false); setError("For each variant, enter a name and whole-number stock: Name | Stock | optional price | optional SKU."); return; }
    const payload = { ...values, price: Number(values.price), oldPrice: Number(values.oldPrice), stock: Number(values.stock), ...(!editing || variants.length > 0 || hadVariantsOnEdit ? { variants } : {}) };
    try {
      const result = editing ? await updateAdminProduct(id, payload) : await createAdminProduct({ id: id.trim(), ...payload });
      setMessage(result.message); reset(); await load();
    } catch (err) { if (err.status === 401 || err.status === 403) navigate("/admin", { replace: true }); else setError(err.message); }
    finally { setBusy(false); }
  };
  const remove = (product) => setProductToRemove(product);
  const visibleProducts = products.filter((product) => {
    const productCategory = String(product.category?._id || product.category || "");
    const categoryMatches = !categoryFilter || productCategory === categoryFilter || (categoryFilter === "audio" && categories.some((item) => item.parentId === categoryFilter && item.id === productCategory));
    const statusMatches = !statusFilter || (statusFilter === "published" ? product.published : !product.published);
    return categoryMatches && statusMatches;
  });
  const clientFilterMismatch = products.some((product) => {
    const productCategory = String(product.category?._id || product.category || "");
    return (categoryFilter && productCategory !== categoryFilter && !(categoryFilter === "audio" && categories.some((item) => item.parentId === categoryFilter && item.id === productCategory))) || (statusFilter && (statusFilter === "published" ? !product.published : product.published));
  });
  const visibleTotal = clientFilterMismatch ? visibleProducts.length : totalProducts;
  const visibleTotalPages = clientFilterMismatch ? 1 : totalPages;
  const confirmRemove = async () => {
    if (!productToRemove) return;
    const product = productToRemove;
    setRemoving(true);
    setError(""); setMessage("");
    try { const result = await deleteAdminProduct(product._id); setMessage(result.message); setProductToRemove(null); await load(); }
    catch (err) { setError(err.message); setProductToRemove(null); }
    finally { setRemoving(false); }
  };
  const publishProduct = async (product) => {
    setPublishingId(product._id); setError(""); setMessage("");
    try { const result = await updateAdminProduct(product._id, { published: true }); setMessage(result.message || "Product published."); await load(); }
    catch (err) { if (err.status === 401 || err.status === 403) navigate("/admin", { replace: true }); else setError(err.message); }
    finally { setPublishingId(""); }
  };
  const logout = () => { clearSession("admin"); navigate("/admin", { replace: true }); };

  return <>
    <header className="site-header admin-header"><Link className="brand" to="/home"><span className="brand-icon">M</span><b>MOBIX</b></Link><span className="admin-header-label">ADMIN PANEL</span><form className="admin-topbar-search" onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedSearch(search.trim()); }}><span aria-hidden="true">⌕</span><input aria-label="Search products" placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} /></form><AdminProfileBadge /><nav className="admin-nav"><AdminNavigation active="products" onLogout={logout} /></nav><button className="header-logout" onClick={logout}>Log out</button></header>
    <main className="admin-page"><p className="breadcrumb"><Link to="/home">Store</Link> <span>/</span> Admin <span>/</span> Products</p>
      <div className="section-head admin-title"><div><span className="eyebrow">CATALOGUE</span><h1>All Products</h1><p>Manage your products here.</p></div><button className="btn admin-add-product" type="button" onClick={() => { setForm(blank); setEditing(false); setHadVariantsOnEdit(false); setError(""); setFormOpen(true); }}>＋ Add Product</button></div>
      {error && !formOpen && <div className="error" role="alert">{error}</div>}{message && <div className="success" role="status">{message}</div>}
      {formOpen && <div className="admin-form-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) reset(); }}><section className="panel admin-product-form admin-product-form--modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title"><div className="admin-toolbar"><div><h2 id="product-form-title">{editing ? "Edit Product" : "Add Product"}</h2><p>Required fields are marked in the form.</p></div><button className="admin-modal-close" type="button" onClick={reset} aria-label="Close product form">×</button></div>
        {error && <div className="error admin-modal-error" role="alert">{error}</div>}
        <form onSubmit={submit} className="product-admin-grid">
          {!editing && <label>Product ID<input required maxLength="80" value={form.id} onChange={(e) => update("id", e.target.value)} placeholder="e.g. phone-model-x" /></label>}
          <label>Product name<input required maxLength="140" value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
          <label>Category<select required value={form.category} onChange={(e) => update("category", e.target.value)}><option value="">Choose category</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.parentName ? `${item.parentName} / ${item.name}` : item.name}</option>)}</select></label>
          <label>Price<input type="number" min="0" step="0.01" required value={form.price} onChange={(e) => update("price", e.target.value)} /></label>
          <label>Original price<input type="number" min="0" step="0.01" required value={form.oldPrice} onChange={(e) => update("oldPrice", e.target.value)} /></label>
          <label>Stock<input type="number" min="0" step="1" required value={form.stock} onChange={(e) => update("stock", e.target.value)} /></label>
          <label className="wide">Product variants (optional)<textarea rows="4" value={form.variantsText} onChange={(e) => update("variantsText", e.target.value)} placeholder={'One variant per line: Name | Stock | Price (optional) | SKU (optional)\nBlack / 128 GB | 8 | 49999 | MB-BLK-128'} /><small>When variants are set, inventory is tracked per variant and total stock is calculated automatically. Leave blank for a product without variants.</small></label>
          <label>Tag<input maxLength="40" value={form.tag} onChange={(e) => update("tag", e.target.value)} placeholder="New, Popular…" /></label>
          <label className="wide">Short description<input maxLength="200" value={form.subtitle} onChange={(e) => update("subtitle", e.target.value)} /></label>
          <label className="wide">Description<textarea required maxLength="5000" rows="3" value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
          <label className="wide">Product images (optional)<div className="admin-crop-controls"><span>Crop alignment</span><select aria-label="Image crop alignment" value={crop} onChange={(e) => setCrop(e.target.value)}><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select></div><input type="file" accept="image/*" multiple disabled={form.images.length >= 3} onChange={async (e) => { const files = [...e.target.files].slice(0, 3 - form.images.length); if (!files.length) return; try { const prepared = await Promise.all(files.map((file) => prepareImage(file, crop))); update("images", [...form.images, ...prepared]); } catch { setError("Could not process one of those images."); } e.target.value = ""; }} /><small>Images are optional. Upload up to 3 images; you can save the product without any images.</small><div className="admin-image-previews">{form.images.map((image, index) => <div key={`${index}-${image.slice(0, 32)}`}><img src={image} alt={`Product preview ${index + 1}`} /><button type="button" className="outline-btn" aria-label={`Remove image ${index + 1}`} onClick={() => update("images", form.images.filter((_, imageIndex) => imageIndex !== index))}>Remove</button></div>)}</div><small>{form.images.length}/3 images added</small></label>
          <label className="admin-checkbox"><input type="checkbox" checked={form.published} onChange={(e) => update("published", e.target.checked)} /> Publish in the store</label><small className="wide">User pages show products only when “Publish in the store” is checked and stock is above 0.</small>
          <div className="wide"><button className="btn admin-search-button" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create product"}</button></div>
        </form>
      </section></div>}
      <section className="panel admin-users-panel"><div className="admin-product-list-toolbar"><form onSubmit={(e) => { e.preventDefault(); setPage(1); setAppliedSearch(search.trim()); }}><input aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="⌕  Search by name…"/><button className="btn admin-search-button">Search</button></form><select aria-label="Filter by category" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}><option value="">All Categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.parentName ? `${item.parentName} / ${item.name}` : item.name}</option>)}</select><select aria-label="Filter by status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}><option value="">All Status</option><option value="published">Published</option><option value="draft">Draft</option></select><button className="outline-btn admin-filter-clear" type="button" onClick={() => { setSearch(""); setAppliedSearch(""); setCategoryFilter(""); setStatusFilter(""); setPage(1); }}>Clear</button></div><div className="table-wrap"><table><thead><tr><th>#</th><th>Image</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="8" className="admin-empty">Loading products…</td></tr> : visibleProducts.length === 0 ? <tr><td colSpan="8" className="admin-empty">No products match these filters.</td></tr> : visibleProducts.map((product, index) => <tr key={product._id}><td>{(page - 1) * ADMIN_PRODUCT_PAGE_SIZE + index + 1}</td><td>{product.images?.[0] ? <img className="admin-product-thumb" src={product.images[0]} alt={product.name} /> : <span className="admin-product-thumb admin-no-image">▣</span>}</td><td><b>{product.name}</b><br/><small>{product._id}</small></td><td>{product.category?.name || product.categoryName || "—"}</td><td>₹{Number(product.price).toLocaleString("en-IN")}</td><td>{product.stock}</td><td><span className={`admin-status ${product.published ? "is-active" : "is-blocked"}`}>{product.published ? "Published" : "Draft"}</span></td><td><div className="admin-product-actions">{!product.published && <button className="outline-btn admin-action" disabled={publishingId === product._id || product.stock <= 0} title={product.stock <= 0 ? "Add stock before publishing" : "Show this product in the store"} onClick={() => publishProduct(product)}>{publishingId === product._id ? "Publishing…" : product.stock <= 0 ? "Out of stock" : "Publish"}</button>}<button className="outline-btn admin-action" onClick={() => startEdit(product)}>Edit</button><button className="outline-btn admin-action block-action" onClick={() => remove(product)}>Remove</button></div></td></tr>)}</tbody></table></div><div className="admin-product-list-footer"><span>Showing {(page - 1) * ADMIN_PRODUCT_PAGE_SIZE + (visibleProducts.length ? 1 : 0)}–{(page - 1) * ADMIN_PRODUCT_PAGE_SIZE + visibleProducts.length} of {visibleTotal} products</span><div className="admin-pagination"><button className="outline-btn" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>‹</button><b>{page}</b><button className="outline-btn" disabled={page >= visibleTotalPages || loading} onClick={() => setPage((p) => p + 1)}>›</button></div></div></section>
    </main>
    {productToRemove && <div className="admin-confirm-backdrop" onMouseDown={(event) => { if (!removing && event.target === event.currentTarget) setProductToRemove(null); }} onKeyDown={(event) => { if (!removing && event.key === "Escape") setProductToRemove(null); }}>
      <section className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-product-title" aria-describedby="remove-product-description">
        <span className="admin-confirm-icon" aria-hidden="true">!</span>
        <h2 id="remove-product-title">Remove this product?</h2>
        <p id="remove-product-description">Remove <b>{productToRemove.name}</b> from the store catalogue? You can restore it later from Deleted items.</p>
        <div className="admin-confirm-actions">
          <button className="outline-btn" type="button" disabled={removing} onClick={() => setProductToRemove(null)}>Cancel</button>
          <button className="btn is-block" type="button" disabled={removing} onClick={confirmRemove}>{removing ? "Removing…" : "Remove product"}</button>
        </div>
      </section>
    </div>}
  </>;
}



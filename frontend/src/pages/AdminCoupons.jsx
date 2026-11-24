import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAdminCoupon, deleteAdminCoupon, getAdminCoupons, updateAdminCoupon } from "../api";
import { clearSession } from "../authSession";
import AdminNavigation from "../components/AdminNavigation";
import "./Admin.css";

const blank = { code: "", discountType: "percentage", discountValue: "", minSubtotal: "0", maxDiscount: "0", usageLimit: "0", expiresAt: "", active: true };
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function AdminCoupons() {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setCoupons((await getAdminCoupons()).coupons || []); }
    catch (e) { if ([401, 403].includes(e.status)) navigate("/admin", { replace: true }); else setError(e.message); }
  }, [navigate]);
  useEffect(() => { load(); }, [load]);
  const reset = () => { setForm(blank); setEditing(""); };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const payload = { ...form, discountValue: Number(form.discountValue), minSubtotal: Number(form.minSubtotal), maxDiscount: Number(form.maxDiscount), usageLimit: Number(form.usageLimit), expiresAt: form.expiresAt || null };
    try {
      const result = editing ? await updateAdminCoupon(editing, payload) : await createAdminCoupon(payload);
      setMessage(result.message); reset(); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const edit = (coupon) => { setEditing(coupon._id); setForm({ code: coupon.code, discountType: coupon.discountType, discountValue: String(coupon.discountValue), minSubtotal: String(coupon.minSubtotal), maxDiscount: String(coupon.maxDiscount), usageLimit: String(coupon.usageLimit), expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 10) : "", active: coupon.active }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = async (coupon) => { if (!window.confirm(`Delete coupon ${coupon.code}?`)) return; try { await deleteAdminCoupon(coupon._id); setMessage("Coupon deleted."); await load(); } catch (e) { setError(e.message); } };
  const logout = () => { clearSession("admin"); navigate("/admin", { replace: true }); };
  return <>
    <header className="site-header admin-header"><Link className="brand" to="/home"><span className="brand-icon">M</span><b>MOBIX</b></Link><span className="admin-header-label">ADMIN PANEL</span><nav className="admin-nav"><AdminNavigation active="coupons" onLogout={logout} /></nav><button className="header-logout" onClick={logout}>Log out</button></header>
    <main className="admin-page"><p className="breadcrumb"><Link to="/home">Store</Link> <span>/</span> Admin <span>/</span> Coupons</p>
      <div className="section-head admin-title"><div><span className="eyebrow">PROMOTIONS</span><h1>Coupon management</h1><p>Create discount codes customers can apply at checkout.</p></div></div>
      {error && <div className="error" role="alert">{error}</div>}{message && <div className="success" role="status">{message}</div>}
      <section className="panel admin-product-form"><div className="admin-toolbar"><div><h2>{editing ? "Edit coupon" : "Create a coupon"}</h2><p>Set a percentage or fixed discount and optional limits.</p></div>{editing && <button className="outline-btn" type="button" onClick={reset}>Cancel</button>}</div>
        <form className="admin-search-row" onSubmit={submit}>
          <input required maxLength={30} aria-label="Coupon code" placeholder="Coupon code (e.g. MOBIX10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <select aria-label="Discount type" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select>
          <input required type="number" min="0.01" max={form.discountType === "percentage" ? 100 : undefined} step="0.01" aria-label="Discount value" placeholder={form.discountType === "percentage" ? "Discount %" : "Discount ₹"} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
          <input type="number" min="0" step="1" aria-label="Minimum subtotal" placeholder="Minimum subtotal ₹" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
          <input type="number" min="0" step="1" aria-label="Maximum discount" placeholder="Max discount ₹ (0 = none)" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
          <input type="number" min="0" step="1" aria-label="Usage limit" placeholder="Usage limit (0 = unlimited)" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
          <label>Expires on <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
          <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          <button disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create coupon"}</button>
        </form>
      </section>
      <section className="panel admin-product-form"><h2>Coupons</h2><div className="table-wrap"><table><thead><tr><th>Code</th><th>Discount</th><th>Minimum</th><th>Uses</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon._id}><td><b>{coupon.code}</b></td><td>{coupon.discountType === "percentage" ? `${coupon.discountValue}%${coupon.maxDiscount ? ` · max ${money(coupon.maxDiscount)}` : ""}` : money(coupon.discountValue)}</td><td>{money(coupon.minSubtotal)}</td><td>{coupon.usageCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : " / ∞"}</td><td>{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : "No expiry"}</td><td>{coupon.active ? "Active" : "Inactive"}</td><td><button type="button" className="outline-btn" onClick={() => edit(coupon)}>Edit</button> <button type="button" className="outline-btn" onClick={() => remove(coupon)}>Delete</button></td></tr>)}</tbody></table>{!coupons.length && <p>No coupons created yet.</p>}</div></section>
    </main>
  </>;
}

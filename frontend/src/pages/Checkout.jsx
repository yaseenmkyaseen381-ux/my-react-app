import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; 
import SiteHeader from "../components/SiteHeader";
import { readCart, saveCartLocally } from "../cart";
import { getAddresses, createOrder, verifyPayment, recordPaymentFailure, getWallet } from "../api";
import { addAddress } from "../api";
import "./Catalog.css";
import "./OrderCommerce.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const fields = ["fullName", "phone", "line1", "line2", "city", "state", "postalCode", "country"];
function loadRazorpay() { return new Promise((resolve) => { if (window.Razorpay) return resolve(true); const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => resolve(true); s.onerror = () => resolve(false); document.body.appendChild(s); }); }

export default function Checkout() {
  const navigate = useNavigate(); const location = useLocation();
  const buyNowItem = location.state?.buyNowItem;
  const cart = useMemo(() => buyNowItem ? [buyNowItem] : readCart(), [buyNowItem]);
  const [addresses, setAddresses] = useState([]); const [addressId, setAddressId] = useState(""); const [method, setMethod] = useState("cod"); const [form, setForm] = useState({ fullName: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "India" });
  const [adding, setAdding] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [confirmationOrder, setConfirmationOrder] = useState(null);
  const [walletBalancePaise, setWalletBalancePaise] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const subtotal = cart.reduce((sum, i) => sum + Number(i.price || 0) * i.quantity, 0); const shipping = subtotal >= 5000 ? 0 : 99;
  const walletCanPay = walletBalancePaise >= Math.round((subtotal + shipping) * 100);
  useEffect(() => {
    getAddresses().then((rows) => { setAddresses(rows); setAddressId(rows.find((a) => a.isDefault)?._id || rows[0]?._id || ""); }).catch((e) => setError(e.message));
    getWallet().then(({ balancePaise }) => setWalletBalancePaise(balancePaise || 0)).catch(() => {}).finally(() => setWalletLoading(false));
  }, []);
  const addNew = async (e) => { e.preventDefault(); setBusy(true); setError(""); try { const rows = await addAddress(form); const newAddressId = rows.at(-1)?._id || ""; setAddresses(rows); setAddressId(newAddressId); setAdding(false); setForm({ fullName: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "India" }); } catch (e2) { setError(e2.message); } finally { setBusy(false); } };
  const placeOrder = async (selectedAddressId = addressId) => {
    if (!selectedAddressId) { setError("Choose or add a delivery address to continue."); return; }
    setBusy(true); setError(""); let order;
    try {
      const signature = JSON.stringify({ items: cart.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })).sort((a,b) => `${a.productId}:${a.variantId}`.localeCompare(`${b.productId}:${b.variantId}`)), addressId: selectedAddressId, method });
      let checkoutKey = sessionStorage.getItem("mobix-checkout-key");
      if (!checkoutKey || sessionStorage.getItem("mobix-checkout-signature") !== signature) { checkoutKey = crypto.randomUUID(); sessionStorage.setItem("mobix-checkout-key", checkoutKey); sessionStorage.setItem("mobix-checkout-signature", signature); }
      const result = await createOrder({ items: cart.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })), addressId: selectedAddressId, paymentMethod: method, idempotencyKey: checkoutKey });
      order = result.order;
      if (method === "razorpay") {
        const ready = await loadRazorpay(); if (!ready) throw Error("Could not load Razorpay checkout. You can retry payment from your order page.");
        await new Promise((resolve, reject) => {
          const checkout = new window.Razorpay({ key: result.razorpay.keyId, order_id: result.razorpay.orderId, amount: result.razorpay.amount, currency: result.razorpay.currency, name: "MOBIX", description: `Order ${order.orderNumber}`, handler: async (response) => { try { await verifyPayment(order._id, response); resolve(); } catch (err) { reject(err); } }, modal: { ondismiss: async () => { await recordPaymentFailure(order._id,{paymentOrderId:result.razorpay.orderId,reason:"Checkout closed before payment."}).catch(()=>{}); reject(new Error("Payment was not completed. You can retry from your order page.")); } } });
          checkout.on("payment.failed", (response) => { recordPaymentFailure(order._id,{paymentOrderId:result.razorpay.orderId,paymentId:response.error?.metadata?.payment_id,reason:response.error?.description}).catch(()=>{}); reject(new Error(response.error?.description || "Payment failed. You can retry from your order page.")); }); checkout.open();
        });
      }
      if (!buyNowItem) saveCartLocally([]);
      sessionStorage.removeItem("mobix-checkout-key"); sessionStorage.removeItem("mobix-checkout-signature"); setConfirmationOrder(order);
    } catch (e) { order ||= e.details?.order; setError(e.message); if (order && method === "razorpay") navigate(`/payment/failure?orderId=${order._id}`); else if (order) navigate(`/orders/${order._id}`); }
    finally { setBusy(false); }
  };
  const continueToReview = () => {
    if (!addressId) { setError("Choose or add a delivery address to continue."); return; }
    setError(""); setStep(2); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (!cart.length) return <><SiteHeader/><main className="catalog-page"><h1>Your cart is empty</h1><Link to="/products">Browse products</Link></main></>;
  const selectedAddress = addresses.find((address) => address._id === addressId);
  if (step === 2) return <><SiteHeader/><main className="catalog-page cart-page"><p className="catalog-breadcrumb"><button className="checkout-back-link" onClick={() => setStep(1)}>Checkout</button> / Review order</p><div className="catalog-title"><div><span className="eyebrow">FINAL CHECK</span><h1>Review your order</h1></div></div>{error && <p className="cart-notice" role="alert">{error}</p>}
    <div className="cart-layout"><section className="cart-items"><article className="cart-summary"><div className="checkout-review-heading"><h2>Delivery address</h2><button type="button" onClick={() => setStep(1)}>Change</button></div>{selectedAddress ? <p>{selectedAddress.fullName}<br/>{selectedAddress.line1}{selectedAddress.line2 ? `, ${selectedAddress.line2}` : ""}<br/>{selectedAddress.city}, {selectedAddress.state} {selectedAddress.postalCode}<br/>{selectedAddress.country} · {selectedAddress.phone}</p> : <p>No delivery address selected.</p>}</article>
      <article className="cart-summary"><fieldset className="checkout-payment-methods"><legend>Payment method</legend><label className={`checkout-payment-option ${method === "cod" ? "is-selected" : ""}`}><input type="radio" name="paymentMethod" value="cod" checked={method === "cod"} onChange={() => setMethod("cod")} /><span><b>Cash on Delivery</b><small>Pay when your order arrives</small></span></label><label className={`checkout-payment-option ${method === "razorpay" ? "is-selected" : ""}`}><input type="radio" name="paymentMethod" value="razorpay" checked={method === "razorpay"} onChange={() => setMethod("razorpay")} /><span><b>Pay online with Razorpay</b><small>UPI, cards, net banking, and more</small></span></label><label className={`checkout-payment-option ${method === "wallet" ? "is-selected" : ""} ${!walletCanPay ? "is-unavailable" : ""}`}><input type="radio" name="paymentMethod" value="wallet" checked={method === "wallet"} disabled={walletLoading || !walletCanPay} onChange={() => setMethod("wallet")} /><span><b>Pay with MOBIX wallet</b><small>{walletLoading ? "Checking your balance…" : `Available balance ${money(walletBalancePaise / 100)}${walletCanPay ? " · enough for this order" : " · insufficient for this order"}`}</small></span></label></fieldset></article>
      <article className="cart-summary"><h2>Items ({cart.reduce((sum,item)=>sum+item.quantity,0)})</h2>{cart.map((item)=><div key={`${item.productId}-${item.variantId}`}><span>{item.name} × {item.quantity}</span><b>{money(item.price*item.quantity)}</b></div>)}</article></section>
      <aside className="cart-summary"><h2>Order total</h2><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Shipping</span><b>{shipping?money(shipping):"Free"}</b></div><hr/><div className="cart-grand-total"><span>Payable</span><b>{money(subtotal+shipping)}</b></div><p>Taxes included in listed product prices.</p><button disabled={busy||!addressId||(method==="wallet"&&!walletCanPay)} onClick={()=>placeOrder()}>{busy?"Processing…":method==="razorpay"?"Continue to payment":"Place order"}</button><button className="checkout-review-back" disabled={busy} onClick={()=>setStep(1)}>Back to checkout</button></aside></div>
  </main>{confirmationOrder && <div className="order-confirmation-overlay"><section className="order-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="order-confirmation-title"><span className="order-confirmation-check" aria-hidden="true">✓</span><h2 id="order-confirmation-title">Order confirmed!</h2><p>Your order has been placed successfully.</p>{confirmationOrder.orderNumber && <p className="order-confirmation-number">Order number <b>{confirmationOrder.orderNumber}</b></p>}<button className="order-confirmation-primary" onClick={() => navigate(`/orders/${confirmationOrder._id}`, { replace: true })}>View order</button><button className="order-confirmation-secondary" onClick={() => navigate("/products", { replace: true })}>Continue shopping</button></section></div>}</>;
  return <><SiteHeader/><main className="catalog-page cart-page"><p className="catalog-breadcrumb"><Link to="/cart">Cart</Link> / Checkout</p><div className="catalog-title"><div><span className="eyebrow">SECURE CHECKOUT</span><h1>Delivery & payment</h1></div></div>{error && <p className="cart-notice" role="alert">{error}</p>}
    <div className="cart-layout"><section className="cart-items"><article className="cart-summary"><h2>Delivery address</h2>{addresses.map((a) => <label key={a._id} style={{display:"block",padding:"12px",border:"1px solid #ddd",borderRadius:8,marginBottom:8}}><input type="radio" name="address" checked={addressId===a._id} onChange={()=>setAddressId(a._id)}/> <b>{a.label} — {a.fullName}</b><br/>{a.line1}, {a.city}, {a.state} {a.postalCode} · {a.phone}</label>)}<button className="outline-btn" type="button" onClick={()=>setAdding(!adding)}>{adding?"Cancel":"＋ Add address"}</button>
    {adding && <form id="checkout-address-form" onSubmit={addNew} className="checkout-address-form">{fields.map((field)=><input key={field} required={!['line2','country'].includes(field)} placeholder={field.replace(/[A-Z]/g,(m)=>` ${m.toLowerCase()}`)} value={form[field]} onChange={(e)=>setForm({...form,[field]:e.target.value})}/>)}<button disabled={busy}>{busy?"Saving…":"Save address"}</button></form>}
    </article>
    <article className="cart-summary"><h2>Items ({cart.reduce((s,i)=>s+i.quantity,0)})</h2>{cart.map((item)=><div key={`${item.productId}-${item.variantId}`}><span>{item.name} × {item.quantity}</span><b>{money(item.price*item.quantity)}</b></div>)}</article></section><aside className="cart-summary"><h2>Order total</h2><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Shipping</span><b>{shipping?money(shipping):"Free"}</b></div><hr/><div className="cart-grand-total"><span>Payable</span><b>{money(subtotal+shipping)}</b></div><p>Taxes included in listed product prices.</p><button disabled={busy||!addressId} onClick={continueToReview}>{busy?"Please wait…":"Continue"}</button></aside></div>
  </main></>;
}

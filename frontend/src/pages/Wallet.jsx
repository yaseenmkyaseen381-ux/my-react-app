import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { getWallet } from "../api";
import "./Catalog.css";
import "./OrderCommerce.css";

const money = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const filterMatches = (transaction, filter) => {
  if (filter === "all") return true;
  if (filter === "added") return ["credit", "cashback"].includes(transaction.type);
  if (filter === "spent") return transaction.type === "debit";
  return transaction.type === "refund" || transaction.type === "cashback" || transaction.source === "order_refund";
};

export default function Wallet() {
  const [balancePaise, setBalancePaise] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    const data = await getWallet();
    setBalancePaise(data.balancePaise || 0);
    setTransactions(data.transactions || []);
  };

  useEffect(() => {
    refresh().catch((requestError) => setError(requestError.message || "Could not load wallet."))
      .finally(() => setLoading(false));
  }, []);

  const visibleTransactions = transactions.filter((transaction) => filterMatches(transaction, filter));

  return <>
    <SiteHeader />
    <main className="catalog-page wallet-page">
      <p className="catalog-breadcrumb"><Link to="/home">Home</Link> / My wallet</p>
      <div className="catalog-title"><div><span className="eyebrow">YOUR MOBIX ACCOUNT</span><h1>My wallet</h1><p>Manage your balance and track wallet activity.</p></div></div>
      {error && <p className="cart-notice wallet-message is-error" role="alert">{error}</p>}
      <section className="wallet-overview">
        <article className="wallet-balance-card">
          <span className="wallet-card-label">Available balance</span>
          <strong>{loading ? "—" : money(balancePaise)}</strong>
          <small>Use your MOBIX wallet at checkout.</small>
          <span className="wallet-card-art" aria-hidden="true">₹</span>
        </article>
      </section>

      <section className="cart-summary wallet-transactions">
        <div className="wallet-transactions-header"><div><h2>Transaction history</h2><p>Wallet credits, debits, returns, and cancellations.</p></div><label className="wallet-filter-label">Show<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All activity</option><option value="added">Credits</option><option value="spent">Debits</option><option value="refunds">Refunds</option></select></label></div>
        {loading ? <p className="wallet-empty">Loading wallet activity…</p> : visibleTransactions.length ? <div className="wallet-transaction-list">{visibleTransactions.map((transaction) => {
          const outgoing = transaction.type === "debit";
          const pending = transaction.status === "pending";
          const failed = transaction.status === "failed";
          return <article className="wallet-transaction" key={`${transaction.source}-${transaction.reference}-${transaction.createdAt}`}>
            <span className={`wallet-transaction-icon ${outgoing ? "is-debit" : "is-credit"}`} aria-hidden="true">{outgoing ? "−" : transaction.source === "order_refund" || transaction.type === "refund" ? "↩" : "+"}</span>
            <div className="wallet-transaction-copy"><b>{transaction.description}</b><small>{new Date(transaction.createdAt).toLocaleString("en-IN")}{transaction.reference ? ` · ${transaction.reference}` : ""}</small></div>
            <div className="wallet-transaction-amount"><b className={outgoing ? "is-debit" : transaction.balanceChange ? "is-credit" : ""}>{outgoing ? "−" : transaction.balanceChange ? "+" : ""}{money(transaction.amountPaise)}</b><small className={`wallet-transaction-type ${outgoing ? "is-debit" : "is-credit"}`}>{outgoing ? "Debit" : "Credit"}</small><small className={`wallet-status ${pending ? "is-pending" : failed ? "is-failed" : transaction.balanceChange ? "is-success" : ""}`}>{pending ? "Pending" : failed ? "Failed" : transaction.balanceChange || ["topup", "admin_credit"].includes(transaction.source) ? "Success" : "Original payment method"}</small></div>
          </article>;
        })}</div> : <div className="wallet-empty"><span aria-hidden="true">▤</span><b>No transactions yet</b><p>Your top-ups, wallet purchases, and refunds will appear here.</p></div>}
      </section>
      <div className="wallet-close-row"><Link className="wallet-close-button" to="/home">Close</Link></div>
    </main>
  </>;
}

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { creditAdminWallet, getAdminUserWallet, getAdminUsers, setUserBlocked } from "../api";
import { clearSession, getSessionToken, getSessionUser } from "../authSession";
import "./Home.css";
import AdminNavigation from "../components/AdminNavigation";
import AdminProfileMenu from "../components/AdminProfileMenu";
import "./Admin.css";

const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
const formatWalletBalance = (paise) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(Number(paise || 0) / 100);

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [confirmUser, setConfirmUser] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditBusy, setCreditBusy] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [walletHistoryLoading, setWalletHistoryLoading] = useState(false);

  const openUserDetails = async (user) => {
    setViewUser(user); setWalletTransactions([]); setWalletHistoryLoading(true); setError(""); setNotice("");
    try {
      const wallet = await getAdminUserWallet(user._id);
      setViewUser((current) => current && String(current._id) === String(user._id) ? { ...current, walletBalancePaise: wallet.balancePaise } : current);
      setWalletTransactions(wallet.transactions || []);
    } catch (requestError) { setError(requestError.message || "Could not load wallet activity."); }
    finally { setWalletHistoryLoading(false); }
  };

  const loadUsers = useCallback(async (search, requestedPage) => {
    setLoading(true); setError("");
    try {
      const result = await getAdminUsers({ search, page: requestedPage, limit: 10 });
      setUsers(result.users);
      setTotalUsers(result.totalUsers);
      setTotalPages(Math.max(1, result.totalPages));
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) {
        clearSession("admin");
        navigate("/admin", { replace: true });
      } else setError(requestError.message);
    } finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => {
    if (!getSessionToken("admin")) { navigate("/admin", { replace: true }); return; }
    setAdmin(getSessionUser("admin"));
    loadUsers(appliedQuery, page);
  }, [appliedQuery, page, navigate, loadUsers]);

  const submitSearch = (event) => {
    event.preventDefault();
    setNotice("");
    setPage(1);
    setAppliedQuery(query.trim());
  };
  const clearSearch = () => {
    setQuery("");
    setPage(1);
    setAppliedQuery("");
    setError("");
    setNotice("Search cleared.");
  };

  const toggleBlock = (user) => setConfirmUser(user);

  const submitWalletCredit = async (event) => {
    event.preventDefault();
    if (!viewUser || creditBusy) return;
    setError(""); setNotice(""); setCreditBusy(true);
    try {
      const result = await creditAdminWallet(viewUser._id, { amount: Number(creditAmount), reason: creditReason.trim() });
      setViewUser((current) => current ? { ...current, walletBalancePaise: result.balancePaise } : current);
      setUsers((current) => current.map((user) => String(user._id) === String(viewUser._id) ? { ...user, walletBalancePaise: result.balancePaise } : user));
      setCreditAmount(""); setCreditReason(""); setNotice(result.message || "Wallet credited successfully.");
      try {
        const wallet = await getAdminUserWallet(viewUser._id);
        setWalletTransactions(wallet.transactions || []);
      } catch { setWalletTransactions([]); }
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) { clearSession("admin"); navigate("/admin", { replace: true }); }
      else setError(requestError.message);
    } finally { setCreditBusy(false); }
  };

  const confirmBlockChange = async () => {
    const user = confirmUser;
    if (!user) return;
    setConfirmUser(null);
    setBusyId(String(user._id)); setError(""); setNotice("");
    try {
      const result = await setUserBlocked(user._id, !user.blocked);
      if (Boolean(result.user?.blocked) !== !user.blocked) throw new Error("Could not confirm the account status change. Refresh the user list and try again.");
      if (user.blocked && !result.user.blocked && user.email) {
        const emailKey = encodeURIComponent(user.email.trim().toLowerCase());
        localStorage.setItem(`mobix.user-unblocked:${emailKey}`, String(Date.now()));
      }
      setViewUser((current) => current && String(current._id) === String(user._id) ? { ...current, blocked: result.user.blocked } : current);
      setNotice(result.message || (user.blocked ? "User unblocked." : "User blocked."));
      await loadUsers(appliedQuery, page);
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) {
        clearSession("admin");
        navigate("/admin", { replace: true });
      } else setError(requestError.message);
    }
    finally { setBusyId(""); }
  };

  const logout = () => {
    clearSession("admin");
    navigate("/admin", { replace: true });
  };

  const switchToCustomer = () => {
    navigate("/user", { replace: true });
  };

  return <>
    <header className="site-header admin-header">
      <Link className="brand" to="/"><span className="brand-icon">M</span><b>MOBIX</b></Link>
      <span className="admin-header-label">ADMIN PANEL</span><nav className="admin-nav"><AdminNavigation active="users" onLogout={logout} /></nav>
      <div className="admin-header-user"><span>{admin?.name || "Administrator"}</span><button className="header-logout" onClick={switchToCustomer}>Switch to customer</button><AdminProfileMenu /></div>
    </header>
    <main className="admin-page">
      <p className="breadcrumb"><Link to="/">Home</Link> <span>/</span> Admin <span>/</span> Users</p>
      <div className="section-head admin-title"><div><span className="eyebrow">CUSTOMER ACCOUNTS</span><h1>User management</h1><p>Search, review, and manage registered customer accounts.</p></div><span className="admin-total">{totalUsers} registered {totalUsers === 1 ? "user" : "users"}</span></div>
      <section className="panel admin-users-panel">
        <form className="admin-toolbar" onSubmit={submitSearch}>
          <div><h2>Registered users</h2><p>Newest registrations appear first.</p></div>
          <div className="admin-search-row"><label className="searchbox"><span className="icon-glyph" aria-hidden="true">⌕</span><input aria-label="Search users" placeholder="Search name or email" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="btn admin-search-button" type="submit">Search</button><button className="outline-btn" type="button" onClick={clearSearch}>Clear</button></div>
        </form>
        {error && <div className="error" role="alert">{error}</div>}{notice && <div className="success" role="status">{notice}</div>}
        <div className="table-wrap">
          <table><thead><tr><th>Customer</th><th>Email</th><th>Wallet balance</th><th>Email verification</th><th>Account status</th><th>Joined date</th><th>Action</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan="7" className="admin-empty">Loading users…</td></tr> : users.length === 0 ? <tr><td colSpan="7" className="admin-empty">No users found. Try a different search.</td></tr> : users.map((user) => <tr key={user._id}>
              <td><div className="admin-user-cell"><span className="admin-user-avatar">{user.name?.charAt(0)?.toUpperCase() || "U"}</span><span><b>{user.name}</b></span></div></td>
              <td>{user.email}</td>
              <td>{formatWalletBalance(user.walletBalancePaise)}</td>
              <td><span className={`admin-status ${user.emailVerified ? "is-active" : "is-blocked"}`}>{user.emailVerified ? "Verified" : "Not verified"}</span></td>
              <td><span className={`admin-status ${user.blocked ? "is-blocked" : "is-active"}`}>{user.blocked ? "Blocked" : "Active"}</span></td>
              <td>{formatDate(user.createdAt)}</td>
              <td><div className="admin-user-actions"><button className="outline-btn admin-action admin-details-action" type="button" onClick={() => openUserDetails(user)}>View details</button><button className={`outline-btn admin-action ${user.blocked ? "unblock-action" : "block-action"}`} disabled={busyId === String(user._id)} onClick={() => toggleBlock(user)}>{busyId === String(user._id) ? "Saving…" : user.blocked ? "Unblock" : "Block"}</button></div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="admin-pagination"><span>Page {page} of {totalPages}</span><div><button className="outline-btn" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="outline-btn" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      </section>
    </main>
    {confirmUser && <div className="admin-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmUser(null); }} onKeyDown={(event) => { if (event.key === "Escape") setConfirmUser(null); }}>
      <section className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="block-dialog-title" aria-describedby="block-dialog-description">
        <span className={`admin-confirm-icon ${confirmUser.blocked ? "is-unblock" : ""}`} aria-hidden="true">{confirmUser.blocked ? "✓" : "!"}</span>
        <h2 id="block-dialog-title">{confirmUser.blocked ? "Unblock this user?" : "Block this user?"}</h2>
        <p id="block-dialog-description">{confirmUser.blocked ? "This will restore sign-in access for" : "This user will no longer be able to sign in:"} <b>{confirmUser.name}</b> <span>({confirmUser.email})</span></p>
        <div className="admin-confirm-actions">
          <button className="outline-btn" type="button" onClick={() => setConfirmUser(null)}>Cancel</button>
          <button className={`btn ${confirmUser.blocked ? "is-unblock" : "is-block"}`} type="button" onClick={confirmBlockChange}>{confirmUser.blocked ? "Unblock user" : "Block user"}</button>
        </div>
      </section>
    </div>}
    {viewUser && <div className="admin-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewUser(null); }} onKeyDown={(event) => { if (event.key === "Escape") setViewUser(null); }}>
      <section className="admin-confirm-dialog admin-user-details-dialog" role="dialog" aria-modal="true" aria-labelledby="user-details-title">
        <span className="admin-confirm-icon admin-customer-photo" aria-hidden="true">{viewUser.profileImage ? <img src={viewUser.profileImage} alt="" /> : viewUser.name?.charAt(0)?.toUpperCase() || "U"}</span>
        <h2 id="user-details-title">Customer details</h2>
        <dl className="admin-user-details-grid">
          <div><dt>Customer ID</dt><dd>{viewUser._id}</dd></div>
          <div><dt>Full name</dt><dd>{viewUser.name || "—"}</dd></div>
          <div><dt>Email</dt><dd>{viewUser.email || "—"}</dd></div>
          <div><dt>Email verification</dt><dd>{viewUser.emailVerified ? "Verified" : "Not verified"}</dd></div>
          <div><dt>Account status</dt><dd>{viewUser.blocked ? "Blocked" : "Active"}</dd></div>
          <div><dt>Joined date</dt><dd>{formatDate(viewUser.createdAt)}</dd></div>
        </dl>
        {error && <div className="error" role="alert">{error}</div>}{notice && <div className="success" role="status">{notice}</div>}
        <section className="admin-user-wallet-balance"><h3>Customer wallet balance</h3><p>{formatWalletBalance(viewUser.walletBalancePaise)}</p></section>
        <section className="admin-customer-wallet-history"><h3>Wallet activity</h3>{walletHistoryLoading ? <p className="admin-wallet-history-empty">Loading wallet activity…</p> : walletTransactions.length ? <div className="admin-wallet-history-list">{walletTransactions.map((transaction) => <article key={`${transaction.source}-${transaction.reference}-${transaction.createdAt}`}><span><b>{transaction.description}</b><small>{new Date(transaction.createdAt).toLocaleString("en-IN")}</small></span><span className="admin-wallet-history-result"><b>{formatWalletBalance(transaction.amountPaise)}</b><small className={`admin-wallet-status is-${transaction.status === "completed" ? "success" : transaction.status}`}>{transaction.status === "completed" ? "Success" : transaction.status === "pending" ? "Pending" : transaction.status === "failed" ? "Failed" : transaction.status}</small></span></article>)}</div> : <p className="admin-wallet-history-empty">No wallet activity yet.</p>}</section>
        <form className="admin-wallet-credit" onSubmit={submitWalletCredit}>
          <h3>Add money to wallet</h3>
          <label className="field"><span>Amount (₹)</span><input type="number" min="0.01" max="1000000" step="0.01" required value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} placeholder="Enter amount" /></label>
          <label className="field"><span>Reason for credit</span><input type="text" maxLength="180" required value={creditReason} onChange={(event) => setCreditReason(event.target.value)} placeholder="Enter the reason for adding money" /></label>
          <button className="btn admin-wallet-credit-button" type="submit" disabled={creditBusy}>{creditBusy ? "Adding money…" : "Add money to wallet"}</button>
        </form>
        <div className="admin-confirm-actions admin-user-details-actions"><button className={`outline-btn ${viewUser.blocked ? "unblock-action" : "block-action"}`} type="button" disabled={busyId === String(viewUser._id)} onClick={() => toggleBlock(viewUser)}>{viewUser.blocked ? "Unblock customer" : "Block customer"}</button><button className="outline-btn" type="button" onClick={() => { setViewUser(null); setError(""); setNotice(""); }}>Close</button></div>
      </section>
    </div>}
  </>;
}



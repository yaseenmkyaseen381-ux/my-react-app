import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { readCart } from "../cart";
import ProfileMenu from "./ProfileMenu";
import { clearSession, getSessionUser } from "../authSession";

export default function SiteHeader() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [user, setUser] = useState(() => getSessionUser("user"));
  const [cartCount, setCartCount] = useState(() => readCart().reduce((sum, item) => sum + item.quantity, 0));
  useEffect(() => {
    const syncCart = () => setCartCount(readCart().reduce((sum, item) => sum + item.quantity, 0));
    window.addEventListener("mobix-cart-updated", syncCart);
    window.addEventListener("storage", syncCart);
    return () => { window.removeEventListener("mobix-cart-updated", syncCart); window.removeEventListener("storage", syncCart); };
  }, []);
  useEffect(() => {
    const syncUser = () => {
      setUser(getSessionUser("user"));
    };
    window.addEventListener("mobix-user-session-updated", syncUser);
    return () => window.removeEventListener("mobix-user-session-updated", syncUser);
  }, []);

  const logout = () => {
    clearSession("user");
    setUser(null);
    navigate("/user", { replace: true });
  };

  const search = (event) => {
    event.preventDefault();
    navigate(`/products?q=${encodeURIComponent(query.trim())}`);
  };

  return <header className="site-header customer-header">
    <Link className="brand" to="/home" aria-label="MOBIX home"><span className="brand-icon">M</span><b>MOBIX</b></Link>
    <nav aria-label="Main navigation"><Link to="/home">Home</Link><Link to="/products">Products</Link><Link to="/categories">Categories</Link><Link to="/home#deals">Offers</Link></nav>
    <form className={`searchbox header-search ${searchOpen ? "is-open" : "is-closed"}`} onSubmit={search}>
      <button className="search-toggle" type="button" aria-label={searchOpen ? "Close search" : "Open search"} aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><circle cx="10.8" cy="10.8" r="6.7" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
      {searchOpen && <input autoFocus aria-label="Search products" placeholder="Search products" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }} />}
    </form>
    <div className="header-actions">
      {user ? <ProfileMenu user={user} onLogout={logout} /> : <Link className="header-login" to="/user">Log in</Link>}
      <Link className="wishlist-button" to="/wishlist" aria-label="Open wishlist" title="Wishlist"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M20.8 8.7c0 5.1-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.7A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></Link>
      <Link className="bag-button" to="/cart" aria-label={`Shopping cart with ${cartCount} items`}><span className="bag-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4h2l2.15 11.2a2 2 0 0 0 1.97 1.62h8.54a2 2 0 0 0 1.94-1.5L21 8H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 11h8M10 8v6M15 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="20" r="1.35" fill="currentColor"/><circle cx="18" cy="20" r="1.35" fill="currentColor"/></svg></span>{cartCount > 0 && <span className="bag-count">{cartCount}</span>}</Link>
    </div>
  </header>;
}

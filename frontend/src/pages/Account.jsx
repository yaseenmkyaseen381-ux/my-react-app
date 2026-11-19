import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMe } from "../api";
import SiteHeader from "../components/SiteHeader";
import "./Home.css";
import { clearSession, getSessionToken, saveSession } from "../authSession";

export default function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getSessionToken("user")) {
      navigate("/user", { replace: true });
      return;
    }
    getMe().then((currentUser) => {
      setUser(currentUser);
      saveSession("user", getSessionToken("user"), currentUser);
    }).catch(() => {
      clearSession("user");
      navigate("/user", { replace: true });
    }).finally(() => setLoading(false));
  }, [navigate]);

  const logout = () => {
    clearSession("user");
    navigate("/user", { replace: true });
  };

  if (loading || !user) return <div className="loading" role="status">Loading your account…</div>;
  const defaultAddress = user.addresses?.find((address) => address.isDefault);
  const memberSince = user.createdAt ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(user.createdAt)) : "—";

  return <>
    <SiteHeader />
    <main className="profile-page account-page">
      <p className="breadcrumb"><Link to="/home">Home</Link> <span>/</span> My account</p>
      <div className="section-head account-title"><div><span className="eyebrow">YOUR MOBIX ACCOUNT</span><h1>My Profile</h1><p>View and manage your personal information, addresses, and security.</p></div><Link className="btn account-save" to="/profile/edit">Edit profile</Link></div>
      <section className="profile-banner">
        <div className="avatar">{user.profileImage ? <img src={user.profileImage} alt={`${user.name} profile`} /> : <span aria-hidden="true">{user.name?.charAt(0)?.toUpperCase() || "U"}</span>}</div>
        <div className="profile-identity"><h2>{user.name} <span className="status-pill">Active</span></h2><small>{user.email}</small><p>Member since {memberSince}</p></div>
        <div className="profile-stats"><div className="stat"><small>Account type</small><b>{user.role === "admin" ? "Administrator" : "Customer"}</b></div><div className="stat"><small>Email status</small><b>{user.emailVerified ? "Verified" : "Unverified"}</b></div></div>
      </section>
      <div className="profile-columns account-columns">
        <section className="panel account-shortcuts">
          <div className="panel-head"><h2>Personal Information</h2><span>Your account details at a glance.</span></div>
          <div className="profile-info-grid">
            <div className="profile-info-item"><small>Full name</small><b>{user.name}</b></div>
            <div className="profile-info-item"><small>Email address</small><b>{user.email}</b></div>
            <div className="profile-info-item"><small>Account status</small><b>{user.emailVerified ? "Email verified" : "Verification pending"}</b></div>
            <div className="profile-info-item"><small>Account type</small><b>{user.role === "admin" ? "Administrator" : "Customer"}</b></div>
            <div className="profile-info-item"><small>Phone</small><b>{defaultAddress?.phone || "Not added"}</b></div>
            <div className="profile-info-item"><small>Member since</small><b>{memberSince}</b></div>
            <div className="profile-info-item profile-info-wide"><small>Default address</small><b>{defaultAddress ? `${defaultAddress.line1}, ${defaultAddress.city}` : "No default address added"}</b></div>
          </div>
        </section>
        <aside className="panel account-security"><h2>Account Hub</h2><p>Manage the details connected to your account.</p>
          <Link className="hub-link" to="/addresses"><span aria-hidden="true">⌂</span><span><b>My Addresses</b><small>Manage delivery addresses</small></span><span className="hub-arrow">→</span></Link>
          <Link className="hub-link" to="/profile/edit"><span aria-hidden="true">◎</span><span><b>Edit Profile</b><small>Update your name and photo</small></span><span className="hub-arrow">→</span></Link>
          <Link className="hub-link" to="/profile/edit#password"><span aria-hidden="true">◇</span><span><b>Change Password</b><small>Update your sign-in password</small></span><span className="hub-arrow">→</span></Link>
          <button className="logout-btn" onClick={logout}><span aria-hidden="true">↪</span> Log out of MOBIX</button>
        </aside>
      </div>
    </main>
  </>;
}

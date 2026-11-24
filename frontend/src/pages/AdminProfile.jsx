import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { changePassword, getAdminProfile, updateAdminProfile } from "../api";
import { clearSession } from "../authSession";
import AdminNavigation from "../components/AdminNavigation";
import AdminProfileBadge from "../components/AdminProfileBadge";
import "./Admin.css";

export default function AdminProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getAdminProfile()
      .then((data) => {
        setProfile(data);
        setName(data.name || "");
        setEmail(data.email || "");
        setProfileImage(data.profileImage || "");
        localStorage.setItem("adminProfile", JSON.stringify(data));
        window.dispatchEvent(new Event("mobix-admin-profile-updated"));
      })
      .catch((requestError) => {
        if (requestError.status === 401 || requestError.status === 403) {
          clearSession("admin");
          navigate("/admin", { replace: true });
        } else
          setError(requestError.message || "Could not load the admin profile.");
      });
  }, [navigate]);

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to upload.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose an image smaller than 10 MB.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas
        .getContext("2d")
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      setProfileImage(canvas.toDataURL("image/jpeg", 0.82));
      setError("");
      setNotice("Photo selected. Save profile to apply it.");
    } catch {
      setError("This image could not be opened. Try another photo.");
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await updateAdminProfile({
        name: name.trim(),
        email: email.trim(),
        profileImage,
      });
      setProfile(updated);
      setName(updated.name);
      setEmail(updated.email);
      setProfileImage(updated.profileImage || "");
      localStorage.setItem("adminProfile", JSON.stringify(updated));
      window.dispatchEvent(new Event("mobix-admin-profile-updated"));
      setNotice("Admin profile updated.");
    } catch (requestError) {
      setError(requestError.message || "Could not save the admin profile.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice(result.message || "Password updated.");
    } catch (requestError) {
      setError(requestError.message || "Could not update the password.");
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    clearSession("admin");
    localStorage.removeItem("adminProfile");
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
        <AdminProfileBadge />
        <nav className="admin-nav">
          <AdminNavigation active="profile" onLogout={logout} />
        </nav>
      </header>
      <main className="admin-page">
        <p className="breadcrumb">
          <Link to="/home">Store</Link> <span>/</span> Admin <span>/</span>{" "}
          Profile
        </p>
        <div className="section-head admin-title">
          <div>
            <span className="eyebrow">ADMIN ACCOUNT</span>
            <h1>Admin profile</h1>
            <p>Edit admin details without changing your customer profile.</p>
          </div>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="success" role="status">
            {notice}
          </div>
        )}
        <div className="admin-profile-layout">
          <section className="panel admin-profile-panel">
            <div className="admin-profile-preview">
              {profileImage ? (
                <img src={profileImage} alt="Admin profile preview" />
              ) : (
                <span>{name?.charAt(0)?.toUpperCase() || "A"}</span>
              )}
            </div>
            <div className="admin-profile-info">
              <h2>Profile details</h2>
              <p>These details are only used in the admin panel.</p>
              <form onSubmit={saveProfile} className="admin-profile-edit-form">
                <label>
                  Full name
                  <input
                    required
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <div className="admin-profile-facts">
                  <div>
                    <small>Account role</small>
                    <b>
                      {profile?.role === "admin"
                        ? "Administrator"
                        : profile?.role || "—"}
                    </b>
                  </div>
                  <div>
                    <small>Account status</small>
                    <b>{profile?.blocked ? "Blocked" : "Active"}</b>
                  </div>
                </div>
                <label className="outline-btn admin-profile-upload">
                  Choose photo
                  <input type="file" accept="image/*" onChange={uploadPhoto} />
                </label>
                <button
                  className="btn admin-search-button"
                  disabled={busy || !profile}
                >
                  {busy ? "Saving…" : "Save profile"}
                </button>
              </form>
            </div>
          </section>
          <section className="panel admin-password-panel">
            <h2>Change password</h2>
            <p>Update the password used to sign in to this account.</p>
            <form onSubmit={savePassword}>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <button className="btn admin-search-button" disabled={busy}>
                {busy ? "Saving…" : "Update password"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}

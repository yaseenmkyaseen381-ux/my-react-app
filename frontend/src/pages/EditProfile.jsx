import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { changePassword, getMe, requestEmailChange, updateMe, verifyEmailChange } from "../api";
import SiteHeader from "../components/SiteHeader";
import OtpInput from "../components/OtpInput";
import "./Home.css";
import { clearSession, getSessionToken, saveSession } from "../authSession";
import "./Admin.css";

export default function EditProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!getSessionToken("user")) { navigate("/user", { replace: true }); return; }
    getMe().then((currentUser) => {
      setUser(currentUser); setName(currentUser.name || ""); setProfileImage(currentUser.profileImage || "");
      saveSession("user", getSessionToken("user"), currentUser);
    }).catch(() => { clearSession("user"); navigate("/user", { replace: true }); });
  }, [navigate]);

  const run = async (action) => {
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (requestError) { setError(requestError.message || "Something went wrong."); }
    finally { setBusy(false); }
  };

  const saveProfile = (event) => {
    event.preventDefault();
    return run(async () => {
      const updated = await updateMe({ name: name.trim(), profileImage: profileImage.trim() });
      const savedUser = { ...user, ...updated };
      setUser(savedUser); saveSession("user", getSessionToken("user"), savedUser);
      setNotice("Profile updated.");
    });
  };

  const uploadProfilePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file to upload."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Choose an image smaller than 10 MB."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      setProfileImage(canvas.toDataURL("image/jpeg", 0.82));
      setError("");
      setNotice("Photo selected. Save profile to apply it.");
    } catch {
      setError("This image could not be opened. Try another photo.");
    }
  };

  const savePassword = (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setError("New passwords do not match."); setNotice(""); return; }
    return run(async () => {
      const result = await changePassword({ currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setNotice(result.message);
    });
  };

  const sendEmailOtp = (event) => {
    event.preventDefault();
    return run(async () => {
      const result = await requestEmailChange({ email: newEmail });
      setEmailOtp("");
      setEmailOtpSent(true); setNotice(result.message);
    });
  };

  const verifyEmailOtp = (event) => {
    event.preventDefault();
    return run(async () => {
      const result = await verifyEmailChange({ otp: emailOtp });
      const updated = { ...user, ...result.user };
      setUser(updated); saveSession("user", getSessionToken("user"), updated); setEmailOtpSent(false); setEmailOtp(""); setNewEmail(""); setNotice(result.message);
    });
  };

  if (!user) return <div className="loading" role="status">Loading your profile…</div>;
  return <>
    <SiteHeader />
    <main className="profile-page edit-profile-page">
      <p className="breadcrumb"><Link to="/home">Home</Link><span>/</span><Link to="/account">My account</Link><span>/</span>Edit profile</p>
      <div className="section-head account-title"><div><span className="eyebrow">PROFILE SETTINGS</span><h1>Edit your profile</h1><p>Update your profile information, email address, or password.</p></div></div>
      {error && <div className="error" role="alert">{error}</div>}{notice && <div className="success" role="status">{notice}</div>}
      <div className="edit-profile-grid">
        <section className="panel"><div className="panel-head"><h2>Profile information</h2><span>Upload a photo or use an HTTPS image URL.</span></div>
          <div className="profile-preview"><div className="avatar">{profileImage ? <img src={profileImage} alt="Profile preview" /> : (name.charAt(0).toUpperCase() || "U")}</div><label className="profile-photo-upload">Upload photo<input type="file" accept="image/*" onChange={uploadProfilePhoto} /></label></div>
          <form className="account-form" onSubmit={saveProfile}>
            <label className="account-field" htmlFor="profile-name">Full name<input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>
            <label className="account-field" htmlFor="profile-image">Profile image URL (optional)<input id="profile-image" type="text" inputMode="url" placeholder="https://example.com/photo.jpg" value={profileImage.startsWith("data:image/") ? "" : profileImage} onChange={(event) => setProfileImage(event.target.value)} /></label>
            <button className="btn account-save" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
          </form>
        </section>

        <section className="panel"><div className="panel-head"><h2>Change email address</h2><span>We will verify the new address before applying it.</span></div>
          <p className="current-email">Current email <b>{user.email}</b></p>
          {!emailOtpSent ? <form className="account-form" onSubmit={sendEmailOtp}><label className="account-field" htmlFor="new-email">New email address<input id="new-email" type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><button className="btn account-save" disabled={busy}>{busy ? "Sending…" : "Send verification code"}</button></form> : <form className="account-form" onSubmit={verifyEmailOtp}><div className="account-field"><label>Code sent to {newEmail}</label><OtpInput id="email-otp" value={emailOtp} onChange={setEmailOtp} label="New email verification code" /></div><button className="btn account-save" disabled={busy}>{busy ? "Verifying…" : "Verify new email"}</button><button className="text-button" type="button" disabled={busy} onClick={() => setEmailOtpSent(false)}>Use another email</button></form>}
        </section>

        <section className="panel" id="password"><div className="panel-head"><h2>Change password</h2><span>Choose a new password with at least 8 characters.</span></div>
          <form className="account-form" onSubmit={savePassword}>
            <label className="account-field" htmlFor="current-password">Current password<input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
            <label className="account-field" htmlFor="new-password">New password<input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label className="account-field" htmlFor="confirm-new-password">Confirm new password<input id="confirm-new-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <button className="btn account-save" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
          </form>
        </section>
      </div>
    </main>
  </>;
}

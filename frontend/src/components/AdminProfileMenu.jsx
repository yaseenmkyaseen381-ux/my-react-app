import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminProfile } from "../api";

function readUser() {
  try { return JSON.parse(localStorage.getItem("adminProfile") || "{}"); }
  catch { return {}; }
}

export default function AdminProfileMenu() {
  const [user, setUser] = useState(readUser);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setUser(readUser());
    window.addEventListener("mobix-admin-profile-updated", sync);
    getAdminProfile().then((profile) => { localStorage.setItem("adminProfile", JSON.stringify(profile)); sync(); }).catch(() => {});
    return () => window.removeEventListener("mobix-admin-profile-updated", sync);
  }, []);

  return <div className="admin-profile-menu">
    <button className="admin-profile-menu-trigger" type="button" aria-label="Open admin profile menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {user.profileImage ? <img src={user.profileImage} alt="" /> : (user.name?.charAt(0)?.toUpperCase() || "A")}
    </button>
    {open && <div className="admin-profile-menu-popover"><b>{user.name || "Administrator"}</b><span>{user.email || ""}</span><Link to="/admin/profile" onClick={() => setOpen(false)}>Edit profile</Link></div>}
  </div>;
}

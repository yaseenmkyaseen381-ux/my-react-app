import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const positionMenu = () => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(340, window.innerWidth - 28);
      const left = Math.max(
        14,
        Math.min(bounds.left, window.innerWidth - width - 14),
      );
      setMenuPosition({ top: bounds.bottom + 12, left });
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open]);

  if (!user) return null;

  const close = () => setOpen(false);
  const logout = () => {
    close();
    onLogout();
  };

  return (
    <div className="profile-menu-wrap">
      <button
        ref={triggerRef}
        className="account-link profile-menu-trigger"
        type="button"
        aria-label={`Open account menu for ${user.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-avatar" aria-hidden="true">
          {user.profileImage ? (
            <img src={user.profileImage} alt="" />
          ) : (
            user.name?.charAt(0)?.toUpperCase() || "U"
          )}
        </span>
        <span className="account-name">
          {user.name?.split(" ")[0] || "Account"}
        </span>
      </button>
      {open && (
        <>
          <button
            className="profile-menu-backdrop"
            type="button"
            aria-label="Close account menu"
            onClick={close}
          />
          <section
            className="profile-menu-dialog"
            style={menuPosition || undefined}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-menu-title"
          >
            <h2 id="profile-menu-title">My Account</h2>
            <div
              className="profile-menu-options"
              role="group"
              aria-label="Account options"
            >
              <Link to="/profile/edit" onClick={close}>
                My Profile
              </Link>
              <Link to="/orders" onClick={close}>
                My Orders
              </Link>
              <Link to="/wallet" onClick={close}>
                My Wallet
              </Link>
              <button type="button" onClick={logout}>
                Log out
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

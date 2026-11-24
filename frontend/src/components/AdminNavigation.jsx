import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminOrders } from "../api";

const links = [
  ["dashboard", "Dashboard", "/admin/dashboard"],
  ["products", "Products", "/admin/products"],
  ["inventory", "Inventory", "/admin/inventory"],
  ["categories", "Categories", "/admin/categories"],
  ["coupons", "Coupons", "/admin/coupons"],
  ["orders", "Orders", "/admin/orders"],
  ["users", "Users", "/admin/users"],
  ["reports", "Reports", "/admin/reports"],
  ["profile", "Profile", "/admin/profile"],
  ["recovery", "Deleted items", "/admin/recovery"],
];

export default function AdminNavigation({ active, onLogout }) {
  const [orderCount, setOrderCount] = useState(0);
  useEffect(() => {
    getAdminOrders({ page: 1, limit: 1 })
      .then((result) => setOrderCount(Number(result.total) || 0))
      .catch(() => {});
  }, []);

  return (
    <>
      {links.map(([id, title, to]) => (
        <Link
          key={id}
          className={`${id === "orders" ? "admin-nav-orders" : ""} ${active === id ? "active" : ""}`.trim()}
          to={to}
        >
          <span>{title}</span>
          {id === "orders" && orderCount > 0 && (
            <span className="admin-nav-count">{orderCount}</span>
          )}
        </Link>
      ))}
      <button type="button" className="admin-nav-logout" onClick={onLogout}>
        Log out
      </button>
    </>
  );
}

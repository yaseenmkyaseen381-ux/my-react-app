import { Navigate } from "react-router-dom";
import { getSessionToken, getSessionUser } from "../authSession";

export default function AdminRoute({ children }) {
  const token = getSessionToken("admin");
  const user = getSessionUser("admin");

  if (!token || user?.role !== "admin") return <Navigate to="/admin" replace />;
  return children;
}

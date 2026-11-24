import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { getMe } from "../api";
import { clearSession, getSessionToken, getSessionUser } from "../authSession";

export default function CustomerRoute({ children }) {
  const token = getSessionToken("user");
  const user = getSessionUser("user");
  useEffect(() => {
    if (!token || user?.role !== "user") return undefined;
    let active = true;
    const verifySession = () =>
      getMe().catch((error) => {
        if (!active) return;
        const blocked =
          error.status === 403 && /blocked/i.test(error.message || "");
        if (!blocked && error.status !== 401) return;
        clearSession("user");
        window.location.replace("/user");
      });
    verifySession();
    const timer = window.setInterval(verifySession, 2000);
    const syncSession = (event) => {
      if (event.key === "mobix.userToken" && !event.newValue)
        window.location.replace("/user");
    };
    window.addEventListener("focus", verifySession);
    window.addEventListener("storage", syncSession);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", verifySession);
      window.removeEventListener("storage", syncSession);
    };
  }, [token, user?.role]);
  if (!token) return <Navigate to="/user" replace />;
  if (user?.role !== "user") return <Navigate to="/user" replace />;
  return children;
}

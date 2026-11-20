import { clearSession, getSessionToken, getSessionUser } from "./authSession";

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");

async function request(method, path, body) {
  const token = getSessionToken();
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the backend server. Start the backend and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403 && /account is blocked/i.test(String(data.message || ""))) {
      const email = String(body?.email || getSessionUser("user")?.email || "").trim().toLowerCase();
      if (email) {
        localStorage.setItem("mobix.blocked-email", email);
        localStorage.setItem(`mobix.user-blocked-at:${encodeURIComponent(email)}`, String(Date.now()));
      }
      clearSession("user");
      if (!window.location.pathname.startsWith("/admin")) window.location.replace("/user?blocked=1");
    }
    const error = new Error(data.message || "Something went wrong");
    error.status = res.status;
    error.details = data;
    error.code = data.code;
    throw error;
  }
  return data;
}

export const signup = (payload) => request("POST", "/auth/signup", payload);
export const login = (payload) => request("POST", "/auth/login", payload);
export const googleLogin = (payload) => request("POST", "/auth/google", payload);
export const adminLogin = (payload) => request("POST", "/auth/admin-login", payload);
export const verifyEmail = (payload) => request("POST", "/auth/verify-email", payload);
export const resendOtp = (payload) => request("POST", "/auth/resend-otp", payload);
export const forgotPassword = (payload) => request("POST", "/auth/forgot-password", payload);
export const resetPassword = (payload) => request("POST", "/auth/reset-password", payload);
export const getMe = () => request("GET", "/users/me");
export const updateMe = (payload) => request("PUT", "/users/me", payload);
export const changePassword = (payload) => request("PATCH", "/users/me/password", payload);
export const requestEmailChange = (payload) => request("POST", "/users/me/email-change", payload);
export const verifyEmailChange = (payload) => request("POST", "/users/me/email-change/verify", payload);
export const getAddresses = () => request("GET", "/users/me/addresses");
export const addAddress = (payload) => request("POST", "/users/me/addresses", payload);
export const updateAddress = (id, payload) => request("PUT", `/users/me/addresses/${id}`, payload);
export const setDefaultAddress = (id) => request("PATCH", `/users/me/addresses/${id}/default`, {});
export const deleteAddress = (id) => request("DELETE", `/users/me/addresses/${id}`);
export const getWallet = () => request("GET", "/wallet");
export const getAdminUsers = (params) => request("GET", `/admin/users?${new URLSearchParams(params)}`);
export const getAdminReports = () => request("GET", "/admin/reports");
export const getAdminProfile = () => request("GET", "/admin/profile");
export const updateAdminProfile = (payload) => request("PUT", "/admin/profile", payload);
export const getAdminReviews = (params = {}) => request("GET", `/admin/reviews?${new URLSearchParams(params)}`);
export const updateAdminReviewStatus = (id, status) => request("PATCH", `/admin/reviews/${encodeURIComponent(id)}/status`, { status });
export const deleteAdminReview = (id) => request("DELETE", `/admin/reviews/${encodeURIComponent(id)}`);
export const submitProductReview = (id, payload) => request("POST", `/products/${encodeURIComponent(id)}/reviews`, payload);
export const getMyProductReviews = () => request("GET", "/products/my-reviews");
export const setUserBlocked = (id, blocked) => request("PATCH", `/admin/users/${id}/block`, { blocked });
export const getAdminUserWallet = (id) => request("GET", `/admin/users/${encodeURIComponent(id)}/wallet`);
export const creditAdminWallet = (id, payload) => request("POST", `/admin/users/${encodeURIComponent(id)}/wallet/credit`, payload);
export const getAdminProducts = (params = {}) => request("GET", `/admin/products?${new URLSearchParams(params)}`);
export const getAdminCategories = (params = {}) => request("GET", `/admin/categories?${new URLSearchParams(params)}`);
export const createAdminCategory = (payload) => request("POST", "/admin/categories", payload);
export const updateAdminCategory = (id, payload) => request("PATCH", `/admin/categories/${encodeURIComponent(id)}`, payload);
export const deleteAdminCategory = (id) => request("DELETE", `/admin/categories/${encodeURIComponent(id)}`);
export const searchAdminProducts = (params = {}) => request("GET", `/admin/products?${new URLSearchParams(params)}`);
export const createAdminProduct = (payload) => request("POST", "/admin/products", payload);
export const updateAdminProduct = (id, payload) => request("PATCH", `/admin/products/${encodeURIComponent(id)}`, payload);
export const deleteAdminProduct = (id) => request("DELETE", `/admin/products/${encodeURIComponent(id)}`);
const queryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== "" && value !== undefined && value !== null) query.set(key, value); });
  return query.toString();
};
export const getProducts = (params) => request("GET", `/products?${queryString(params)}`);
export const getProduct = (id) => request("GET", `/products/${encodeURIComponent(id)}`);
export const getCategories = () => request("GET", "/products/categories");
export const validateCart = (items) => request("POST", "/products/cart/validate", { items });
export const validateCheckoutCart = (items) => request("POST", "/products/cart/checkout/validate", { items });
export const getWishlist = () => request("GET", "/products/wishlist");
export const addWishlistItem = (id) => request("POST", `/products/wishlist/${encodeURIComponent(id)}`, {});
export const removeWishlistItem = (id) => request("DELETE", `/products/wishlist/${encodeURIComponent(id)}`);
export const createOrder = (payload) => request("POST", "/orders", payload);
export const getOrders = (params = {}) => request("GET", `/orders?${queryString(params)}`);
export const getOrder = (id) => request("GET", `/orders/${encodeURIComponent(id)}`);
export const cancelOrder = (id, reason) => request("PATCH", `/orders/${encodeURIComponent(id)}/cancel`, { reason });
export const requestReturn = (id, reason) => request("POST", `/orders/${encodeURIComponent(id)}/return`, { reason });
export const retryPayment = (id) => request("POST", `/orders/${encodeURIComponent(id)}/payment/retry`, {});
export const verifyPayment = (id, payload) => request("POST", `/orders/${encodeURIComponent(id)}/payment/verify`, payload);
export const recordPaymentFailure = (id, payload) => request("POST", `/orders/${encodeURIComponent(id)}/payment/failure`, payload);
export const getAdminOrders = (params = {}) => request("GET", `/orders/admin?${queryString(params)}`);
export const updateOrderStatus = (id, status) => request("PATCH", `/orders/${encodeURIComponent(id)}/status`, { status });
export const reviewReturn = (id, decision) => request("PATCH", `/orders/${encodeURIComponent(id)}/return-review`, { decision });
export async function downloadInvoice(id) {
  const token = getSessionToken();
  const response = await fetch(`${API}/orders/${encodeURIComponent(id)}/invoice.pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "Could not download invoice."); }
  const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "MOBIX-invoice.pdf"; link.click(); URL.revokeObjectURL(url);
}

export const restoreAdminCategory = (id) => request("POST", `/admin/categories/${encodeURIComponent(id)}/restore`, {});
export const restoreAdminProduct = (id) => request("POST", `/admin/products/${encodeURIComponent(id)}/restore`, {});

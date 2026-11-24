import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import CreateAccount from "./pages/CreateAccount";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import Account from "./pages/Account";
import VerifyEmail from "./pages/VerifyEmail";
import AdminLogin from "./pages/AdminLogin";
import AdminUsers from "./pages/AdminUsers";
import AdminProducts from "./pages/AdminProducts";
import AdminCategories from "./pages/AdminCategories";
import AdminCoupons from "./pages/AdminCoupons";
import AdminRecovery from "./pages/AdminRecovery";
import AdminRoute from "./components/AdminRoute";
import CustomerRoute from "./components/CustomerRoute";
import EditProfile from "./pages/EditProfile";
import Addresses from "./pages/Addresses";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Wallet from "./pages/Wallet";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import AdminOrders from "./pages/AdminOrders";
import AdminDashboard from "./pages/AdminDashboard";
import AdminReports from "./pages/AdminReports";
import AdminProfile from "./pages/AdminProfile";
import AdminInventory from "./pages/AdminInventory";
import PaymentResult from "./pages/PaymentResult";
import "./App.css";
import { getSessionToken, getSessionUser } from "./authSession";

function AdminEntry() {
  const user = getSessionUser("admin");
  return getSessionToken("admin") && user?.role === "admin" ? (
    <Navigate to="/admin/dashboard" replace />
  ) : (
    <AdminLogin />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/user" replace />} />
        <Route path="/user" element={<Login />} />
        <Route
          path="/home"
          element={
            <CustomerRoute>
              <Home />
            </CustomerRoute>
          }
        />
        <Route
          path="/products"
          element={
            <CustomerRoute>
              <Products />
            </CustomerRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <CustomerRoute>
              <Categories />
            </CustomerRoute>
          }
        />
        <Route
          path="/wallet"
          element={
            <CustomerRoute>
              <Wallet />
            </CustomerRoute>
          }
        />
        <Route
          path="/products/:productId"
          element={
            <CustomerRoute>
              <ProductDetails />
            </CustomerRoute>
          }
        />
        <Route
          path="/cart"
          element={
            <CustomerRoute>
              <Cart />
            </CustomerRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <CustomerRoute>
              <Checkout />
            </CustomerRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <CustomerRoute>
              <Orders />
            </CustomerRoute>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <CustomerRoute>
              <Orders />
            </CustomerRoute>
          }
        />
        <Route
          path="/payment/success"
          element={
            <CustomerRoute>
              <PaymentResult success />
            </CustomerRoute>
          }
        />
        <Route
          path="/payment/failure"
          element={
            <CustomerRoute>
              <PaymentResult success={false} />
            </CustomerRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <CustomerRoute>
              <Wishlist />
            </CustomerRoute>
          }
        />
        <Route path="/login" element={<Navigate to="/user" replace />} />
        <Route path="/signup" element={<CreateAccount />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/account"
          element={
            <CustomerRoute>
              <Account />
            </CustomerRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <CustomerRoute>
              <EditProfile />
            </CustomerRoute>
          }
        />
        <Route
          path="/addresses"
          element={
            <CustomerRoute>
              <Addresses />
            </CustomerRoute>
          }
        />
        <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminEntry />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <AdminRoute>
              <AdminProducts />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <AdminRoute>
              <AdminInventory />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/categories"
          element={
            <AdminRoute>
              <AdminCategories />
            </AdminRoute>
          }
        />
        <Route path="/admin/coupons" element={<AdminRoute><AdminCoupons /></AdminRoute>} />
        <Route
          path="/admin/recovery"
          element={
            <AdminRoute>
              <AdminRecovery />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <AdminRoute>
              <AdminOrders />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <AdminRoute>
              <AdminReports />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/profile"
          element={
            <AdminRoute>
              <AdminProfile />
            </AdminRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

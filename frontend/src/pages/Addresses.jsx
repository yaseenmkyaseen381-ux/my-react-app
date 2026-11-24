import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addAddress,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
  updateAddress,
} from "../api";
import SiteHeader from "../components/SiteHeader";
import "./Home.css";
import { clearSession, getSessionToken } from "../authSession";
import "./Admin.css";

const emptyAddress = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  isDefault: false,
};

export default function Addresses() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptyAddress);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      setAddresses(await getAddresses());
    } catch (requestError) {
      if (
        requestError.message.includes("Not logged in") ||
        requestError.message.includes("Invalid or expired") ||
        requestError.message.includes("blocked")
      ) {
        clearSession("user");
        navigate("/user", { replace: true });
      } else setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getSessionToken("user")) {
      navigate("/user", { replace: true });
      return;
    }
    load();
  }, [navigate]);

  const setField = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  const resetForm = () => {
    setForm(emptyAddress);
    setEditingId("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = editingId
        ? await updateAddress(editingId, form)
        : await addAddress(form);
      setAddresses(result);
      setNotice(editingId ? "Address updated." : "Address added.");
      resetForm();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const edit = (address) => {
    setEditingId(address._id);
    setForm({
      label: address.label || "Home",
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 || "",
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || "India",
      isDefault: address.isDefault,
    });
    document
      .getElementById("address-form")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const remove = async (address) => {
    if (
      !window.confirm(
        `Delete the ${address.label || "saved"} address for ${address.fullName}?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setAddresses(await deleteAddress(address._id));
      setNotice("Address deleted.");
      if (editingId === address._id) resetForm();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (address) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setAddresses(await setDefaultAddress(address._id));
      setNotice("Default address updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="profile-page addresses-page">
        <p className="breadcrumb">
          <Link to="/home">Home</Link>
          <span>/</span>
          <Link to="/account">My account</Link>
          <span>/</span>Addresses
        </p>
        <div className="section-head account-title">
          <div>
            <span className="eyebrow">DELIVERY DETAILS</span>
            <h1>Your addresses</h1>
            <p>Save delivery addresses and choose a default.</p>
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
        <div className="address-layout">
          <section className="panel saved-addresses">
            <div className="panel-head">
              <h2>Saved addresses</h2>
              <span>
                {addresses.length}{" "}
                {addresses.length === 1 ? "address" : "addresses"}
              </span>
            </div>
            {loading ? (
              <p className="address-empty">Loading addresses…</p>
            ) : addresses.length === 0 ? (
              <div className="address-empty">
                <span aria-hidden="true">⌂</span>
                <b>No saved addresses yet</b>
                <p>Add an address to keep your delivery details handy.</p>
              </div>
            ) : (
              addresses.map((address) => (
                <article className="saved-address-card" key={address._id}>
                  <div className="saved-address-head">
                    <b>{address.label}</b>
                    {address.isDefault && (
                      <span className="status-pill">Default</span>
                    )}
                  </div>
                  <strong>{address.fullName}</strong>
                  <small>{address.phone}</small>
                  <p>
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}
                    <br />
                    {address.city}, {address.state} {address.postalCode}
                    <br />
                    {address.country}
                  </p>
                  <div className="address-actions">
                    <button
                      className="outline-btn"
                      onClick={() => edit(address)}
                    >
                      Edit
                    </button>
                    {!address.isDefault && (
                      <button
                        className="outline-btn"
                        disabled={busy}
                        onClick={() => makeDefault(address)}
                      >
                        Set default
                      </button>
                    )}
                    <button
                      className="address-delete"
                      disabled={busy}
                      onClick={() => remove(address)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
          <section className="panel" id="address-form">
            <div className="panel-head">
              <h2>{editingId ? "Edit address" : "Add an address"}</h2>
              <span>Fields marked with * are required.</span>
            </div>
            <form className="account-form" onSubmit={submit}>
              <label className="account-field">
                Address label
                <input
                  value={form.label}
                  onChange={setField("label")}
                  placeholder="Home, work, etc."
                  maxLength={40}
                />
              </label>
              <label className="account-field">
                Full name *
                <input
                  required
                  value={form.fullName}
                  onChange={setField("fullName")}
                  maxLength={80}
                />
              </label>
              <label className="account-field">
                Phone number *
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={setField("phone")}
                  maxLength={30}
                />
              </label>
              <label className="account-field">
                Address line 1 *
                <input
                  required
                  autoComplete="address-line1"
                  value={form.line1}
                  onChange={setField("line1")}
                  maxLength={160}
                />
              </label>
              <label className="account-field">
                Address line 2
                <input
                  autoComplete="address-line2"
                  value={form.line2}
                  onChange={setField("line2")}
                  maxLength={160}
                />
              </label>
              <div className="address-form-row">
                <label className="account-field">
                  City *
                  <input
                    required
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={setField("city")}
                    maxLength={80}
                  />
                </label>
                <label className="account-field">
                  State *
                  <input
                    required
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={setField("state")}
                    maxLength={80}
                  />
                </label>
              </div>
              <div className="address-form-row">
                <label className="account-field">
                  Postal code *
                  <input
                    required
                    autoComplete="postal-code"
                    value={form.postalCode}
                    onChange={setField("postalCode")}
                    maxLength={20}
                  />
                </label>
                <label className="account-field">
                  Country
                  <input
                    autoComplete="country-name"
                    value={form.country}
                    onChange={setField("country")}
                    maxLength={60}
                  />
                </label>
              </div>
              <label className="default-check">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={setField("isDefault")}
                />{" "}
                Set as my default address
              </label>
              <div className="address-form-actions">
                <button className="btn account-save" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : editingId
                      ? "Save address"
                      : "Add address"}
                </button>
                {editingId && (
                  <button
                    className="outline-btn"
                    type="button"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}

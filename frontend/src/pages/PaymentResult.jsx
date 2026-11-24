import { Link, useSearchParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
export default function PaymentResult({ success }) {
  const [params] = useSearchParams();
  const id = params.get("orderId");
  return (
    <>
      <SiteHeader />
      <main className="catalog-page cart-page">
        <section
          className="cart-summary"
          style={{ maxWidth: 620, margin: "50px auto", textAlign: "center" }}
        >
          <span className="eyebrow">
            {success ? "PAYMENT COMPLETE" : "PAYMENT NOT COMPLETED"}
          </span>
          <h1>
            {success
              ? "Your order is confirmed"
              : "Payment failed or was cancelled"}
          </h1>
          <p>
            {success
              ? "We have verified your payment and saved your order."
              : "Your order is saved. You can retry the payment from its details."}
          </p>
          {id && (
            <Link className="outline-btn" to={`/orders/${id}`}>
              {success ? "View order" : "Retry or view order"}
            </Link>
          )}
          <p>
            <Link to="/orders">Go to my orders</Link>
          </p>
        </section>
      </main>
    </>
  );
}

# MOBIX

## Start the project

1. Copy `backend/.env.example` to `backend/.env` and set `MONGO_URI` and a long random `JWT_SECRET`.
2. In one terminal, run `cd backend`, `npm install`, then `npm run dev`.
3. In another terminal, run `cd frontend`, `npm install`, then `npm run dev`.

OTP codes are sent only by email and are never included in API responses or displayed in the app. Configure `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in `backend/.env` before using sign-up verification, password reset, or email-change verification. Without these settings, those actions return an email-configuration error instead of showing the OTP.

## Google sign-in

Create a **Web application** OAuth client in Google Cloud Console. Add `http://localhost:5173` to its authorized JavaScript origins (and your deployed frontend origin when deploying). Put the client ID in both `frontend/.env` as `VITE_GOOGLE_CLIENT_ID` and `backend/.env` as `GOOGLE_CLIENT_ID`, then restart both servers. The login and signup pages verify Google's signed ID token in the backend before creating a session. No client secret is used in the browser.

## Administrator access

Create a regular account and verify its email, then run from `backend`:

```sh
npm run make-admin -- your-email@example.com
```

Open `/admin/login` to sign in. Administrator promotion is intentionally available only through the backend command, not public registration.

## Week 1 scope

- Customer sign-up with expiring email OTP, resend cooldown, and attempt limits.
- Sign-in, password reset, profile editing, password changes, email-change verification, and address management.
- Admin-only sign-in and routes, paginated newest-first user search, and confirmed block/unblock controls.
- Blocked accounts are rejected by the API authentication middleware.

The storefront product list uses sample catalogue data.

## Week 2: checkout, orders, payments, and inventory

- Checkout uses saved delivery addresses and server-calculated product totals. Shipping is ₹99 below ₹5,000 and free from ₹5,000; listed prices include taxes.
- Cash on Delivery and Razorpay checkout create one idempotent order. Failed Razorpay attempts can be retried on that same order.
- Customers can search and view their orders, cancel eligible unpaid orders, request returns after delivery, and download an invoice PDF.
- MOBIX Wallet tracks a rupee balance and recent top-ups, wallet purchases, wallet refunds, and external order refunds. Top-ups use Razorpay and are credited only after server-side signature and captured-payment verification; top-ups are ₹10–₹50,000.
- Customers can pay with wallet balance at checkout when it covers the order total. Eligible wallet order cancellations and completed returns credit the balance back.
- Administrators can search, filter, paginate, and review orders, move orders through permitted fulfillment transitions, and accept or reject return requests.
- Stock is reserved atomically at order creation, restored after eligible cancellation, and restored after an accepted return is marked received. A unique request key and database transaction prevent duplicate processing and overselling.
- After an administrator validates receipt of a returned Razorpay order, a separate refund action initiates a full refund to the original payment method. Refund requests use Razorpay idempotency and are recorded in the order history. Cash-on-delivery refunds require an offline transfer.
- Razorpay is optional. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `backend/.env` to enable online payments and wallet top-ups. Keep the secret server-side. Cash on Delivery and existing wallet-balance payments work without Razorpay credentials.
- Admin product create/update requires exactly 3 uploaded images. Older demo products with fewer images are marked in the catalogue; edit each one and upload the missing images before saving.

### MongoDB transaction requirement

Order placement and stock updates use MongoDB transactions. MongoDB transactions require a replica set, including during local development. For a single-node local database, start MongoDB with replica-set support and initialize it once with `rs.initiate()`. Use a replica-set URI in `MONGO_URI`.

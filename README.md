# TTM.001 Store Upgrade

This is a starter upgrade for the existing TTM.001 HTML/CSS/JS store. It includes a responsive catalogue, category filters, a local cart, collection archive, and a Node/Express server-side Paystack checkout example.

## Before you start
- Node.js 20+
- A Paystack business account that is enabled for your market/currency
- HTTPS hosting for the website and backend
- A persistent database/storage plan before production
- Real product photography, sizes, inventory and shipping rules

## Run locally
1. Unzip this project.
2. In the project folder, run `npm install`.
3. Copy `.env.example` to `.env`.
4. Put your **Paystack test secret key** in `.env`; never use a live key for local testing.
5. Set `PUBLIC_BASE_URL` to your HTTPS development tunnel or deployed HTTPS URL. Checkout intentionally refuses to start without HTTPS.
6. Run `npm start`.
7. Open `http://localhost:3000` to inspect the catalogue. Checkout requires the server and valid provider configuration.

## Files
- `public/index.html`: storefront structure
- `public/style.css`: responsive black/white/yellow brand styling
- `public/app.js`: filters, cart, size selection and checkout redirect
- `server.js`: catalog, order creation, payment initialization, webhook signature check and server-side verification
- `public/payment-return.html`: payment status screen
- `.env.example`: environment variable template

## Critical production work still required
This is a starter, not a production-certified store. It deliberately does not claim that a payment integration is ready for live use.

1. **Persistent database:** replace `data/orders.json` with PostgreSQL or another managed database. A local JSON file is not safe for concurrent writes and may be ephemeral on hosted platforms.
2. **Inventory:** add stock by SKU/size and reserve/decrement stock transactionally. The current catalogue has no stock control.
3. **Webhook reliability:** add event idempotency, structured logging, retries and monitoring; verify payment status, currency, amount and reference before fulfilling an order.
4. **Order privacy/admin:** add an authenticated admin area, restricted order access, rate limiting, input validation, abuse protection and secure backups.
5. **Shipping/tax/refunds:** implement shipping calculations, delivery zones, return/refund process and customer emails.
6. **Legal:** publish accurate contact details, privacy notice, terms, delivery/returns policy and any required business disclosures for South Africa.
7. **Payment provider:** configure your webhook URL as `https://YOUR_DOMAIN/api/paystack/webhook`; test successful, failed, abandoned, duplicate and delayed webhook events. Confirm provider onboarding, currency support and fees with Paystack.
8. **Secrets:** store `PAYSTACK_SECRET_KEY` only in hosting environment variables. Do not commit `.env`, secrets or customer data.
9. **Hosting:** serve both frontend and API through the same HTTPS domain, or configure strict CORS if separated.
10. **Test first:** use test keys and test transactions; switch to live only after end-to-end tests and domain/provider approval.

## Product data
Product prices in `server.js` are server-authoritative and expressed in cents (e.g. `35000` = R350.00). Update product names, prices and sizes there and replace blank image values with the real product image paths/URLs. Never trust a price sent by the browser.

## Suggested release workflow
- Commit existing project to GitHub before replacing files.
- Create a feature branch and test changes on a preview deployment.
- Verify mobile layout, keyboard access, cart persistence, checkout, webhooks and order emails.
- Merge to the production branch only after all checks pass.

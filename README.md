# Shri Ganga Silage Ankalgi — Full Stack Website

This version adds customer accounts, delivery details, checkout, order history and a main-office admin order dashboard.

## Requirements
- Node.js 18+ (Node 20+ recommended)
- VS Code

## Run on Windows
1. Extract this folder.
2. Open **this folder** in VS Code — the folder containing `package.json` and `server.js`.
3. Open Terminal.
4. Run:

```powershell
npm install
npm start
```

5. Open `http://localhost:3000`

## Main office
Open `http://localhost:3000/admin`.

Default development password:
`change-me-before-production`

For real use, create `.env` beside `package.json`:

```text
PORT=3000
ADMIN_PASSWORD=your-strong-password
```

## Customer flow
1. Customer browses a crop variety.
2. Customer chooses quantity and clicks **Buy now**.
3. If not logged in, the customer creates an account or logs in.
4. Checkout asks for full delivery details: name, phone, address, village, taluk, district, state, pincode and landmark.
5. Order is saved in `data/db.json`.
6. Customer can see the order and status at **My Account**.
7. Main office sees the order in `/admin` with customer contact, items, total and full delivery address.
8. Main office can move the order through pending → confirmed → processing → ready → out-for-delivery → completed, or cancel it.

## Important
This is a local/demo backend using a JSON data store. For public production deployment, move customer data and passwords to a proper database and add HTTPS, secure cookies/session storage, rate limiting and production authentication controls.

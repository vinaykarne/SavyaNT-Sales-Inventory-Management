# SavyaNT Sales Order & Inventory Management — Frontend Prototype

A React + TypeScript + Vite frontend prototype for the Sales Order & Inventory Management assignment. This version uses browser `localStorage` for demo data; it is not connected to a Python backend or MySQL database.

## Requirements
- Node.js 20.19+ (recommended for the Vite version in this project)
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:3000`).

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@savya.com` | `Admin123` |
| Sales User | `sales@savya.com` | `Sales123` |

Demo records are seeded into browser storage on first launch. Use **Settings → Reset Demo Data** to restore the original sample dataset. Resetting removes changes made in that browser profile.

## Frontend modules
- Dashboard
- Customers and Products
- Sales Orders, Order Details, and Invoice
- Inventory and Stock Movements
- Reports
- Product CSV Import
- Settings and demo-user switching

## Notes and limitations
- Data is stored locally in the browser. Clearing site data or using another browser/device will not share records.
- Frontend role checks are for prototype behavior only. They are not secure authorization; a real application must enforce permissions on the server.
- The local multi-record storage helper attempts rollback if a browser-storage write fails. It cannot provide database-grade transactions, concurrency control, or protection against simultaneous users.
- Do not use real customer or business data with this demo.
- A production/assignment-complete version still needs the required Python backend, MySQL schema, REST APIs, server-side authorization, and automated backend tests.

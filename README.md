# BloodConnect — Blood Donor Management & Search System

A full-stack healthcare blood donor management and search platform built with **React**, **Tailwind CSS**, **Node.js**, **Express**, and **MongoDB** (with automatic local persistent JSON-document storage fallback when `MONGODB_URI` is not set).

## Features

- **Privacy-First Donor Search**: Filter donors by blood group (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`), state, district, city, area/pincode, availability, and nearest location without exposing personal phone numbers publicly.
- **Consent-Based Contact Requests**: Requesters submit hospital details and receive a tracking code (`BC-REQ-...`). Donor phone/email is revealed only if the donor explicitly accepts the request in their dashboard.
- **Donor Registration & Personal Dashboard**: 14-field validated registration, salted `scrypt` password hashing, availability toggle, profile/location updates, incoming request management, search history, password change, and account deletion.
- **Administrator Portal & Full CRUD**: Protected admin dashboard (`/admin-login` → `/admin`) with live statistics, full donor CRUD, verification queue, emergency request moderation, and flagged record review.
- **Emergency Blood Request & Status Tracker**: Publish urgent hospital blood requests (`/emergency`) and track contact or emergency request status by tracking code.

---

## Running Locally

Requires **Node.js 22+**.

```bash
# 1. Install dependencies
npm install

# 2. Optional: copy .env.example to .env and configure MONGODB_URI / ADMIN_EMAIL / ADMIN_PASSWORD
cp .env.example .env

# 3. Start the full-stack development server (Express API + Vite frontend)
npm run dev
```

Open **http://localhost:3000** in your browser.

### Production Build & Start

```bash
npm run build
NODE_ENV=production npm start
```

---

## Deploying From GitHub

> **Important Note on GitHub Pages**: GitHub Pages only hosts static HTML/CSS/JS files and **cannot run a Node.js + Express backend (`server.ts`) or MongoDB**. Enabling GitHub Pages directly on this repository will result in a blank page or failed `/api/*` requests.

To host this full-stack application live from your GitHub repository, deploy it as a **Node.js Web Service** (free tiers available on **Render**, **Railway**, or **Google Cloud Run**):

### Example: Deploy on Render (Free Web Service)
1. Push this repository to GitHub.
2. In [Render](https://render.com), choose **New → Web Service** and connect your GitHub repository.
3. Configure:
   - **Runtime**: `Node` (Node 22+)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = *(optional MongoDB Atlas connection string for persistent cloud storage)*
   - `MONGODB_DB_NAME` = `bloodconnect`
   - `ADMIN_EMAIL` = *(your administrator email)*
   - `ADMIN_PASSWORD` = *(your administrator password)*
5. Click **Create Web Service**.

---

## Medical Disclaimer

Donor availability, health eligibility, and blood compatibility must always be confirmed directly with the donor and a licensed hospital blood bank before transfusion. BloodConnect facilitates donor discovery and consent-based coordination only and does not replace medical screening or professional medical advice.

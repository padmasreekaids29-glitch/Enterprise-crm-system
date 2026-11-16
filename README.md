# NEXORA CRM — Enterprise Customer Relationship Management Platform

NEXORA CRM is a full-stack enterprise CRM web application built with React, Vite, Tailwind CSS, Recharts, Node.js, Express.js, MongoDB/Mongoose, and JWT/bcrypt authentication.

## Project Structure

```text
├── backend/
│   ├── config/db.ts              # Mongoose connector (MONGODB_URI or embedded MongoDB fallback)
│   ├── models/                   # User, Team, Lead, Customer, Deal, Activity, AuditLog
│   ├── middleware/               # JWT authenticate, RBAC authorize, validation, error handler
│   ├── controllers/              # Auth, Dashboard, Lead, Customer, Deal, Activity, Report, Admin, Settings
│   ├── routes/                   # Express REST routers (/api/*)
│   ├── seed/seedData.ts          # Initial enterprise seed dataset
│   ├── app.ts                    # Express app factory with CORS & error handling
│   ├── server.ts                 # Standalone backend server (port 5000)
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/           # Layout, Modal, ConfirmDialog, Avatar, EmptyState, Skeletons
│   │   ├── context/              # AuthContext (JWT), ToastContext
│   │   ├── pages/                # Login, Register, Dashboard, Leads, Customers, Pipeline, Activities, Reports, Admin, Settings
│   │   ├── services/api.ts       # Typed REST API client with Bearer token injection
│   │   ├── types/crm.ts          # Domain TypeScript interfaces
│   │   ├── utils/format.ts       # Currency & date formatters
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts            # Standalone Vite dev proxy to backend port 5000
│   ├── package.json
│   └── .env.example
├── server.ts                     # Unified full-stack server (port 3000)
├── index.html
├── package.json
└── .env.example
```

## Seeded Demo Credentials

All seeded accounts share the password **`Nexora@2026`**:
- **Admin**: `admin@nexoracrm.com` (Elena Vance — VP of Revenue Operations)
- **Manager**: `manager@nexoracrm.com` (Marcus Chen — Director of Enterprise Sales)
- **Sales Executive**: `sophia@nexoracrm.com` (Sophia Patel — Senior Account Executive)
- **Sales Executive**: `david@nexoracrm.com` (David Kim — Account Executive)

---

## Option A: Run Unified Full-Stack Server (Recommended)

From the project root:

```bash
cp .env.example .env
npm install
npm run dev
```

This starts both the Express REST API and the Vite frontend together on **http://localhost:3000**.
- If `MONGODB_URI` is provided in `.env`, Mongoose connects to your MongoDB Atlas or local `mongod` server.
- If `MONGODB_URI` is left blank, `mongodb-memory-server` automatically starts a real embedded MongoDB instance and seeds the database.

---

## Option B: Run Frontend and Backend Separately

### 1. Start the Backend Server

```bash
cd backend
cp .env.example .env
# Edit backend/.env with your MONGODB_URI and JWT_SECRET
npm install
npm run dev
```

The standalone Express API runs on **http://localhost:5000**.

### 2. Start the Frontend Client

In a second terminal:

```bash
cd frontend
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:5000 (or rely on Vite's /api proxy)
npm install
npm run dev
```

The standalone React + Vite UI runs on **http://localhost:5173** and communicates with the backend on port 5000.

---

## REST API Endpoints

- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET /api/dashboard/overview`
- `GET/POST /api/leads` · `PUT/DELETE /api/leads/:id` · `POST /api/leads/:id/convert`
- `GET/POST /api/customers` · `GET/PUT/DELETE /api/customers/:id`
- `GET/POST /api/deals` · `PUT/DELETE /api/deals/:id` · `PATCH /api/deals/:id/stage`
- `GET/POST /api/activities` · `PUT/DELETE /api/activities/:id` · `PATCH /api/activities/:id/toggle`
- `GET /api/reports/overview`
- `GET /api/admin/overview` · `POST/PUT/DELETE /api/admin/users` · `POST/PUT/DELETE /api/admin/teams`
- `PUT /api/settings/profile` · `PUT /api/settings/password` · `PUT /api/settings/preferences`

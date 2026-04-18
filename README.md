# ShiftSync — Frontline Workforce Management Platform

A full-stack workforce management platform inspired by Sona. Built with Next.js, Node.js/Express, PostgreSQL (Neon), Clerk auth, and Socket.io for real-time features.

---

## 🏗 Architecture

Epic → Feature → User Story methodology applied:

**Epic 1 — Auth & Organisation**
- Multi-role auth via Clerk (Admin / Manager / Employee)
- Organisation onboarding and member invitation

**Epic 2 — Smart Scheduling**
- Drag-and-drop calendar (react-big-calendar)
- Shift conflict detection
- Open shift management

**Epic 3 — Real-time Communications**
- Socket.io for live shift updates
- Shift swap requests
- Team announcements and messaging

**Epic 4 — Attendance & Payroll**
- Clock in/out per shift
- Automated timesheet generation
- Overtime detection
- Payroll dashboard

**Epic 5 — Analytics**
- Workforce utilization dashboard
- Shift coverage by day
- Labor cost tracking

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A Neon account (free at neon.tech)
- A Clerk account (free at clerk.com)

### 1. Clone and install

```bash
# Backend
cd backend
cp .env.example .env
npm install

# Frontend
cd ../frontend
cp .env.example .env.local
npm install
```

### 2. Set up environment variables

**backend/.env**
```
DATABASE_URL=your_neon_connection_string
CLERK_SECRET_KEY=sk_test_xxx
PORT=4000
FRONTEND_URL=http://localhost:3000
```

**frontend/.env.local**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 3. Set up database

```bash
cd backend
node src/db/setup.js   # Creates all tables
node src/db/seed.js    # Optional: adds demo data
```

### 4. Start development

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Visit http://localhost:3000

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, Tailwind CSS |
| Auth | Clerk |
| Backend | Node.js + Express |
| Database | PostgreSQL (Neon serverless) |
| Real-time | Socket.io |
| Calendar | react-big-calendar |
| Charts | Recharts |
| Deploy | Vercel + Railway |

---

## 📁 Project Structure

```
shiftsync/
├── backend/
│   ├── src/
│   │   ├── db/         # Raw SQL setup and seed
│   │   ├── middleware/ # Clerk auth middleware
│   │   ├── routes/     # Express routes
│   │   └── socket/     # Socket.io handler
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/        # Next.js App Router pages
    │   ├── components/ # Reusable UI components
    │   ├── hooks/      # useApi, useSocket
    │   └── lib/        # Utils
    └── package.json
```

---

## 🌍 Deploy

### Backend → Railway
1. Push backend folder to GitHub
2. Connect to Railway, add env vars
3. Deploy — Railway auto-detects Node.js

### Frontend → Vercel
1. Push frontend folder to GitHub
2. Connect to Vercel, add env vars
3. Deploy — auto-detects Next.js

---

## 💡 FAQ

- **Why Clerk?** Auth is solved — I focused engineering effort on the actual business logic (scheduling, real-time, payroll)
- **Why raw SQL over Prisma?** More control, better performance visibility, shows I understand the database layer directly
- **Real-time architecture?** Socket.io rooms scoped per organisation — org:${id} for broadcasts, user:${id} for private notifications
- **Conflict detection?** SQL time overlap check before creating shifts — catches overlapping assignments before they reach the DB
- **Epic planning?** Defined 5 Epics before writing any code — identified that real-time was its own Epic, not a feature of scheduling

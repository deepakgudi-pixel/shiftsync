# ShiftSync

ShiftSync is a full-stack workforce management platform designed for frontline teams, inspired by tools like Sona. It handles everything from smart scheduling and real-time team messaging to automated payroll and labor analytics.

---

## 🛠 The Tech Stack

I built this with a modern, scalable stack:
*   **Frontend:** Next.js 14 (App Router) + Tailwind CSS
*   **Backend:** Node.js & Express
*   **Auth:** Clerk (handles multi-role permissions: Admin, Manager, and Employee)
*   **Database:** PostgreSQL hosted on **Neon** (Serverless)
*   **Real-time:** Socket.io for instant shift updates and team messaging
*   **Visuals:** Recharts for analytics and `react-big-calendar` for the scheduling grid

---

## ✨ Key Features

*   **Smart Scheduling:** A drag-and-drop interface that prevents double-booking. If a manager tries to assign overlapping shifts, the system catches it at the database level using SQL interval checks.
*   **Real-time Team Sync:** Using WebSockets, the schedule updates instantly for everyone. If a shift is created or a swap is requested, you see it without refreshing.
*   **Audit Logging:** Comprehensive tracking of all system actions (CREATE, UPDATE, DELETE, CLOCK_IN/OUT) with detailed state diff views and IP tracking for administrative oversight.
*   **Member Management:** Admins can manage organisation settings, invite team members via unique Registry IDs, and assign system clearance roles.
*   **Live Analytics:** Dashboards showing workforce utilization, labor costs, and shift coverage gaps.
*   **Announcements & Messaging:** A high-visibility announcement board for broadcasting urgent updates or targeted messages to specific team members with real-time Socket.io delivery.

---

## 🚀 Getting Started

### 1. Installation
You'll need to install dependencies in both folders:
```bash
# Install backend
cd backend && npm install

# Install frontend
cd ../frontend && npm install
```

### 2. Environment Variables
Create a `.env` in the `backend` and a `.env.local` in the `frontend` using the provided credentials for Neon and Clerk.

**Backend (`backend/.env`):**
```env
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_test_...
PORT=4000
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 3. Database Setup
I've included a setup script to create the schema in your Neon instance:
```bash
cd backend
node src/db/setup.js
node src/db/seed.js # Optional: Adds test data
```

### 4. Running the App
Run the backend first, then the frontend:
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```
Head over to `http://localhost:3000` to see it in action.

---

## 🧠 Dev Notes

*   **Why Raw SQL?** I chose raw SQL over an ORM like Prisma for this project to maintain total control over performance and to implement complex overlap checks using Postgres-specific interval logic.
*   **Real-time logic:** Socket.io rooms are scoped by organisation (`org:${id}`). This ensures that announcements and shift updates are only broadcast to the correct team.
*   **Auth Flow:** Clerk handles the session, but I use a custom Express middleware on the backend to sync Clerk users with my local `members` table on their first sign-in.

---

## 📁 Folder Structure

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

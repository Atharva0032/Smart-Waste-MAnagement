# Smart Waste Management System

A production-ready **MERN** (MongoDB · Express · React · Node) web application that lets citizens report civic waste problems with a photo and GPS location, lets municipal authorities triage and dispatch those reports, and lets field workers close them out with proof-of-completion photos.

Reports are screened by an **AI image-verification pipeline** before they ever reach the municipal dashboard, and every complaint carries a full audit timeline.

---

## Table of Contents

1. [Features](#1-features)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Quick Start](#5-quick-start)
6. [Environment Variables](#6-environment-variables)
7. [Seeding Demo Data](#7-seeding-demo-data)
8. [AI Waste Verification](#8-ai-waste-verification)
9. [API Overview](#9-api-overview)
10. [Deployment](#10-deployment)
11. [Troubleshooting](#11-troubleshooting)
12. [License](#12-license)

---

## 1. Features

### Citizen (User) Module
- Registration and login with **JWT** authentication and **bcrypt** password hashing.
- Personal dashboard with complaint counters and recent activity.
- **Submit a complaint** with:
  - Waste image upload (drag & drop, client-side preview).
  - Waste-type selection (7 categories).
  - Free-text description.
  - GPS location captured from the browser, or hand-picked on an interactive map.
  - Live **AI waste check** with a confidence percentage before submission.
- **View complaint status** on a tracking timeline.
- **Complaint history** with search, filters and details.
- Delete a complaint while it is still `pending`.

### Admin Module
- Admin login into a dedicated municipal console.
- **Statistics dashboard**: totals per status, waste-type breakdown, area breakdown, 7-day trend chart, average resolution time.
- **View all complaints** with text search and pagination.
- **Filter** complaints by status and area.
- **Assign** a complaint to any field worker (live workload is shown to help balance dispatch).
- **Update status**: `pending` → `assigned` → `in_progress` → `resolved` (plus `rejected`).
- **Delete false complaints** — permanently.
- Manage worker accounts (create / update / deactivate / delete) and citizen accounts (activate / suspend).

### Worker Module
- Worker login.
- **View assigned complaints** with workload summary.
- Advance a job to `in_progress`.
- **Upload a completion photo** and mark the complaint as `resolved`.

### Platform / Advanced Features
- **Interactive OpenStreetMap** via React Leaflet — a location picker for reporting and a multi-marker overview map for administrators.
- **Multer**-based image uploads with MIME allow-listing and a 5 MB size cap.
- **Email notifications** through Nodemailer (gracefully degrades to console logging when SMTP is unconfigured).
- **Responsive design** — mobile-first layouts, collapsible sidebar, touch-friendly controls.
- **Dark and light theme** with persistence and system-preference detection.
- **Role-based access control** enforced on both the API (`protect` + `authorize`) and the client (`ProtectedRoute`).
- **Complaint tracking timeline** — every status change is appended with actor, note and timestamp.
- In-app **notification centre** with unread badge.

---

## 2. Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 6, Axios |
| Styling | Tailwind CSS 3, Material UI icons (`@mui/icons-material`) |
| Charts | Recharts |
| Maps | React Leaflet 4 + Leaflet 1.9 (OpenStreetMap tiles) |
| State | React Context API (`AuthContext`, `ThemeContext`) |
| Backend | Node.js 18+, Express 4 |
| Database | MongoDB + Mongoose 8 |
| Auth | JSON Web Tokens (`jsonwebtoken`) + `bcryptjs` |
| Uploads | Multer 2 |
| AI | TensorFlow.js (`@tensorflow/tfjs-node` + `@tensorflow-models/mobilenet`), with a `jimp` colour/texture heuristic fallback |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |

---

## 3. Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────────────────┐
│  React SPA (Vite)           │        │  Express REST API                        │
│                             │        │                                          │
│  pages/  ── React Router    │  HTTP  │  routes/      → URL + validation         │
│  context/ ── Auth + Theme   │ ─────► │  controllers/ → business logic (MVC)     │
│  services/ ── Axios         │  JSON  │  models/      → Mongoose schemas         │
│  components/ ── UI + Leaflet│        │  middleware/  → auth, role, upload, error│
└─────────────────────────────┘        │  utils/       → AI classifier, mail, …   │
                                       └───────────────┬──────────────────────────┘
                                                       │
                          ┌────────────────────────────┼────────────────────────────┐
                          ▼                            ▼                            ▼
                   ┌─────────────┐            ┌────────────────┐          ┌──────────────────┐
                   │ MongoDB     │            │ uploads/ (disk)│          │ AI: MobileNetV2  │
                   │ (Atlas)     │            │ waste + proof  │          │ or heuristic     │
                   └─────────────┘            └────────────────┘          └──────────────────┘
```

**Request lifecycle:** `helmet` → `cors` → body parsers → request log → `/uploads` static → rate limiter → route → `validate` → controller → central error handler.

---

## 4. Project Structure

```
Smart Waste Management System/
├── backend/
│   ├── config/
│   │   ├── db.js                  # Mongoose connection with retry + events
│   │   └── env.js                 # Centralised, typed environment config
│   ├── controllers/
│   │   ├── authController.js      # register, login, getMe, updateProfile
│   │   ├── complaintController.js # create, my complaints, detail, public track, delete
│   │   ├── adminController.js     # stats, complaints, assignment, workers, users
│   │   ├── workerController.js    # assigned jobs, status, resolution
│   │   ├── notificationController.js
│   │   └── aiController.js        # image verification endpoint
│   ├── middleware/
│   │   ├── authMiddleware.js      # protect, optionalAuth
│   │   ├── roleMiddleware.js      # authorize('admin'|'worker'|'user')
│   │   ├── uploadMiddleware.js    # Multer disk + memory storage
│   │   ├── validateMiddleware.js  # express-validator runner
│   │   └── errorMiddleware.js     # notFound + central error handler
│   ├── models/
│   │   ├── User.js                # base account (role, bcrypt hooks)
│   │   ├── Admin.js               # admin profile + permissions
│   │   ├── Worker.js              # worker profile + workload counters
│   │   ├── Complaint.js           # complaint, timeline, AI verification
│   │   └── Notification.js
│   ├── routes/
│   │   ├── index.js               # mounts all routers + /health
│   │   ├── authRoutes.js          # /api/auth
│   │   ├── complaintRoutes.js     # /api/complaints
│   │   ├── adminRoutes.js         # /api/admin
│   │   ├── workerRoutes.js        # /api/workers
│   │   ├── notificationRoutes.js  # /api/notifications
│   │   └── aiRoutes.js            # /api/ai
│   ├── uploads/                   # uploaded waste + completion photos
│   ├── utils/
│   │   ├── apiError.js
│   │   ├── fileHelper.js
│   │   ├── generateToken.js
│   │   ├── notify.js
│   │   ├── sendEmail.js           # Nodemailer + HTML templates
│   │   └── wasteClassifier.js     # TensorFlow.js MobileNet + heuristic fallback
│   ├── .env.example
│   ├── package.json
│   ├── seed.js                    # demo accounts + sample complaints
│   └── server.js                  # application bootstrap
│
├── frontend/
│   ├── src/
│   │   ├── components/            # 19 reusable UI components
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── pages/
│   │   │   ├── admin/             # AdminDashboard, AdminComplaints, AdminWorkers
│   │   │   ├── user/              # UserDashboard, SubmitComplaint, MyComplaints, ComplaintDetail
│   │   │   ├── worker/            # WorkerDashboard, WorkerComplaints
│   │   │   └── Landing, Login, Register, TrackComplaint, Unauthorized, NotFound
│   │   ├── services/              # Axios API layer
│   │   ├── utils/                 # constants, formatters, validators
│   │   ├── App.jsx                # all routes
│   │   ├── index.css              # Tailwind + Leaflet styles
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vercel.json                # SPA rewrites for Vercel
│   └── vite.config.js
│
├── API_DOCUMENTATION.md           # full endpoint reference
└── README.md
```

---

## 5. Quick Start

### Prerequisites

| Requirement | Version |
| --- | --- |
| Node.js | 18 or newer |
| npm | 9 or newer |
| MongoDB | Local `mongod` **or** a free MongoDB Atlas cluster |

### 5.1 Clone and install

```bash
git clone <your-repository-url>
cd "Smart Waste Management System"
```

**Backend**

```bash
cd backend
npm install
```

> `@tensorflow/tfjs-node` and `@tensorflow-models/mobilenet` are declared as
> **optional dependencies**. If the native TensorFlow binding cannot be built on
> your machine, the install still succeeds and the API automatically uses the
> built-in heuristic classifier. See [AI Waste Verification](#8-ai-waste-verification).

**Frontend**

```bash
cd ../frontend
npm install
```

### 5.2 Configure the backend

```bash
cd ../backend
cp .env.example .env
```

Open `backend/.env` and set at minimum:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/smart_waste_db
JWT_SECRET=<paste a 64-character random string here>
CLIENT_URL=http://localhost:5173
```

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 5.3 Configure the frontend

```bash
cd ../frontend
cp .env.example .env
```

`frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 5.4 No local MongoDB? Use the in-memory launcher

If MongoDB is not installed, the backend will refuse to start (it fails fast rather
than serving requests against a dead connection). For a zero-setup demo you can boot
an **ephemeral in-memory MongoDB** instead — it starts a real `mongod` process, seeds
the demo data, and throws everything away when you stop it:

```bash
cd backend
npm run dev:memory                 # in-memory MongoDB + seed + API server
npm run dev:memory -- --no-seed    # skip seeding
```

You then only need the frontend in a second terminal (step 5.6). This is a local
development convenience only — **never** use it for production, and all data is lost
on restart. It relies on the `mongodb-memory-server` dev dependency, which downloads a
`mongod` binary on first run (~100 MB, cached under `~/.cache/mongodb-binaries`).

### 5.5 Seed demo data (recommended)

```bash
cd ../backend
npm run seed          # add demo data to the existing database
npm run seed -- --fresh   # WIPE collections first, then seed
```

### 5.6 Run both servers

Terminal 1 — API:

```bash
cd backend
npm run dev
```

Terminal 2 — web app:

```bash
cd frontend
npm run dev
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000/api |
| Health probe | http://localhost:5000/api/health |

Production builds:

```bash
cd frontend && npm run build && npm run preview   # serves frontend/dist on :4173
cd backend  && npm start                          # plain Node, no nodemon
```

---

## 6. Environment Variables

### `backend/.env`

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `5000` | HTTP port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/smart_waste_db` | MongoDB connection string |
| `JWT_SECRET` | — | **Required.** Signing secret, 32+ chars |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `BCRYPT_SALT_ROUNDS` | `10` | Password hashing cost |
| `CLIENT_URL` | `http://localhost:5173` | Primary allowed CORS origin |
| `CLIENT_URLS` | see `.env.example` | Extra allowed origins, comma separated |
| `MAX_FILE_UPLOAD_MB` | `5` | Upload size cap |
| `UPLOAD_DIR` | `uploads` | Directory for stored images |
| `AI_VERIFY_ENABLED` | `true` | Enable AI screening on complaint creation |
| `AI_MIN_CONFIDENCE` | `60` | Confidence below this is flagged as suspicious |
| `AI_REJECT_INVALID` | `false` | When `true`, reject a complaint if AI says "not waste" |
| `SMTP_HOST` | *(empty)* | Leave empty to log emails instead of sending |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | `true` for port 465 |
| `SMTP_USER` / `SMTP_PASS` | — | SMTP credentials |
| `MAIL_FROM` | `Smart Waste Management System <no-reply@swms.gov>` | Sender identity |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@swms.gov` / `Admin@123` | Seed overrides |
| `SEED_WORKER_EMAIL` / `SEED_WORKER_PASSWORD` | `worker@swms.gov` / `Worker@123` | Seed overrides |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | `user@swms.gov` / `User@123` | Seed overrides |

### `frontend/.env`

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000/api` | Base URL of the backend API |

---

## 7. Seeding Demo Data

`npm run seed` creates a complete, realistic dataset:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@swms.gov` | `Admin@123` |
| Field worker | `worker@swms.gov` | `Worker@123` |
| Field worker | `worker2@swms.gov` | `Worker@123` |
| Citizen | `user@swms.gov` | `User@123` |
| Citizen | `citizen2@swms.gov` | `User@123` |

It also generates the matching `Admin` / `Worker` profile documents, five sample complaints across different statuses (with placeholder images written into `backend/uploads/`) and a couple of notifications.

> ⚠️ `npm run seed -- --fresh` **deletes** all users, complaints and notifications in the target database. Never run it against production data.

---

## 8. AI Waste Verification

Every submitted photo passes through a two-stage pipeline in
[`backend/utils/wasteClassifier.js](file:///s:/INNOVATION%20Project/Smart%20Waste%20Management%20System/backend/utils/wasteClassifier.js).

### Engine 1 — TensorFlow.js MobileNetV2 (primary)

- Loads `@tensorflow-models/mobilenet` (version 2, alpha 1.0), pre-trained on ImageNet.
- Decodes the upload with `tf.node.decodeImage`, runs `classify(tensor, 10)` and always
  disposes the tensor.
- The top-10 labels are matched against a curated `WASTE_KEYWORDS` list
  (`plastic`, `cardboard`, `bottle`, `garbage`, `trash`, `refuse`, `dump`, `compost`,
  `bag`, `crate`, …) and against a `NEGATIVE_KEYWORDS` list (`person`, `sky`, `dog`,
  `car`, `face`, …).
- `engine` in the response is reported as `"mobilenet-v2"`.

### Engine 2 — Jimp colour/texture heuristic (fallback)

If TensorFlow.js cannot be loaded, the classifier transparently switches to a
deterministic image-analysis engine:

- Converts the image to a small raster with **jimp** and computes saturation,
  colour vividness, and the proportion of green / brown / grey / sky pixels, plus
  edge density.
- Scores those metrics into a `0–100` confidence band.
- `engine` in the response is reported as `"heuristic"`.

### Response contract (both engines)

```json
{
  "success": true,
  "isWaste": true,
  "confidence": 67,
  "label": "plastic-packaging-waste",
  "engine": "heuristic",
  "model": "jimp-color-texture-heuristic",
  "labels": [],
  "message": "Waste detected with 67% confidence."
}
```

### Behaviour

| Setting | Effect |
| --- | --- |
| `AI_VERIFY_ENABLED=false` | Skips screening entirely and records the complaint as unverified |
| `AI_REJECT_INVALID=true` | Rejects the request with `422` when `isWaste` is `false`, and deletes the uploaded file |
| `AI_MIN_CONFIDENCE` | Values below this are surfaced as "low confidence" in the UI |

The frontend calls `POST /api/ai/verify` as soon as the citizen selects an image, so
invalid photos are caught **before** the form is submitted. The server re-runs the
check on `POST /api/complaints` — the client can never be trusted as the source of truth.

> **Note for Windows developers:** `@tensorflow/tfjs-node` needs either a prebuilt
> native binary for your exact Node version or a C++ toolchain (Visual Studio with the
> *Desktop development with C++* workload) to compile from source. If neither is
> available the module is skipped and the heuristic engine takes over automatically.
> On Linux hosts such as Render the prebuilt binary installs cleanly, so production
> runs the real MobileNetV2 model.

---

## 9. API Overview

Base URL: `http://localhost:5000/api`

| Group | Prefix | Highlights |
| --- | --- | --- |
| System | `/api/health` | Liveness + DB state + active AI engine |
| Auth | `/api/auth` | `register`, `login`, `me`, `profile` |
| Complaints | `/api/complaints` | create (multipart), `my`, public `track/:trackingId`, detail, delete |
| Admin | `/api/admin` | `stats`, complaint filters, assign, status, delete, workers, users |
| Workers | `/api/workers` | `assigned`, `profile`, `resolve` (multipart), `status` |
| Notifications | `/api/notifications` | list, `read-all`, read one, delete |
| AI | `/api/ai` | `verify` (multipart), `status` |

**Response envelope**

```json
{ "success": true, "message": "Complaint submitted successfully.", "complaint": { } }
```

**Error envelope**

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [{ "field": "email", "message": "Please provide a valid email address." }]
}
```

All protected routes expect `Authorization: Bearer <token>`.

👉 **See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for the complete request/response
reference for all 32 endpoints.**

---

## 10. Deployment

The three pieces deploy independently: **database → API → web app**.

### 10.1 Database → MongoDB Atlas

1. Sign in at <https://cloud.mongodb.com> and create a **free M0 cluster**.
2. **Database Access** → *Add New Database User* → create a user with
   *Read and write to any database* and save the password.
3. **Network Access** → *Add IP Address* → allow `0.0.0.0/0`
   (or restrict it to Render's outbound IPs later).
4. **Clusters → Connect → Drivers** and copy the connection string. Add the database
   name before the query string:

   ```text
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/smart_waste_db?retryWrites=true&w=majority
   ```

   URL-encode any special characters in the password (`@` → `%40`, `#` → `%23`, …).

### 10.2 Backend → Render

1. Push the repository to GitHub.
2. In Render choose **New → Web Service** and connect the repository.
3. Configure:

   | Setting | Value |
   | --- | --- |
   | **Root Directory** | `backend` |
   | **Runtime** | Node |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Health Check Path** | `/api/health` |

4. Add the **Environment Variables** (Render → *Environment*):

   ```env
   NODE_ENV=production
   PORT=10000
   MONGO_URI=mongodb+srv://...
   JWT_SECRET=<64-character random string>
   JWT_EXPIRES_IN=7d
   CLIENT_URL=https://your-app.vercel.app
   CLIENT_URLS=https://your-app.vercel.app
   AI_VERIFY_ENABLED=true
   AI_MIN_CONFIDENCE=60
   AI_REJECT_INVALID=false
   ```

   Optional SMTP block: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
   `SMTP_PASS`, `MAIL_FROM`.

5. Deploy and confirm `https://<service>.onrender.com/api/health` returns
   `"success": true`. The `ai.engine` field reports which classifier is live.

> **⚠️ Ephemeral disk:** Render's default filesystem is wiped on every deploy, so
> uploaded images stored in `backend/uploads/` are lost on redeploy. For production,
> add a persistent Render Disk mounted at `/opt/render/project/src/backend/uploads`,
> or move storage to Cloudinary / AWS S3 by swapping the Multer storage engine in
> [`uploadMiddleware.js`](file:///s:/INNOVATION%20Project/Smart%20Waste%20Management%20System/backend/middleware/uploadMiddleware.js).

> **Build note:** `@tensorflow/tfjs-node` downloads a prebuilt Linux binary during
> `npm install`, which normally succeeds on Render. If the build ever fails because of
> it, remove the package from `optionalDependencies` — the API keeps working through
> the heuristic engine.

### 10.3 Frontend → Vercel

1. In Vercel choose **Add New → Project** and import the same repository.
2. Configure:

   | Setting | Value |
   | --- | --- |
   | **Root Directory** | `frontend` |
   | **Framework Preset** | Vite |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |
   | **Install Command** | `npm install` |

3. Add the environment variable:

   ```env
   VITE_API_URL=https://<your-service>.onrender.com/api
   ```

4. Deploy. SPA deep links such as `/track/SWM-ABC123` are handled by the rewrite rule
   already committed in [`frontend/vercel.json`](file:///s:/INNOVATION%20Project/Smart%20Waste%20Management%20System/frontend/vercel.json):

   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

### 10.4 Post-deploy checklist

1. `GET https://<api>.onrender.com/api/health` → `success: true`, `database: "connected"`.
2. Register a new citizen on the live frontend and submit a complaint with a photo.
3. Confirm the AI confidence badge renders and the complaint appears in the admin console.
4. Sign in as `admin@swms.gov` and assign the complaint to a worker.
5. Sign in as `worker@swms.gov`, upload a completion photo and mark it resolved.
6. Re-check the citizen's tracking timeline to confirm the full lifecycle was recorded.

### 10.5 Docker (optional)

Both services are plain Node apps, so a minimal `Dockerfile` per directory is enough:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

Deploy the same image to Render as a *Web Service* with the *Docker* runtime, or
`docker run -p 5000:5000 --env-file .env <image>` locally.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `MongooseServerSelectionError` on boot | MongoDB not running / wrong URI | Start `mongod` or fix `MONGO_URI`; for Atlas, allow your IP |
| `401 Not authorized` on every request | Missing/expired JWT | Sign in again; the client clears the session on `401` automatically |
| `403 You do not have permission` | Wrong role for the route | Use the correct demo account (`admin@` / `worker@` / `user@`) |
| CORS error in the browser | Frontend origin not allowed | Add it to `CLIENT_URL` / `CLIENT_URLS` and restart the API |
| AI endpoint reports `"engine": "heuristic"` | Native TensorFlow.js unavailable | Expected on Windows without a C++ toolchain; everything still works. On Linux/Render the MobileNetV2 engine loads automatically |
| `[ai] TensorFlow.js MobileNet unavailable…` in the log | Same as above | Informational warning only — the heuristic engine takes over |
| Images 404 after a Render redeploy | Ephemeral disk | Attach a persistent disk or move to object storage |
| `413` / `MulterError: File too large` | Upload exceeds 5 MB | Raise `MAX_FILE_UPLOAD_MB` or compress the photo |
| Blank page on a Vercel deep link | SPA rewrite missing | Ensure `frontend/vercel.json` is deployed |
| `EADDRINUSE` on `:5000` | Port already taken | Change `PORT`, or stop the other process |

---

## 12. License

Released under the **MIT License**. See [`backend/package.json`](file:///s:/INNOVATION%20Project/Smart%20Waste%20Management%20System/backend/package.json) for package metadata.

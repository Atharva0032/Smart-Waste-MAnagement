# Smart Waste Management System — REST API Documentation

Backend API for the MERN "Smart Waste Management System". Every route is mounted
under the `/api` prefix by `backend/server.js`, and the router index
(`backend/routes/index.js`) fans out to the feature routers.

---

## Base URL

| Environment | Base URL |
| --- | --- |
| Development | `http://localhost:5000/api` |
| Production | `https://<your-host>/api` (behind the deployed server; `PORT` is configurable) |

The port defaults to `5000` (`PORT` in `backend/config/env.js`).

A sibling, **non-`/api`** resource is also served by the same process:

- `GET /uploads/<filename>` — static, `/uploads`-prefixed waste and completion
  images (7-day cache, `Cross-Origin-Resource-Policy: cross-origin`).
- `GET /` — service metadata (`name`, `version: "1.0.0"`, and the `endpoints`
  map).

## API version note

The API is **not URL-versioned**. The service reports `version: "1.0.0"` in the
`GET /` metadata response. Feature groups are expressed purely as path prefixes:
`/auth`, `/complaints`, `/admin`, `/workers`, `/notifications`, `/ai`.

## Content types

| Content type | Used for |
| --- | --- |
| `application/json` | All standard request/response bodies (login, register, profile, status updates, assignments, notifications). |
| `multipart/form-data` | File uploads: `POST /api/complaints` (`image`), `PUT /api/workers/complaints/:id/resolve` (`completionImage`), `POST /api/ai/verify` (`image`). |

For `multipart/form-data` requests, **do not** set `Content-Type` manually —
the client must let the browser set the multipart boundary.

## Environment variables relevant to the API

All configuration is centralised in `backend/config/env.js` (values fall back to
the defaults below when the variable is absent).

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime mode. `development` also adds a `stack` field to error responses and relaxes CORS to any localhost origin. |
| `PORT` | `5000` | HTTP port the server listens on. |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/smart_waste_db` | MongoDB connection string. |
| `JWT_SECRET` | `swms_development_only_secret_change_me` | HMAC secret used to sign/verify tokens. Must be ≥ 32 chars in production. |
| `JWT_EXPIRES_IN` | `7d` | JWT lifetime (used as `expiresIn`). |
| `BCRYPT_SALT_ROUNDS` | `10` | Password hashing cost. |
| `CLIENT_URL` | `http://localhost:5173` | Canonical allowed CORS origin. |
| `CLIENT_URLS` | *(empty)* | Comma-separated additional allowed CORS origins. |
| `MAX_FILE_UPLOAD_MB` | `5` | Max upload size in MB (see [Upload constraints](#upload-constraints)). |
| `UPLOAD_DIR` | `uploads` | Upload sub-directory, resolved relative to the backend root. |
| `AI_VERIFY_ENABLED` | `true` | Enables server-side image verification. When `false`, `classifyImage` throws `503`. |
| `AI_MIN_CONFIDENCE` | `60` | Minimum confidence (0–100) for an image to be classified as waste. |
| `AI_REJECT_INVALID` | `false` | When `true`, `POST /api/complaints` hard-rejects a photo that is not classified as waste (`422`). |
| `SMTP_HOST` | *(empty)* | SMTP host for outbound notification emails. Empty ⇒ emails are logged only. |
| `SMTP_PORT` | `587` | SMTP port. |
| `SMTP_SECURE` | `false` | Use TLS for SMTP. |
| `SMTP_USER` | *(empty)* | SMTP username. |
| `SMTP_PASS` | *(empty)* | SMTP password. |
| `MAIL_FROM` | `Smart Waste Management System <no-reply@swms.gov>` | From address for notification emails. |

Seeder-only variables (used by `backend/seed.js`, not by the running API):
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_WORKER_EMAIL`,
`SEED_WORKER_PASSWORD`, `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`.

---

## Global conventions

### Success envelope

Successful responses always include `success: true`. Controllers then attach a
human-readable `message` (where applicable) and one **feature-specific payload
key** that carries the data (`user`, `token`, `complaint`, `complaints`,
`workers`, `stats`, `notifications`, …):

```json
{
  "success": true,
  "message": "Optional human readable message",
  "complaint": { }
}
```

There is no single generic `data` wrapper key — the payload key is descriptive
and is documented per endpoint below.

### Error envelope

Every error is produced by the central handler in
`backend/middleware/errorMiddleware.js` and always has this shape:

```json
{
  "success": false,
  "message": "Human readable error",
  "errors": [{ "field": "email", "message": "Please provide a valid email address." }],
  "stack": "…only present when NODE_ENV === 'development'"
}
```

`errors` is present only when field-level details exist (validation failures).

### HTTP status codes

| Code | Meaning in this API |
| --- | --- |
| `200` | OK — successful read/update/delete. |
| `201` | Created — account registered, complaint submitted, worker created. |
| `400` | Bad request — validation failure, missing file/field, bad ObjectId, malformed JSON, oversize/unsupported upload. |
| `401` | Unauthorized — missing/invalid/expired token, wrong credentials. |
| `403` | Forbidden — authenticated but wrong role, deactivated account, or not the resource owner. |
| `404` | Not found — unknown route, or resource does not exist. |
| `409` | Conflict — duplicate email/tracking id, illegal state transition, deactivated worker. |
| `422` | Unprocessable entity — photo rejected by AI screening when `AI_REJECT_INVALID=true`. |
| `429` | Too many requests — a rate limiter tripped. |
| `500` | Internal server error. |
| `503` | Service unavailable — AI verification disabled, or no engine could analyse the image. |

### Authentication

JWT bearer, per `backend/middleware/authMiddleware.js`:

```
Authorization: Bearer <token>
```

The token is returned by `POST /api/auth/register` and `POST /api/auth/login`
in the `token` field, and is also accepted from a `token` cookie. The JWT
payload contains `{ id, role }` and is signed with `JWT_SECRET`.

Three access tiers are used across the API:

| **Access** value | Enforcement |
| --- | --- |
| `public` | No token required. |
| `public (optional auth)` | Works without a token; a valid token soft-attaches `req.user` (never errors). |
| `authenticated` | `protect` — any valid, active account. |
| `role: user` | `authorize('user')` — citizens only. |
| `role: admin` | `authorize('admin')` — administrators only. |
| `role: worker` | `authorize('worker')` — field workers only. |
| `owner` | Handler-level ownership check (e.g. own complaint / own notification). |

### Pagination & list query params

- `GET /api/admin/complaints` supports `page` (default `1`, min `1`) and
  `limit` (default `10`, clamped to `1–50`). The response returns
  `page`, `pages`, and `total` alongside `complaints`.
- `GET /api/notifications` supports `limit` (default `20`, clamped to `1–50`).
- All other list endpoints return the full set with a `count` field.

### Complaint status lifecycle

Defined in `backend/models/Complaint.js` (`COMPLAINT_STATUSES`) and enforced by
the controllers:

```
pending ──▶ assigned ──▶ in_progress ──▶ resolved
   │            │
   └────────────┴────────▶ rejected        (terminal, admin-only)
```

- `pending` — reported by a citizen, awaiting triage.
- `assigned` — an admin assigned it to a field worker.
- `in_progress` — the worker started the work.
- `resolved` — closed with a completion photo.
- `rejected` — marked invalid/false by an admin. **Terminal**: a rejected
  complaint cannot be reassigned, resolved, or worked on.

Workers may only set `in_progress` and `resolved`. Admins may set any of the
five statuses. A citizen may withdraw (delete) a complaint only while it is
still `pending`.

### Upload constraints

Enforced by `backend/middleware/uploadMiddleware.js` for every multipart route:

- **Allowed MIME types:** `image/jpeg`, `image/jpg`, `image/png`,
  `image/webp`, `image/bmp`, `image/gif`. Anything else is rejected with `400`.
- **Maximum size:** `MAX_FILE_UPLOAD_MB` (default **5 MB**) — computed as
  `MAX_FILE_UPLOAD_MB * 1024 * 1024`. Oversized uploads return `400` with
  `The uploaded image is too large. Maximum allowed size is 5 MB.`
- **Exactly one file** per request (`files: 1`); an unexpected field name
  returns `400` `Unexpected file field "..."`.
- Disk storage writes to `UPLOAD_PATH` with a server-generated filename; the
  client-supplied name is never trusted.
- The AI endpoint uses **memory** storage so a rejected image is never written
  to disk.

---

## System

### GET /api/health
Liveness + readiness probe (also the service's documented health URL).

**Access:** public

**Path params:** none &nbsp;|&nbsp; **Query params:** none &nbsp;|&nbsp; **Body:** none

**Example request**

```bash
curl http://localhost:5000/api/health
```

**Example success response**

```json
{
  "success": true,
  "service": "smart-waste-management-api",
  "environment": "development",
  "uptimeSeconds": 128,
  "database": "connected",
  "ai": {
    "enabled": true,
    "minConfidence": 60,
    "rejectInvalid": false,
    "engine": "mobilenet-v2",
    "tensorflowAvailable": true,
    "tensorflowError": null,
    "keywords": 121
  },
  "timestamp": "2026-11-04T10:15:00.000Z"
}
```

**Common errors:** none expected (returns `200` even when the DB is
`disconnected`; the `database` field carries the state).

---

## Authentication

Mounted at `/api/auth`. Register/login are behind a `20 requests / 15 min`
brute-force limiter.

### POST /api/auth/register
Create a citizen or field-worker account and return a JWT.

**Access:** public &nbsp;•&nbsp; **Rate limit:** 20 / 15 min

**Body** (`application/json`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `name` | string | yes | Display name. | trimmed, 2–60 chars |
| `email` | string | yes | Login email. | valid email, normalised (lowercased) |
| `password` | string | yes | Account password. | 6–64 chars |
| `phone` | string | no | Contact number. | empty allowed; else matches `/^\+?[0-9\-\s]{7,15}$/` |
| `role` | string | no | Self-registration role. | must be `user` or `worker`; defaults to `user`. **`admin` is not self-service** — an unlisted value silently becomes `user`. |
| `zone` | string | no | Operating zone (workers only). | kept only when `role` is `worker` |
| `address` | string | no | Postal address. | — |

**Example request**

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Aarav Mehta",
    "email": "aarav@example.com",
    "password": "Secret@123",
    "phone": "+91 98000 44444",
    "role": "user",
    "address": "21 Marine Drive, Mumbai"
  }'
```

**Example success response** — `201`

```json
{
  "success": true,
  "message": "Account created successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…",
  "user": {
    "_id": "66f1c2a3b4d5e6f701234567",
    "name": "Aarav Mehta",
    "email": "aarav@example.com",
    "phone": "+91 98000 44444",
    "role": "user",
    "avatar": "",
    "address": "21 Marine Drive, Mumbai",
    "zone": "",
    "isActive": true,
    "lastLoginAt": "2026-11-04T10:20:00.000Z",
    "createdAt": "2026-11-04T10:20:00.000Z",
    "updatedAt": "2026-11-04T10:20:00.000Z",
    "initials": "AM"
  }
}
```

**Common errors**
- `400` — validation failed (name/email/password/phone rules), returned with an `errors[]` array.
- `409` — an account with that email already exists.
- `429` — more than 20 auth attempts in 15 minutes.

### POST /api/auth/login
Authenticate with email + password and issue a JWT.

**Access:** public &nbsp;•&nbsp; **Rate limit:** 20 / 15 min

**Body** (`application/json`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `email` | string | yes | Login email. | valid email, normalised |
| `password` | string | yes | Account password. | non-empty |

**Example request**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@swms.gov", "password": "User@123" }'
```

**Example success response** — `200`

```json
{
  "success": true,
  "message": "Logged in successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…",
  "user": {
    "_id": "66f1c2a3b4d5e6f701234567",
    "name": "Aarav Mehta",
    "email": "user@swms.gov",
    "role": "user",
    "isActive": true
  }
}
```

**Common errors**
- `400` — validation failed.
- `401` — invalid email or password (a single generic message prevents email enumeration).
- `403` — account deactivated.
- `429` — rate limit exceeded.

### GET /api/auth/me
Return the authenticated profile, plus the role-specific profile document.

**Access:** authenticated

**Path params:** none &nbsp;|&nbsp; **Query params:** none &nbsp;|&nbsp; **Body:** none

**Example request**

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

**Example success response** — `200` (worker shown; `profile` is omitted for citizens)

```json
{
  "success": true,
  "user": { "_id": "66f1…", "name": "Ravi Kumar", "email": "worker@swms.gov", "role": "worker", "zone": "Zone A - North", "isActive": true },
  "profile": {
    "_id": "66f1…",
    "user": "66f1…",
    "employeeId": "W-0001",
    "zone": "Zone A - North",
    "designation": "Sanitation Worker",
    "department": "Municipal Sanitation",
    "isAvailable": true,
    "totalAssigned": 1,
    "totalResolved": 0,
    "rating": 4.5
  }
}
```

**Common errors**
- `401` — missing/invalid/expired token; or the token's account no longer exists.
- `403` — account deactivated.

### PUT /api/auth/profile
Update the authenticated user's own profile.

**Access:** authenticated

**Body** (`application/json`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `name` | string | no | Display name. | 2–60 chars |
| `phone` | string | no | Contact number. | empty allowed; else `/^\+?[0-9\-\s]{7,15}$/` |
| `address` | string | no | Postal address. | — |
| `avatar` | string | no | Avatar URL/path. | — |
| `zone` | string | no | Operating zone. | **applied only when the account role is `worker`** (also updates the Worker profile) |

**Example request**

```bash
curl -X PUT http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Aarav M.", "phone": "+91 98000 44444" }'
```

**Example success response** — `200`

```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "user": { "_id": "66f1…", "name": "Aarav M.", "phone": "+91 98000 44444", "role": "user" }
}
```

**Common errors**
- `400` — validation failed.
- `401` — not authenticated.

---

## Complaints

Mounted at `/api/complaints`. Static paths (`/my`, `/track/:trackingId`) are
declared before `/:id`.

### POST /api/complaints
Submit a waste complaint with a photo and GPS coordinates.

**Access:** authenticated &nbsp;•&nbsp; **role: user** (citizens only)

**Form-data fields** (`multipart/form-data`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `image` | file | yes | Photo of the waste. | image MIME types; ≤ `MAX_FILE_UPLOAD_MB` (5 MB); only one file |
| `wasteType` | string | yes | Waste category. | one of `organic`, `plastic`, `electronic`, `hazardous`, `construction`, `medical`, `other` |
| `description` | string | yes | Free-text description. | 10–500 chars |
| `latitude` | number | yes | GPS latitude. | float in `[-90, 90]` |
| `longitude` | number | yes | GPS longitude. | float in `[-180, 180]` |
| `priority` | string | no | Triage priority. | one of `low`, `medium`, `high`; defaults to `medium` |
| `area` | string | no | Locality/zone label. | ≤ 80 chars; defaults to `Unspecified` |
| `address` | string | no | Street address. | ≤ 400 chars |
| `phone` | string | no | Reporter phone (synced onto the account if blank). | — |
| `aiConfidence` | number | no | Client-side AI confidence (0–100). | if supplied, the server records it and marks `model: "client-side-verification"` |
| `aiLabel` | string | no | Client-side AI label. | — |

**Example request**

```bash
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer <user-token>" \
  -F "image=@waste.jpg" \
  -F "wasteType=plastic" \
  -F "description=Overflowing plastic bins behind the market complex." \
  -F "latitude=19.076" \
  -F "longitude=72.8777" \
  -F "priority=high" \
  -F "area=Zone A - North" \
  -F "address=Sector 5 Market Road"
```

**Example success response** — `201` (complaint abbreviated)

```json
{
  "success": true,
  "message": "Complaint submitted successfully.",
  "complaint": {
    "_id": "66f2a1…",
    "trackingId": "SWM-4F9A2C",
    "user": { "_id": "66f1…", "name": "Aarav Mehta", "email": "user@swms.gov", "phone": "+91 98000 44444", "role": "user" },
    "wasteType": "plastic",
    "description": "Overflowing plastic bins behind the market complex.",
    "image": "/uploads/1714899000000-ab12cd-plastic.jpg",
    "completionImage": "",
    "location": { "address": "Sector 5 Market Road", "area": "Zone A - North", "latitude": 19.076, "longitude": 72.8777 },
    "status": "pending",
    "priority": "high",
    "assignedWorker": null,
    "resolutionNote": "",
    "aiVerification": { "isWaste": true, "confidence": 82, "label": "plastic", "model": "client-side-verification", "verifiedAt": "2026-11-04T10:25:00.000Z" },
    "timeline": [
      { "status": "pending", "note": "Complaint submitted by citizen.", "updatedBy": "66f1…", "timestamp": "2026-11-04T10:25:00.000Z" }
    ],
    "createdAt": "2026-11-04T10:25:00.000Z",
    "updatedAt": "2026-11-04T10:25:00.000Z"
  }
}
```

**Common errors**
- `400` — no `image` file; invalid `wasteType`/`priority`; description < 10 chars; missing GPS; unsupported file type; file too large.
- `403` — caller is not a `user` (citizens only).
- `422` — photo failed AI screening and `AI_REJECT_INVALID=true`.
- `429` — global `/api` rate limit exceeded.

### GET /api/complaints/my
List the authenticated citizen's own complaints (newest first).

**Access:** authenticated &nbsp;•&nbsp; **role: user**

**Path params:** none &nbsp;|&nbsp; **Query params:** none &nbsp;|&nbsp; **Body:** none

**Example request**

```bash
curl http://localhost:5000/api/complaints/my \
  -H "Authorization: Bearer <user-token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "count": 2,
  "complaints": [
    { "_id": "66f2a1…", "trackingId": "SWM-4F9A2C", "wasteType": "plastic", "status": "pending", "priority": "high" },
    { "_id": "66f2a2…", "trackingId": "SWM-7B21E9", "wasteType": "organic", "status": "assigned", "priority": "medium" }
  ]
}
```

**Common errors**
- `401` — not authenticated.
- `403` — caller is not a `user`.

### GET /api/complaints/track/:trackingId
Public complaint tracker. Returns a **PII-stripped** payload.

**Access:** public (optional auth — a token is recognised but not required)

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `trackingId` | string | yes | Public tracking id, e.g. `SWM-4F9A2C` (trimmed, upper-cased before lookup). |

**Privacy note:** the response deliberately omits the reporter's contact
details. It includes only `_id`, `trackingId`, `wasteType`, `description`,
`image`, `completionImage`, `status`, `priority`, `resolutionNote`, `location`,
a reduced `assignedWorker` (`{ name, zone }` only), `timeline`, `resolvedAt`,
`createdAt`, `updatedAt`.

**Example request**

```bash
curl http://localhost:5000/api/complaints/track/SWM-4F9A2C
```

**Example success response** — `200`

```json
{
  "success": true,
  "complaint": {
    "_id": "66f2a1…",
    "trackingId": "SWM-4F9A2C",
    "wasteType": "plastic",
    "description": "Overflowing plastic bins behind the market complex.",
    "image": "/uploads/1714899000000-ab12cd-plastic.jpg",
    "completionImage": "",
    "status": "assigned",
    "priority": "high",
    "resolutionNote": "",
    "location": { "address": "Sector 5 Market Road", "area": "Zone A - North", "latitude": 19.076, "longitude": 72.8777 },
    "assignedWorker": { "name": "Ravi Kumar", "zone": "Zone A - North" },
    "timeline": [
      { "status": "pending", "note": "Complaint submitted by citizen.", "updatedBy": { "name": "Aarav Mehta", "role": "user" }, "timestamp": "2026-11-04T10:25:00.000Z" },
      { "status": "assigned", "note": "Assigned to Ravi Kumar (Zone A - North).", "updatedBy": { "name": "Municipal Administrator", "role": "admin" }, "timestamp": "2026-11-04T10:40:00.000Z" }
    ],
    "resolvedAt": null,
    "createdAt": "2026-11-04T10:25:00.000Z",
    "updatedAt": "2026-11-04T10:40:00.000Z"
  }
}
```

**Common errors**
- `400` — empty tracking id.
- `404` — no complaint found for that tracking id.

### GET /api/complaints/:id
Fetch a single complaint by its ObjectId.

**Access:** authenticated &nbsp;•&nbsp; **owner, or role admin/worker**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Complaint ObjectId. |

**Example request**

```bash
curl http://localhost:5000/api/complaints/66f2a1b2c3d4e5f601234567 \
  -H "Authorization: Bearer <token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "complaint": { "_id": "66f2a1…", "trackingId": "SWM-4F9A2C", "status": "pending", "priority": "high" }
}
```

**Common errors**
- `400` — invalid ObjectId (CastError).
- `401` — not authenticated.
- `403` — caller is neither the owner nor an admin/worker.
- `404` — complaint not found.

### DELETE /api/complaints/:id
Withdraw the caller's own complaint — allowed only while it is still `pending`.

**Access:** authenticated &nbsp;•&nbsp; **role: user (owner)**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Complaint ObjectId. |

**Example request**

```bash
curl -X DELETE http://localhost:5000/api/complaints/66f2a1b2c3d4e5f601234567 \
  -H "Authorization: Bearer <user-token>"
```

**Example success response** — `200`

```json
{ "success": true, "message": "Complaint withdrawn successfully." }
```

**Common errors**
- `401` — not authenticated.
- `403` — the complaint is not owned by the caller.
- `404` — complaint not found.
- `409` — the complaint is no longer `pending` and cannot be withdrawn.

---

## Admin

Mounted at `/api/admin`. **Every** route is gated by
`router.use(protect, authorize('admin'))` — authentication **and** the `admin`
role are required for all endpoints below.

### GET /api/admin/stats
Aggregated KPIs, distributions and a 7-day trend for the dashboard.

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Path params:** none &nbsp;|&nbsp; **Query params:** none &nbsp;|&nbsp; **Body:** none

**Example request**

```bash
curl http://localhost:5000/api/admin/stats \
  -H "Authorization: Bearer <admin-token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "stats": {
    "totals": { "total": 5, "pending": 1, "assigned": 1, "inProgress": 1, "resolved": 1, "rejected": 1 },
    "byWasteType": [ { "_id": "plastic", "count": 1 }, { "_id": "organic", "count": 1 } ],
    "byArea": [ { "_id": "Zone A - North", "count": 2 }, { "_id": "Zone C - East", "count": 1 } ],
    "weeklyTrend": [ { "_id": "2026-10-29", "count": 1, "resolved": 0 }, { "_id": "2026-11-04", "count": 1, "resolved": 0 } ],
    "averageResolutionHours": 24.5,
    "resolutionRate": 20,
    "resolvedCount": 1,
    "activeWorkers": 2,
    "registeredCitizens": 2,
    "recentComplaints": [ { "_id": "66f2a1…", "trackingId": "SWM-4F9A2C", "status": "pending" } ]
  }
}
```

**Common errors**
- `401` — not authenticated.
- `403` — caller is not an `admin`.

### GET /api/admin/complaints
Paginated, filterable complaint list.

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Query params**

| Param | Type | Required | Description | Default / rules |
| --- | --- | --- | --- | --- |
| `status` | string | no | Filter by status. | `all` (no filter) or one of `pending`, `assigned`, `in_progress`, `resolved`, `rejected` |
| `area` | string | no | Filter by `location.area`. | `all` = no filter |
| `wasteType` | string | no | Filter by waste type. | `all` = no filter |
| `search` | string | no | Case-insensitive search over trackingId, description, address, area. | regex-escaped |
| `sort` | string | no | `newest` or `oldest`. | default `newest` |
| `page` | number | no | 1-based page. | default `1` |
| `limit` | number | no | Page size. | default `10`, clamped `1–50` |

**Example request**

```bash
curl "http://localhost:5000/api/admin/complaints?status=pending&sort=newest&page=1&limit=10" \
  -H "Authorization: Bearer <admin-token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "complaints": [ { "_id": "66f2a1…", "trackingId": "SWM-4F9A2C", "status": "pending", "priority": "high" } ],
  "page": 1,
  "pages": 1,
  "total": 1
}
```

**Common errors**
- `401` — not authenticated.
- `403` — not an `admin`.

### PUT /api/admin/complaints/:id/assign
Assign (or reassign) a complaint to a field worker.

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Complaint ObjectId. |

**Body** (`application/json`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `workerId` | string | yes | `User._id` of the target worker. | valid Mongo ObjectId; the user must exist with role `worker` and be active |

**Example request**

```bash
curl -X PUT http://localhost:5000/api/admin/complaints/66f2a1b2c3d4e5f601234567/assign \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{ "workerId": "66f0a1b2c3d4e5f600000001" }'
```

**Example success response** — `200`

```json
{
  "success": true,
  "message": "Complaint assigned to Ravi Kumar.",
  "complaint": { "_id": "66f2a1…", "trackingId": "SWM-4F9A2C", "status": "assigned", "assignedWorker": { "_id": "66f0…", "name": "Ravi Kumar", "zone": "Zone A - North" } }
}
```

**Common errors**
- `400` — missing/invalid `workerId`; no worker selected.
- `401` — not authenticated.
- `403` — not an `admin`.
- `404` — complaint not found; the selected worker does not exist.
- `409` — worker account deactivated; or the complaint is already `resolved`/`rejected` (terminal).

### PUT /api/admin/complaints/:id/status
Move a complaint through the workflow.

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Complaint ObjectId. |

**Body** (`application/json`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `status` | string | yes | New status. | one of `pending`, `assigned`, `in_progress`, `resolved`, `rejected` |
| `note` | string | no | Resolution/history note. | ≤ 500 chars; stored on `resolutionNote` |

**Example request**

```bash
curl -X PUT http://localhost:5000/api/admin/complaints/66f2a1b2c3d4e5f601234567/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "in_progress", "note": "Field team dispatched." }'
```

**Example success response** — `200`

```json
{
  "success": true,
  "message": "Status updated to \"in progress\".",
  "complaint": { "_id": "66f2a1…", "trackingId": "SWM-4F9A2C", "status": "in_progress" }
}
```

**Common errors**
- `400` — invalid status; or `status: "assigned"` supplied while no worker is assigned.
- `401` — not authenticated.
- `403` — not an `admin`.
- `404` — complaint not found.
- `409` — the complaint already has that status.

### DELETE /api/admin/complaints/:id
Permanently delete a complaint and its images.

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Complaint ObjectId. |

**Example request**

```bash
curl -X DELETE http://localhost:5000/api/admin/complaints/66f2a1b2c3d4e5f601234567 \
  -H "Authorization: Bearer <admin-token>"
```

**Example success response** — `200`

```json
{ "success": true, "message": "Complaint SWM-4F9A2C was deleted.", "id": "66f2a1b2c3d4e5f601234567" }
```

**Common errors**
- `401` — not authenticated.
- `403` — not an `admin`.
- `404` — complaint not found.

### GET /api/admin/workers
List field workers with their operational profile and live workload counters.

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Path params:** none &nbsp;|&nbsp; **Query params:** none &nbsp;|&nbsp; **Body:** none

**Example request**

```bash
curl http://localhost:5000/api/admin/workers \
  -H "Authorization: Bearer <admin-token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "count": 2,
  "workers": [
    {
      "_id": "66f0…",
      "name": "Ravi Kumar",
      "email": "worker@swms.gov",
      "phone": "+91 98000 22222",
      "role": "worker",
      "zone": "Zone A - North",
      "isActive": true,
      "employeeId": "W-0001",
      "designation": "Sanitation Worker",
      "department": "Municipal Sanitation",
      "isAvailable": true,
      "rating": 4.5,
      "assignedCount": 1,
      "resolvedCount": 0,
      "completionRate": 0
    }
  ]
}
```

**Common errors**
- `401` — not authenticated.
- `403` — not an `admin`.

### POST /api/admin/workers
Create a worker account plus its operational profile.

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Body** (`application/json`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `name` | string | yes | Worker's display name. | 2–60 chars |
| `email` | string | yes | Login email. | valid email, normalised; must be unique |
| `password` | string | yes | Temporary password. | 6–64 chars |
| `phone` | string | no | Contact number. | empty allowed; else `/^\+?[0-9\-\s]{7,15}$/` |
| `zone` | string | no | Operating zone. | ≤ 80 chars |
| `designation` | string | no | Job title. | defaults to `Sanitation Worker` |
| `department` | string | no | Department. | defaults to `Municipal Sanitation` |
| `employeeId` | string | no | Custom employee id. | else auto-generated `W-<last6ofId>` |

**Example request**

```bash
curl -X POST http://localhost:5000/api/admin/workers \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Priya Sharma",
    "email": "worker2@swms.gov",
    "password": "Worker@123",
    "phone": "+91 98000 33333",
    "zone": "Zone C - East",
    "designation": "Sanitation Worker",
    "department": "Municipal Sanitation"
  }'
```

**Example success response** — `201`

```json
{
  "success": true,
  "message": "Field worker Priya Sharma created successfully.",
  "worker": {
    "_id": "66f0…",
    "name": "Priya Sharma",
    "email": "worker2@swms.gov",
    "phone": "+91 98000 33333",
    "role": "worker",
    "zone": "Zone C - East",
    "isActive": true,
    "employeeId": "W-0002",
    "assignedCount": 0,
    "resolvedCount": 0
  }
}
```

**Common errors**
- `400` — validation failed.
- `401` — not authenticated.
- `403` — not an `admin`.
- `409` — an account with that email already exists.

### PUT /api/admin/workers/:id
Update a worker's account and profile details.

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Worker `User._id`. |

**Body** (`application/json`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `name` | string | no | Display name. | — |
| `phone` | string | no | Contact number. | — |
| `zone` | string | no | Operating zone (updates user + profile). | — |
| `isActive` | boolean | no | Activate/deactivate the account. | coerced to boolean |
| `designation` | string | no | Job title (profile). | — |
| `department` | string | no | Department (profile). | — |
| `isAvailable` | boolean | no | Availability for new assignments (profile). | coerced to boolean |

**Example request**

```bash
curl -X PUT http://localhost:5000/api/admin/workers/66f0a1b2c3d4e5f600000002 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{ "zone": "Zone D - West", "isAvailable": false }'
```

**Example success response** — `200`

```json
{
  "success": true,
  "message": "Worker updated successfully.",
  "worker": { "_id": "66f0…", "name": "Priya Sharma", "role": "worker", "zone": "Zone D - West", "employeeId": "W-0002" }
}
```

**Common errors**
- `400` — the selected account is not a worker.
- `401` — not authenticated.
- `403` — not an `admin`.
- `404` — worker not found.

### DELETE /api/admin/workers/:id
Remove a worker, release their open jobs back to the queue, and delete the
profile.

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Worker `User._id`. |

**Behaviour:** complaints currently `assigned`/`in_progress` for that worker are
reset to `pending` with `assignedWorker: null` and a timeline entry is added.

**Example request**

```bash
curl -X DELETE http://localhost:5000/api/admin/workers/66f0a1b2c3d4e5f600000002 \
  -H "Authorization: Bearer <admin-token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "message": "Worker removed. 1 open complaint(s) returned to the queue.",
  "releasedComplaints": 1
}
```

**Common errors**
- `400` — the selected account is not a worker.
- `401` — not authenticated.
- `403` — not an `admin`.
- `404` — worker not found.

### GET /api/admin/users
List registered citizens (max 500, newest first).

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Path params:** none &nbsp;|&nbsp; **Query params:** none &nbsp;|&nbsp; **Body:** none

**Example request**

```bash
curl http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer <admin-token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "count": 2,
  "users": [
    { "_id": "66f1…", "name": "Aarav Mehta", "email": "user@swms.gov", "role": "user", "isActive": true }
  ]
}
```

**Common errors**
- `401` — not authenticated.
- `403` — not an `admin`.

### PUT /api/admin/users/:id/status
Activate or deactivate a citizen account.

**Access:** authenticated &nbsp;•&nbsp; **role: admin**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Target `User._id` (must not be an admin). |

**Body** (`application/json`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `isActive` | boolean | no | Explicit target state. | If omitted, the current state is toggled. |

**Example request**

```bash
curl -X PUT http://localhost:5000/api/admin/users/66f1c2a3b4d5e6f701234567/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{ "isActive": false }'
```

**Example success response** — `200`

```json
{
  "success": true,
  "message": "Account deactivated.",
  "user": { "_id": "66f1…", "name": "Aarav Mehta", "role": "user", "isActive": false }
}
```

**Common errors**
- `401` — not authenticated.
- `403` — not an `admin`; or attempting to modify an `admin` account.
- `404` — user not found.

---

## Workers

Mounted at `/api/workers`. **Every** route is gated by
`router.use(protect, authorize('worker'))` — authentication **and** the `worker`
role are required for all endpoints below.

### GET /api/workers/assigned
List complaints assigned to the authenticated worker, plus dashboard counters.

**Access:** authenticated &nbsp;•&nbsp; **role: worker**

**Path params:** none &nbsp;|&nbsp; **Query params:** none &nbsp;|&nbsp; **Body:** none

**Example request**

```bash
curl http://localhost:5000/api/workers/assigned \
  -H "Authorization: Bearer <worker-token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "count": 1,
  "complaints": [ { "_id": "66f2a1…", "trackingId": "SWM-4F9A2C", "status": "in_progress", "assignedWorker": { "_id": "66f0…", "name": "Ravi Kumar", "zone": "Zone A - North" } } ],
  "stats": { "total": 1, "assigned": 0, "inProgress": 1, "resolved": 0 }
}
```

**Common errors**
- `401` — not authenticated.
- `403` — caller is not a worker.

### GET /api/workers/profile
Operational profile and live workload counters for the current worker.

**Access:** authenticated &nbsp;•&nbsp; **role: worker**

**Path params:** none &nbsp;|&nbsp; **Query params:** none &nbsp;|&nbsp; **Body:** none

**Example request**

```bash
curl http://localhost:5000/api/workers/profile \
  -H "Authorization: Bearer <worker-token>"
```

**Example success response** — `200` (`profile` is `null` if no profile document exists)

```json
{
  "success": true,
  "profile": {
    "_id": "66f0…",
    "user": "66f0…",
    "employeeId": "W-0001",
    "zone": "Zone A - North",
    "designation": "Sanitation Worker",
    "department": "Municipal Sanitation",
    "isAvailable": true,
    "totalAssigned": 1,
    "totalResolved": 0,
    "rating": 4.5
  },
  "workload": { "open": 1, "resolved": 0 }
}
```

**Common errors**
- `401` — not authenticated.
- `403` — caller is not a worker.

### PUT /api/workers/complaints/:id/resolve
Close a complaint with a completion photo and a resolution note.

**Access:** authenticated &nbsp;•&nbsp; **role: worker (the assigned worker)**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Complaint ObjectId. |

**Form-data fields** (`multipart/form-data`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `completionImage` | file | yes | Photo proving the work is done. | image MIME types; ≤ `MAX_FILE_UPLOAD_MB` (5 MB); one file |
| `note` | string | yes | Resolution note. | 10–500 chars |

**Example request**

```bash
curl -X PUT http://localhost:5000/api/workers/complaints/66f2a1b2c3d4e5f601234567/resolve \
  -H "Authorization: Bearer <worker-token>" \
  -F "completionImage=@done.jpg" \
  -F "note=Rubble cleared and disposed at the authorised facility."
```

**Example success response** — `200`

```json
{
  "success": true,
  "message": "Complaint resolved successfully.",
  "complaint": {
    "_id": "66f2a1…",
    "trackingId": "SWM-4F9A2C",
    "status": "resolved",
    "completionImage": "/uploads/1714901000000-ee77ff-done.jpg",
    "resolutionNote": "Rubble cleared and disposed at the authorised facility.",
    "resolvedAt": "2026-11-04T11:00:00.000Z"
  }
}
```

**Common errors**
- `400` — no `completionImage`; note shorter than 10 chars; unsupported/oversized image.
- `401` — not authenticated.
- `403` — the complaint is not assigned to this worker.
- `404` — complaint not found.
- `409` — the complaint is already `resolved`; or it was `rejected` by an admin.

### PUT /api/workers/complaints/:id/status
Start or finish an assigned complaint (workers may **only** set `in_progress` or
`resolved`).

**Access:** authenticated &nbsp;•&nbsp; **role: worker (the assigned worker)**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Complaint ObjectId. |

**Body** (`application/json`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `status` | string | yes | New status. | one of `in_progress`, `resolved` |
| `note` | string | no | History/resolution note. | ≤ 500 chars |

**Example request**

```bash
curl -X PUT http://localhost:5000/api/workers/complaints/66f2a1b2c3d4e5f601234567/status \
  -H "Authorization: Bearer <worker-token>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "in_progress" }'
```

**Example success response** — `200`

```json
{
  "success": true,
  "message": "Complaint marked as in progress.",
  "complaint": { "_id": "66f2a1…", "trackingId": "SWM-4F9A2C", "status": "in_progress" }
}
```

**Common errors**
- `400` — invalid status (only `in_progress`/`resolved` allowed).
- `401` — not authenticated.
- `403` — the complaint is not assigned to this worker.
- `404` — complaint not found.
- `409` — already at that status; or the complaint was `rejected` (cannot be updated).

### GET /api/workers/complaints/:id
Fetch one assigned complaint (the worker must own the assignment).

**Access:** authenticated &nbsp;•&nbsp; **role: worker (the assigned worker)**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Complaint ObjectId. |

**Example request**

```bash
curl http://localhost:5000/api/workers/complaints/66f2a1b2c3d4e5f601234567 \
  -H "Authorization: Bearer <worker-token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "complaint": { "_id": "66f2a1…", "trackingId": "SWM-4F9A2C", "status": "in_progress", "priority": "high" }
}
```

**Common errors**
- `401` — not authenticated.
- `403` — the complaint is not assigned to this worker.
- `404` — complaint not found.

---

## Notifications

Mounted at `/api/notifications`. **Every** route is scoped to the authenticated
user via `router.use(protect)`. The static `/read-all` route is declared before
`/:id`.

### GET /api/notifications
Latest notifications for the authenticated user plus the unread count.

**Access:** authenticated (any role)

**Query params**

| Param | Type | Required | Description | Default / rules |
| --- | --- | --- | --- | --- |
| `limit` | number | no | Max notifications to return. | default `20`, clamped `1–50` |

**Example request**

```bash
curl "http://localhost:5000/api/notifications?limit=20" \
  -H "Authorization: Bearer <token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "unreadCount": 1,
  "count": 1,
  "notifications": [
    {
      "_id": "66f3a1…",
      "recipient": "66f1…",
      "title": "Your report is being processed",
      "message": "A field worker has been assigned to your E-waste report.",
      "type": "status_update",
      "link": "/complaints",
      "complaint": null,
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-11-04T10:30:00.000Z"
    }
  ]
}
```

**Common errors**
- `401` — not authenticated.

### PUT /api/notifications/read-all
Mark every notification of the authenticated user as read.

**Access:** authenticated

**Path params:** none &nbsp;|&nbsp; **Query params:** none &nbsp;|&nbsp; **Body:** none

**Example request**

```bash
curl -X PUT http://localhost:5000/api/notifications/read-all \
  -H "Authorization: Bearer <token>"
```

**Example success response** — `200`

```json
{ "success": true, "message": "All notifications marked as read.", "modifiedCount": 3 }
```

**Common errors**
- `401` — not authenticated.

### PUT /api/notifications/:id/read
Mark a single notification as read (must be owned by the caller).

**Access:** authenticated &nbsp;•&nbsp; **owner**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Notification ObjectId. |

**Example request**

```bash
curl -X PUT http://localhost:5000/api/notifications/66f3a1b2c3d4e5f601234567/read \
  -H "Authorization: Bearer <token>"
```

**Example success response** — `200`

```json
{
  "success": true,
  "notification": { "_id": "66f3a1…", "isRead": true, "readAt": "2026-11-04T11:05:00.000Z" }
}
```

**Common errors**
- `401` — not authenticated.
- `404` — notification not found **or** not owned by the caller (the query is
  scoped by `recipient`).

### DELETE /api/notifications/:id
Delete one notification (must be owned by the caller).

**Access:** authenticated &nbsp;•&nbsp; **owner**

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Notification ObjectId. |

**Example request**

```bash
curl -X DELETE http://localhost:5000/api/notifications/66f3a1b2c3d4e5f601234567 \
  -H "Authorization: Bearer <worker-token>"
```

**Example success response** — `200`

```json
{ "success": true, "message": "Notification deleted." }
```

**Common errors**
- `401` — not authenticated.
- `404` — notification not found or not owned by the caller.

---

## AI

Mounted at `/api/ai`. The verify endpoint carries its own tighter rate limiter
(20 / minute) because inference is CPU heavy.

### POST /api/ai/verify
Classify an uploaded image as waste / not-waste and return a confidence score.
Used from the "Report waste" form before submission. The image is held in memory
so a rejected photo is never written to disk.

**Access:** public &nbsp;•&nbsp; **Rate limit:** 20 / min

**Form-data fields** (`multipart/form-data`)

| Field | Type | Required | Description | Validation rules |
| --- | --- | --- | --- | --- |
| `image` | file | yes | Image to classify. | image MIME types; ≤ `MAX_FILE_UPLOAD_MB` (5 MB); one file; held in memory |

**Example request**

```bash
curl -X POST http://localhost:5000/api/ai/verify \
  -F "image=@waste.jpg"
```

**Example success response** — `200`

```json
{
  "success": true,
  "isWaste": true,
  "confidence": 84,
  "label": "plastic-packaging-waste",
  "engine": "heuristic",
  "model": "jimp-color-texture-heuristic",
  "labels": [
    { "label": "plastic-packaging-waste", "probability": 0.84 },
    { "label": "avg-saturation 0.412", "probability": 0.412 },
    { "label": "edge-density 0.0712", "probability": 0.593 },
    { "label": "sky-ratio 0.021", "probability": 0.021 }
  ],
  "message": "Waste detected with 84% confidence."
}
```

**Common errors**
- `400` — no `image` field; empty/buffer-less file; file is not a valid image
  (< 64 bytes); unsupported MIME type.
- `429` — more than 20 verifications in a minute.
- `503` — server-side verification is disabled (`AI_VERIFY_ENABLED=false`); or
  no engine could analyse the image.

### GET /api/ai/status
Diagnostic endpoint reporting which inference engine is currently active.

**Access:** public

**Path params:** none &nbsp;|&nbsp; **Query params:** none &nbsp;|&nbsp; **Body:** none

**Example request**

```bash
curl http://localhost:5000/api/ai/status
```

**Example success response** — `200`

```json
{
  "success": true,
  "enabled": true,
  "minConfidence": 60,
  "rejectInvalid": false,
  "engine": "mobilenet-v2",
  "tensorflowAvailable": true,
  "tensorflowError": null,
  "keywords": 121
}
```

**`engine` field values** (from `getClassifierInfo`):

| Value | Meaning |
| --- | --- |
| `mobilenet-v2` | The primary TensorFlow.js MobileNetV2 engine is loaded and active. |
| `heuristic` | MobileNet was unavailable, so the deterministic jimp colour/texture heuristic is used. |
| `not-loaded` | Verification is enabled but no engine has been initialised yet. |
| `disabled` | `AI_VERIFY_ENABLED` is `false`. |

**Common errors:** none expected — the endpoint reports state in the payload
rather than failing.

---

## Rate limits

Three `express-rate-limit` layers apply (all return `429` with a JSON
`{ success: false, message }` body):

| Scope | Window | Max | Notes |
| --- | --- | --- | --- |
| Global `/api` | 15 minutes | `600` | Applied in `backend/server.js`; generous because a dashboard issues several parallel calls. |
| Auth (`POST /api/auth/register`, `POST /api/auth/login`) | 15 minutes | `20` | Brute-force protection in `backend/routes/authRoutes.js`. |
| AI (`POST /api/ai/verify`) | 1 minute | `20` | Protect the Node event loop from CPU-heavy inference. |

---

## Demo credentials

Defined in `backend/seed.js` (run `npm run seed`). Overridable via the `SEED_*`
environment variables.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@swms.gov` | `Admin@123` |
| Field worker | `worker@swms.gov` | `Worker@123` |
| Field worker | `worker2@swms.gov` | `Worker@123` |
| Citizen | `user@swms.gov` | `User@123` |
| Citizen | `citizen2@swms.gov` | `User@123` |

> **Note:** administrator accounts are **not** self-service — they are created
> only by the seed script or by another admin. Public registration can produce
> only `user` or `worker` accounts.

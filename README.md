# Field Trip Spot Logger

A REST API for logging places you have visited (hikes, viewpoints, plant sightings, historic sites) with coordinates and ratings. Anyone can browse spots. Registered users can add spots and rate them once each. Admins manage categories and moderate content.

**Stack:** NestJS, TypeScript, Prisma 7, PostgreSQL (Neon), JWT authentication, bcrypt.

## Features

- Register and log in with hashed passwords and 1-hour JWT access tokens
- Role-based access control (`EXPLORER`, `ADMIN`) plus ownership checks
- Category and Spot CRUD with input validation
- Spot search, category filter and pagination
- One rating (1 to 5) per user per spot, enforced by the database
- Average rating and visit count on each spot
- `GET /users/profile` for the logged-in user
- Login rate limiting (5 attempts per minute)
- Seed script with 16 Kenyan spots across 4 categories
- Postman collection with automated `pm.test` checks

## Prerequisites

- Node.js 20 or newer and npm
- A free [Neon](https://neon.tech) PostgreSQL project
- Postman (optional, for the API collection)

## Setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/davy254/field-trip-spot-logger.git
   cd field-trip-spot-logger/api
   npm install
   ```
2. Create your environment file. Copy `api/.env.example` to `api/.env` and fill in your own values. [Getting the values](#getting-the-values) explains where each one comes from, including `SEED_PASSWORD`. Never commit `.env`.
3. Generate the Prisma client and create the tables:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```
4. Seed the database:
   ```bash
   npx tsx prisma/seed.ts
   ```
5. Start the API:
   ```bash
   npm run start:dev
   ```
   The API listens on `http://localhost:3000` unless `PORT` is set.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon **direct** connection string (not the pooled one), ending in `?sslmode=require`. Migrations do not work reliably through a pooler. |
| `JWT_SECRET` | Yes | Long random string used to sign tokens. The app refuses to start without it. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `SEED_PASSWORD` | For seeding | A password **you choose**. Both seeded accounts get it, and you use it to log in as them. Development use only. |
| `PORT` | No | Port to listen on (default `3000`). |

### Getting the values

Nothing here is downloaded or issued to you. Two values you generate or choose yourself, and one you copy from Neon.

**`DATABASE_URL` (copy from Neon).** In the Neon dashboard, open your project and click **Connect**. Turn the **Connection pooling** toggle off so you get the **direct** string, then copy it. Keep the `?sslmode=require` ending.

**`JWT_SECRET` (generate it).** Run this and paste the output:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**`SEED_PASSWORD` (you choose it).** There is no existing password to look up. Pick any password you like for local development. It is only used by `prisma/seed.ts`, which hashes it with bcrypt and saves the hash for the two seeded accounts. Rules of thumb:

- Use at least 8 characters, letters and numbers only (this avoids quoting problems in `.env`).
- Do not reuse a real password. It is shared by both seeded accounts and is for development only.
- If you want a random one, generate it:

  ```bash
  node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))"
  ```

Put all three in `api/.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="the-64-character-string-you-generated"
SEED_PASSWORD="the-password-you-chose"
```

Then run the seed. After it finishes, you log in as either seeded account with the email from the table below and **the exact `SEED_PASSWORD` you chose**:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"explorer@spotlogger.test","password":"the-password-you-chose"}'
```

The same value goes into the `seedPassword` variable when you use the Postman collection.

> **Changing it later:** the seed creates the two accounts with `upsert` and leaves existing users unchanged. If you change `SEED_PASSWORD` after the accounts exist, logins keep using the **old** password. To make a new value take effect, change `update: {}` to `update: { password: passwordHash }` in both `user.upsert` calls in `prisma/seed.ts`, then run the seed again.

### Seeded accounts

| Email | Role | Password |
|---|---|---|
| `admin@spotlogger.test` | `ADMIN` | the value of `SEED_PASSWORD` |
| `explorer@spotlogger.test` | `EXPLORER` | the value of `SEED_PASSWORD` |

> **Warning:** the seed script clears all spots and visits before recreating them, so re-running it removes any spots or visits you added. Users and categories are kept (they are upserted).

### Useful scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Start with automatic reload |
| `npm run build` | Compile TypeScript (shows every type error) |
| `npx prisma format` | Tidy and check the schema |
| `npx prisma migrate dev --name <name>` | Create and apply a migration after a schema change |
| `npx prisma generate` | Regenerate the typed client |
| `npx prisma studio` | Browse and edit data in a browser |

## Project structure

```
field-trip-spot-logger/
  README.md
  docs/
    postman_collection.json
  api/
    .env                  (never committed)
    .env.example
    prisma.config.ts
    prisma/
      schema.prisma
      seed.ts
      migrations/
    src/
      main.ts
      app.module.ts
      generated/prisma/   (generated, not committed)
      prisma/             (global PrismaService)
      auth/               (register, login, JWT strategy, guards)
      categories/
      spots/
      visits/
      users/
```

Each feature module follows the same layers:

| Layer | Job |
|---|---|
| Controller | Maps URLs and HTTP methods to service calls. No logic. |
| Service | Business rules and database access. Knows nothing about HTTP. |
| DTO | Describes and validates what a request body must look like. |

## Schema decisions

### Spot and Visit are separate models
A spot is a place. A visit is one user's record of it (rating and note). Keeping them separate lets many users rate the same spot without duplicating the place (one source of truth). The trade-off is that reading a spot with its ratings needs a join.

### One visit per user per spot
`@@unique([spotId, userId])` makes the database enforce this rule, so it holds even if application code has a bug. The API checks first so clients get a friendly 409 instead of a raw database error.

### Categories are referenced, not typed
A spot points to a `Category` by id. Renaming a category updates it everywhere, and typos cannot create near-duplicate categories.

### Coordinates
`latitude` and `longitude` are stored as `Float` (decimal degrees). Prisma cannot express range limits, so the DTO enforces latitude from -90 to 90 and longitude from -180 to 180. A composite index on `(latitude, longitude)` is in place for future area queries.

### Enums, unique and optional fields
- `Role` is an enum, so only valid roles can be saved.
- `email` and category `name` are unique to prevent duplicates.
- `description` and `note` are optional because they may genuinely be unknown.

### Delete behaviour
- Deleting a spot or user cascades to their visits (a visit without a spot is meaningless).
- Deleting a category that still has spots is blocked, and the API returns a clear 409.

## API overview

All bodies and responses are JSON. Protected routes need the header `Authorization: Bearer <accessToken>`.

| Method | Route | Access |
|---|---|---|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public (rate limited) |
| GET | `/categories` | Public |
| GET | `/categories/:id` | Public |
| POST | `/categories` | ADMIN |
| PATCH | `/categories/:id` | ADMIN |
| DELETE | `/categories/:id` | ADMIN |
| GET | `/spots` | Public |
| GET | `/spots/:id` | Public (includes category, creator, average rating, visit count) |
| POST | `/spots` | Logged-in user |
| PATCH | `/spots/:id` | Spot owner or ADMIN |
| DELETE | `/spots/:id` | Spot owner or ADMIN |
| GET | `/spots/:spotId/visits` | Public |
| POST | `/spots/:spotId/visits` | Logged-in user (one per spot) |
| PATCH | `/visits/:id` | Visit owner only |
| DELETE | `/visits/:id` | Visit owner or ADMIN |
| GET | `/users/profile` | Logged-in user (own data only) |

### Listing spots: query parameters

`GET /spots` accepts:

| Parameter | Default | Notes |
|---|---|---|
| `categoryId` | none | Only spots in this category |
| `search` | none | Case-insensitive match on name or description |
| `page` | `1` | Values below 1 are treated as 1 |
| `limit` | `10` | Clamped between 1 and 100 |

Filters combine, for example `/spots?search=forest&categoryId=3&page=1&limit=5`.

Response shape:

```json
{
  "data": [ { "id": 1, "name": "Mount Longonot Crater Rim", "category": { "id": 1, "name": "Hiking Trail" } } ],
  "meta": { "total": 16, "page": 1, "limit": 10, "totalPages": 2 }
}
```

### Validation rules

| Resource | Field | Rule |
|---|---|---|
| Register | `email` | Valid email, trimmed and lowercased |
| Register | `name` | Required, up to 80 characters |
| Register | `password` | 8 to 72 characters |
| Category | `name` | Required, trimmed, up to 50 characters, unique |
| Spot | `name` | Required, trimmed, up to 120 characters |
| Spot | `description` | Optional, up to 1000 characters |
| Spot | `latitude` | Number from -90 to 90 |
| Spot | `longitude` | Number from -180 to 180 |
| Spot | `categoryId` | Integer of an existing category |
| Visit | `rating` | Integer from 1 to 5 |
| Visit | `note` | Optional, up to 500 characters |

Unknown fields are stripped from every request body (`whitelist: true`), which blocks mass-assignment attacks such as sending `"role": "ADMIN"` at registration.

### Error responses

| Status | Meaning |
|---|---|
| 400 | Invalid input or a malformed id or query value |
| 401 | Missing, invalid or expired token, or wrong login credentials |
| 403 | Logged in but not allowed (wrong role or not the owner) |
| 404 | The resource, or a resource it refers to, does not exist |
| 409 | Conflict: duplicate email, category name or visit, or deleting a category that is still in use |
| 429 | Too many login attempts |

## Auth decisions

- Passwords are hashed with bcrypt (cost 10) and the hash is never returned. Every query that returns user data uses `select` to list exactly the safe fields.
- Tokens are JWTs that expire after 1 hour and carry `sub` (user id), `email` and `role`. A JWT is encoded, not encrypted, so it must never hold secrets.
- Registration always creates an `EXPLORER`. Admins are created directly in the database.
- The role is stored in the token, so a changed role takes effect only after the user logs in again. A demoted admin keeps admin access until their token expires (at most 1 hour). Looking the user up on every request would close that gap at the cost of one extra query per request.
- Login returns the same error for an unknown email and a wrong password, so attackers cannot discover which emails are registered.
- The identity of the caller always comes from the verified token, never from the request body. For example, a spot's creator is `req.user.id`.
- Write access is enforced on the server with guards, not just hidden in a client.

### Who can do what

| Action | Anonymous | EXPLORER | ADMIN |
|---|---|---|---|
| Browse categories, spots and visits | Yes | Yes | Yes |
| Create, edit or delete categories | No | No | Yes |
| Create a spot | No | Yes | Yes |
| Edit or delete a spot | No | Own spots | Any spot |
| Log a visit | No | Yes (once per spot) | Yes (once per spot) |
| Edit a visit | No | Own visits | Own visits only |
| Delete a visit | No | Own visits | Any visit (moderation) |

## Rate limiting

`POST /auth/login` allows 5 attempts per minute per client IP. The 6th attempt within that minute returns **429 Too Many Requests**. Only login is limited.

## Testing with Postman

The collection at `docs/postman_collection.json` has 38 requests with 75 `pm.test` assertions.

1. Import the file into Postman.
2. Open the collection's **Variables** tab and enter the `SEED_PASSWORD` value from your `api/.env` in the **Current value** column of `seedPassword` only. Postman exports Initial values, so the password stays out of the file.
3. Make sure the API is running and the database is seeded.
4. Right-click the collection, choose **Run collection**, keep the four folders in order, and click **Run**.

| Folder | Token | Purpose |
|---|---|---|
| 1 Public | none | Browsing, search, filtering, pagination, limit capping |
| 2 Explorer flow | explorer | Profile, create spot, rate it, duplicate and invalid ratings |
| 3 Failure checks | explorer | 401, 403, 400 and 404 cases |
| 4 Admin flow and cleanup | admin | Category management, moderation, removes its own test data |

A full run logs in three times, so wait about a minute between runs to stay under the login rate limit.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `datasource.url property is required` | Prisma 7 reads the URL from the config file | Check that `prisma.config.ts` loads `dotenv/config` and `DATABASE_URL` |
| First command after a pause times out | Neon scales to zero when idle | Run the command again |
| Migration fails or hangs | Using the pooled connection string | Use the direct string (no `-pooler` in the host) |
| Cannot find module `../generated/prisma/client` | Client not generated yet | `npx prisma generate`, then restart the editor's TypeScript server |
| `JWT_SECRET is not set` | Missing `.env` line | Add it to `api/.env` |
| `Unknown authentication strategy "jwt"` | `JwtStrategy` not provided or `AuthModule` not imported | Register both |
| 401 with a valid-looking token | Wrong header format or expired token | Use `Authorization: Bearer <token>` and log in again |
| 403 for a freshly promoted admin | Old token still carries the old role | Log in again |
| 429 while testing | Login rate limit working | Wait a minute |
| Code edits seem ignored | Compile error, so watch mode keeps serving the last good build | Read the terminal or run `npm run build` |
| bcrypt fails to load | Install script blocked | `npm install-scripts approve bcrypt` and reinstall, or use `bcryptjs` |
| Seed stops with `SEED_PASSWORD is not set` | Missing `.env` line | Add `SEED_PASSWORD` to `api/.env` (see [Getting the values](#getting-the-values)) |
| Seeded login returns 401 | Typo in the password, or `SEED_PASSWORD` was changed after the accounts were created | Use the exact value you seeded with, or apply the seed change described under "Changing it later" and re-seed |

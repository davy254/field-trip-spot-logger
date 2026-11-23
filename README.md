# Field Trip Spot Logger

A REST API for logging places you have visited (hikes, viewpoints, plant sightings, historic sites) with coordinates and ratings. Built with NestJS, Prisma 7 and PostgreSQL (Neon).

## Setup
1. `cd api && npm install`
2. Copy `api/.env.example` to `api/.env` and fill in your own values. Never commit `.env`.
3. `npx prisma generate` then `npx prisma migrate dev`
4. `npx tsx prisma/seed.ts`
5. `npm run start:dev`

## Schema Decisions

### Spot and Visit are separate models
A spot is a place, and a visit is one user's record of it. Keeping them separate means many users can rate the same spot without duplicating the place (one source of truth). The trade-off is that reading a spot with its ratings needs a join.

### One visit per user per spot
`@@unique([spotId, userId])` makes the database enforce this rule, so it holds even if application code has a bug.

### Referencing categories instead of storing text
A spot points to a `Category` by id. Renaming a category changes it everywhere, and typos can't create near-duplicate categories.

### Enums, unique and optional fields
- `Role` is an enum so only valid roles can be saved.
- `email` and category `name` are unique to prevent duplicates.
- `description` and `note` are optional because they may genuinely be unknown.

### Delete behaviour
Deleting a spot or user cascades to their visits. Deleting a category that still has spots is blocked.


## API Overview
| Method | Route | Access |
|---|---|---|
| GET | /categories | Public |
| GET | /categories/:id | Public |
| POST | /categories | Admin (locked down in the auth lesson) |
| PATCH | /categories/:id | Admin (locked down in the auth lesson) |
| DELETE | /categories/:id | Admin (locked down in the auth lesson) |
| POST | /auth/register | Public |
| POST | /auth/login | Public |
| POST | /categories | ADMIN |
| PATCH | /categories/:id | ADMIN |
| DELETE | /categories/:id | ADMIN |
| POST | /spots | Logged-in user |
| PATCH | /spots/:id | Owner or ADMIN |
| DELETE | /spots/:id | Owner or ADMIN |
| GET | /spots/:spotId/visits | Public |
| POST | /spots/:spotId/visits | Logged-in user (one per spot) |
| PATCH | /visits/:id | Visit owner only |
| DELETE | /visits/:id | Owner or ADMIN |
| GET | /users/profile | Logged-in user (own data only) |

## Auth decisions
- Passwords are hashed with bcrypt (cost 10) and never returned by the API.
- Tokens are JWTs that expire after 1 hour and carry `sub`, `email` and `role`.
- Registration always creates an EXPLORER. Admins are created directly in the database.
- Because the role is stored in the token, a changed role takes effect after the next login.
- Login returns one generic error for unknown email and wrong password.
- Write access is enforced on the server with guards, not just hidden in a client.



## Rate limiting
`POST /auth/login` allows 5 attempts per minute per IP and returns 429 after that.

## Trying it out
Import `docs/postman_collection.json`. Fill in the `seedPassword` variable (Current value only), run **Login (explorer)** first, then work through the folders. The **Failure checks** folder demonstrates the 400, 401 and 403 responses.
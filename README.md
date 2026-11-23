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
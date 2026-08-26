# Backend Development Guide

## Project Architecture
- **`app.js`**: Configures and initializes the Express application instance, attaches global middlewares, and mounts top-level routes.
- **`server.js`**: Application entry point responsible for initializing environment configuration, connecting to necessary services, and starting the HTTP server on the configured port.
- **`routes/`**: Defines API route definitions and maps incoming HTTP endpoints and methods to their respective controller functions.
- **`controllers/`**: Handles incoming HTTP requests, extracts parameters/payloads, invokes relevant service logic, and formats HTTP responses.
- **`services/`**: Encapsulates core business logic, domain operations, and orchestrations independent of HTTP transport details.
- **`middleware/`**: Houses custom Express middlewares such as authentication checks, request validation, logging, and centralized error handling.
- **`db/`**: Manages database client setup, connection pooling, migrations, and database query executions.
- **`utils/`**: Contains shared helper functions, constants, and utility modules used across the backend.
- **`tests/`**: Contains unit, integration, and end-to-end tests for verifying backend functionality.

## Domain & Data Architecture

### Hierarchy
```
State
  ↓
District
  ↓
Village
  ↓
Farm (farm_id, name, owner_name, village_id, total_land_area_hectares)
  ↓
Farm Crop Records (record_id, farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id)
  ↓
Audits (audit_id, record_id, auditor_id, actual_irrigation_method_id, adoption_status, audit_date, notes)
```

### Actor Model & Entity Separation
- **Authenticated System Users (`users` table)**:
  - `VILLAGE_HEAD`: Assigned `village_id`. Manages farms and seasonal farm crop records for their assigned village.
  - `AUDITOR`: Assigned `district_id`. Verifies post-season irrigation adoption by recording audits on farm crop records for farms in their district.
  - `GOVERNMENT_EMPLOYEE`: Broader administrative/policy oversight.
  - `ADMIN`: Platform account and system configuration.
- **Farms (`farms` entity - NOT authenticated users)**:
  - The system tracks individual **FARMS** rather than farmer personal accounts.
  - A farm belongs to exactly one village (`village_id`).
  - Farmers / farm owners do NOT have user accounts and never log into or directly interact with the platform.
- **Agricultural Lookups**:
  - `seasons`: `Kharif`, `Rabi`, `Zaid`.
  - `crops`: `Rice` (High), `Wheat` (Medium), `Millet` (Low).
  - `irrigation_methods`: `Flood Irrigation`, `Drip Irrigation`, `Sprinkler Irrigation`.
- **Deferred Functionality (Intentionally NOT in Database Schema)**:
  - Machine Learning & Groundwater predictions
  - Irrigation recommendation engines
  - Government schemes & interventions
  - Performance calculations & village scoring
  - Credits, credit wallets, transactions, & scheme redemption
  - GIS / PostGIS extensions

## Current Progress
- [x] Project setup
- [x] Express application
- [ ] Environment configuration
- [ ] Middleware
- [ ] Routing
- [ ] Controllers
- [x] PostgreSQL connection
- [x] Database schema
- [x] Application APIs (Farms, Seasonal Crop Records, & Audits completed)
- [x] Authentication
- [ ] GEE integration
- [ ] ML integration
- [ ] Testing
- [ ] Deployment

## Development Rules
- Work on one stage at a time.
- Do not implement future stages unless explicitly requested.
- Keep the architecture modular.
- Do not add dependencies unless they are necessary.
- Do not put secrets or credentials in Git.
- Do not create duplicate functionality.
- Prefer simple implementations over unnecessary abstractions.
- Before modifying existing architecture, explain why the change is necessary.

## Change Log

### 2026-08-25
- **Task**: Database Migration & Connection Configuration to `.env` Supabase Database
- **Files Changed**:
  - `.env`
  - `src/db/index.js`
  - `scratch/migrate_and_seed_env_db.js`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - **Supabase Cloud Migration**: Configured environment database connection details in `.env` (`aws-0-ap-south-1.pooler.supabase.com` session pooler on port 5432, user `postgres.kyvgcntvkojpsxjpbogk`).
  - **SSL Support**: Updated `src/db/index.js` pool configuration to automatically enable SSL (`{ rejectUnauthorized: false }`) for non-localhost remote database hosts.
  - **Database Migration & Seeding**: Created and executed `scratch/migrate_and_seed_env_db.js` to run all 13 SQL migrations and 4 SQL seed scripts (`geography`, `agricultural lookups`, `schemes`, and `groundwater assessments`) sequentially against the `.env` database.
- **Verification Performed**:
  - Tested database connection against `.env` Supabase cloud instance.
  - Verified table creation and seed data insertion across all 12 tables (896 groundwater assessments, 425 villages, 22 districts, 5 schemes, 3 crops, 3 seasons, 3 irrigation methods, 1 state).
  - Executed full test suite (`npm test`) against the cloud database, achieving 100% pass rate across all 111 integration tests.

### 2026-08-24
- **Task**: Interactive Groundwater GIS Map & Collapsible detailed inspector
- **Files Changed**:
  - `database/migrations/011_create_groundwater_assessments.sql`
  - `database/seeds/004_groundwater_assessments_seed.sql`
  - `scratch/generate_groundwater_seeds.js`
  - `src/services/groundwaterAssessment.service.js`
  - `src/controllers/groundwaterAssessment.controller.js`
  - `src/routes/groundwaterAssessment.routes.js`
  - `src/app.js`
  - `frontend/index.html`
  - `frontend/style.css`
  - `frontend/app.js`
  - `tests/groundwaterAssessment.test.js`
  - `package.json`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - **Offline GeoJSON Boundary Copy**: Extracted and normalized a lightweight copy of Haryana districts to `frontend/haryana_districts.geojson` from the 34.5MB `india_district.geojson` to bypass browser performance overhead.
  - **Database Assessments Schema**: Created `groundwater_assessments` table and populated it with historical (2023-2024, 2024-2025) and predicted (2025-2026, 2026-2027) groundwater assessment metrics for all districts and villages.
  - **Interactive Drill-Down & Search**: Integrated Leaflet polygon and point styling based on database categories, top summary counters bar, collateral accordion inspector panels, and a searchable sub-region data table.
- **Verification Performed**:
  - Implemented 10 integration tests in `tests/groundwaterAssessment.test.js` validating authentication, scope/year filtering, state aggregation, and details responses.
  - Executed automated integration test suite with 100% pass rate.
  - Verified user experience using the browser subagent, confirming fully functioning map layers, dropdown selections, search box filters, and detailed metric expansions.

### 2026-08-22
- **Task**: End-to-End Prototype Demo Dashboard Implementation & Seed Schemes
- **Files Changed**:
  - `frontend/index.html`
  - `frontend/style.css`
  - `frontend/app.js`
  - `src/app.js`
  - `database/seeds/003_schemes_seed.sql`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - **Single Responsive Prototype Client**: Implemented a vanilla HTML/CSS/JS client in `frontend/` served directly by Express at `http://localhost:3000/`. Zero build tools, frameworks, or mock APIs.
  - **Role-Based Dynamic Views**:
    1. **Village Head Dashboard**: Manages farms in assigned village (`GET/POST /api/farms`), adds and views seasonal crop records (`GET/POST /api/farms/:farm_id/crop-records`), views audit verification results (read-only), and browses the informational government schemes catalog (`GET /api/schemes`).
    2. **Auditor Dashboard**: Displays a rapid verification grid of district farms and seasonal records (`GET /api/audits`), allowing one-click verification of irrigation adoption (`POST/PUT /api/audits`).
    3. **Admin Dashboard**: Provides full CRUD management of the informational government schemes catalog (`GET/POST/PUT/DELETE /api/schemes`).
  - **Prototype Credit Representation**: Confirmed that a "credit" in this prototype is strictly the verified status indicator (`ADOPTED`) resulting from an auditor field audit. No credit wallet, credit balance, spending, transaction ledger, or redemption logic exists.
  - **Demo Schemes Seed**: Seeded 5 realistic demo government schemes into PostgreSQL (`database/seeds/003_schemes_seed.sql`).
  - **Live API Monitor**: Displays the exact HTTP method, endpoint, status code, and response body for every real request.
- **Verification Performed**:
  - Seeded 5 demo schemes into PostgreSQL `backend_db`.
  - Created and executed `scratch/test_prototype_e2e.js` validating complete end-to-end user workflows for Village Head, Auditor, and Admin against live Express HTTP endpoints.
  - Confirmed 100% pass rate across the full 91-test automated integration suite (`npm test`).

### 2026-08-22
- **Task**: Informational Government Scheme API Layer Implementation & Role Authorization
- **Files Changed**:
  - `database/migrations/007_create_schemes.sql`
  - `src/services/scheme.service.js`
  - `src/controllers/scheme.controller.js`
  - `src/routes/scheme.routes.js`
  - `src/app.js`
  - `tests/scheme.test.js`
  - `package.json`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - **Informational Scope Only**: Schemes serve strictly as informative content (name, description, government level, benefits, eligibility text, application instructions, and external official portal link). Zero physical provisioning, zero subsidy processing, and zero credit redemption linkage.
  - **Admin Exclusive Write Authority**: Only `ADMIN` role can create (`POST /api/schemes`), update (`PUT /api/schemes/:id`), or delete (`DELETE /api/schemes/:id`) schemes.
  - **Authenticated Read Access**: All authenticated system users (`VILLAGE_HEAD`, `AUDITOR`, `GOVERNMENT_EMPLOYEE`, `ADMIN`) can view available schemes (`GET /api/schemes` and `GET /api/schemes/:id`).
  - **Non-Admin Write Protection**: Modification/deletion attempts by non-admin roles return `HTTP 403 Forbidden`.
  - **Input Validation**: Validates required name, description, and external URL format (http/https).
  - Parameterized all SQL queries against SQL injection.
- **Verification Performed**:
  - Applied migration `007_create_schemes.sql` against `backend_db`.
  - Implemented 22 automated integration tests in `tests/scheme.test.js` verifying authentication, admin CRUD workflows, non-admin write/delete rejection, input validation, 404 handling, and database persistence.
  - Executed full test suite (91 integration tests: 14 Auth + 12 Farm + 23 Crop Record + 20 Audit + 22 Scheme) achieving 100% pass rate.

### 2026-08-22
- **Task**: Seasonal Crop Record API Layer Implementation & Geographic Authorization
- **Files Changed**:
  - `src/services/cropRecord.service.js`
  - `src/controllers/cropRecord.controller.js`
  - `src/routes/cropRecord.routes.js`
  - `src/app.js`
  - `tests/cropRecord.test.js`
  - `package.json`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - **Village Head Exclusive Write Authority**: Only `VILLAGE_HEAD` role can create (`POST /api/farms/:farm_id/crop-records`) and update (`PUT /api/crop-records/:id`) seasonal crop records for farms belonging to their assigned `village_id`.
  - **Auditor Read Access & District Scoping**: `AUDITOR` role is granted read-only access (`GET /api/farms/:farm_id/crop-records` and `GET /api/crop-records/:id`) strictly bounded to farms situated in their assigned `district_id` (`farms` $\rightarrow$ `villages.district_id`). Write attempts by auditors return `HTTP 403 Forbidden`.
  - **Composite Uniqueness Enforcement**: Enforces the schema constraint `UNIQUE(farm_id, season_id, agricultural_year, crop_id)` on creation and updates, returning `HTTP 409 Conflict` on duplicate attempts without overwriting existing data.
  - **Farm ID Immutability**: `farm_id` cannot be changed on update to prevent cross-farm translocation of agricultural history.
  - **Independence from Audits**: Seasonal crop records maintain pure agricultural data (season, year, crop, area, current irrigation method) completely separate from audit records.
  - Parameterized all SQL queries against SQL injection.
- **Verification Performed**:
  - Implemented 23 automated integration tests in `tests/cropRecord.test.js` verifying authentication, Village Head village-level authorization, Auditor district-level read access, Auditor write blocking, duplicate conflict rejection, IDOR security, and database persistence.
  - Executed full test suite (69 integration tests: 14 Auth + 12 Farm + 23 Crop Record + 20 Audit) achieving 100% pass rate.

### 2026-08-22
- **Task**: Audit Verification API Layer Implementation & District-Level Geographic Authorization
- **Files Changed**:
  - `src/services/audit.service.js`
  - `src/controllers/audit.controller.js`
  - `src/routes/audit.routes.js`
  - `src/app.js`
  - `tests/audit.test.js`
  - `package.json`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - **Auditor Role Restriction for Write Operations**: Only `AUDITOR` role can create (`POST /api/audits`) or update (`PUT /api/audits/:id`) audit verification records. Other roles (`VILLAGE_HEAD`, `GOVERNMENT_EMPLOYEE`, `ADMIN`) receive `HTTP 403 Forbidden`.
  - **Server-Side District-Level Authorization**: An auditor's assigned `district_id` must match the crop record's farm's village's `district_id` (`farm_crop_records` $\rightarrow$ `farms` $\rightarrow$ `villages.district_id`). Any cross-district attempt returns `HTTP 403 Forbidden`.
  - **Village Head Read Access**: `VILLAGE_HEAD` users are permitted read access (`GET /api/audits` and `GET /api/audits/:id`) strictly for audits associated with farms in their assigned `village_id`, while write/tamper attempts return `HTTP 403 Forbidden`.
  - **IDOR Protection**: Full cross-district and cross-village defense prevents enumeration or retrieval of audit records outside authorized jurisdictions.
  - **Auditor Ownership & Immutability**: The authenticated user's ID is automatically assigned as `auditor_id` on creation and is immutable during updates.
  - **Schema Note on Audit Uniqueness**: The current schema does not have a `UNIQUE(record_id)` constraint on the `audits` table, allowing multiple or longitudinal verification visits per crop record while maintaining relational integrity.
  - Parameterized all SQL queries against SQL injection.
- **Verification Performed**:
  - Implemented 20 automated integration tests in `tests/audit.test.js` testing unauthenticated access, invalid JWT, role rejection, district authorization, cross-district rejection, IDOR security protection, Village Head read access and write rejection, auditor ID immutability, input validation, and PostgreSQL persistence.
  - Executed full test suite (46 integration tests: 14 Auth + 12 Farm + 20 Audit) achieving 100% pass rate.

### 2026-08-22
- **Task**: Farm Management API Layer Implementation & Geographic Authorization
- **Files Changed**:
  - `src/services/farm.service.js`
  - `src/controllers/farm.controller.js`
  - `src/routes/farm.routes.js`
  - `src/app.js`
  - `tests/farm.test.js`
  - `package.json`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - Implemented Farm CRUD service layer restricted to `VILLAGE_HEAD` role.
  - **Server-Side Geographic Authorization**: A `VILLAGE_HEAD` can only create, list, inspect, and update farms belonging to their assigned `village_id`.
  - **IDOR Protection & Cross-Village Defense**: Any attempt to access or update farms in another village returns `HTTP 403 Forbidden`.
  - **Immutable Village Assignment**: `village_id` is validated on creation and made immutable on update.
  - Parameterized all SQL queries against SQL injection.
  - Endpoints:
    - `POST /api/farms`: Create farm in assigned village (201 Created).
    - `GET /api/farms`: Retrieve all farms in assigned village (200 OK).
    - `GET /api/farms/:id`: Retrieve single farm details within village jurisdiction (200 OK / 403 / 404).
    - `PUT /api/farms/:id`: Update farm details within village jurisdiction (200 OK / 403 / 404).
- **Verification Performed**:
  - Created 12 automated integration tests in `tests/farm.test.js` testing unauthenticated access, non-village-head role rejection, cross-village creation rejection, filtered list retrieval, IDOR protection on single farm retrieval, cross-village update rejection, immutable village ID enforcement, input validation, and 404 handling.
  - Executed entire test suite (26 integration tests: 14 Auth + 12 Farm) achieving 100% pass rate.

### 2026-08-22
- **Task**: Authentication Security Hardening — Prohibit ADMIN Public Registration & Geographic Self-Assignment
- **Files Changed**:
  - `src/utils/constants.js`
  - `src/services/auth.service.js`
  - `tests/auth.test.js`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - Defined `PUBLIC_REGISTRATION_ROLES` (`VILLAGE_HEAD`, `AUDITOR`, `GOVERNMENT_EMPLOYEE`), explicitly excluding `ADMIN`.
  - Rejection of `ADMIN` in public registration with `HTTP 403 Forbidden` (*"Registration as ADMIN is not permitted via public registration"*).
  - Explicitly excluded `district_id` and `village_id` from registration persistence to guarantee users cannot self-assign geographic authority.
  - Expanded test suite to 14 automated integration tests covering `ADMIN` registration rejection, invalid role rejection, duplicate email, prevented geographic self-assignment, token authentication, and role authorization.
- **Verification Performed**:
  - Executed all 14 integration tests via `npm test`, achieving 100% pass rate.
  - Verified against PostgreSQL that no `ADMIN` user or geographic assignment is created via public registration.

### 2026-08-22
- **Task**: Database Schema Implementation (Farms, Agricultural Lookups, Seasonal Farm Crop Records, Audits) & Seeds
- **Files Changed**:
  - `database/migrations/003_create_farms.sql`
  - `database/migrations/004_create_agricultural_lookups.sql`
  - `database/migrations/005_create_farm_crop_records.sql`
  - `database/migrations/006_create_audits.sql`
  - `database/seeds/002_agricultural_lookup_seed.sql`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - Created `farms` table (`farm_id`, `name`, `owner_name`, `village_id` FK, `total_land_area_hectares`, `created_at`).
  - Created agricultural lookup tables: `seasons` (`season_id`, `name` UNIQUE), `crops` (`crop_id`, `name` UNIQUE, `water_requirement` CHECK), and `irrigation_methods` (`method_id`, `name` UNIQUE).
  - Created `farm_crop_records` table to preserve longitudinal historical agricultural data with composite uniqueness constraint `UNIQUE (farm_id, season_id, agricultural_year, crop_id)`.
  - Created `audits` table (`audit_id`, `record_id` FK, `auditor_id` FK, `actual_irrigation_method_id` FK, `adoption_status` CHECK `('PENDING', 'ADOPTED', 'NOT_ADOPTED')`, `audit_date`, `notes`, `created_at`).
  - Seeded prototype agricultural lookups (`database/seeds/002_agricultural_lookup_seed.sql`).
  - Confirmed: Zero deferred fields (credits, schemes, recommendations, predictions) added to any table.
- **Verification Performed**:
  - Applied migrations 003-006 and seed 002 against `backend_db`.
  - Verified all 10 domain and system tables, primary keys, foreign keys, and unique constraints.
  - Executed transactional relational workflow test (Farm -> Farm Crop Record -> Audit) verifying unique constraints and status check constraints.
  - Verified all 12 authentication integration tests continue to pass with `npm test`.

### 2026-08-22
- **Task**: Geography Foundation & User Geographic Assignment Implementation
- **Files Changed**:
  - `database/migrations/002_create_geography.sql`
  - `database/seeds/001_geography_seed.sql`
  - `src/services/auth.service.js`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - Implemented normalized geography schema with `SERIAL PRIMARY KEY`s:
    - `states`: (`state_id`, `name` UNIQUE)
    - `districts`: (`district_id`, `name`, `state_id` FK, `UNIQUE(name, state_id)`)
    - `villages`: (`village_id`, `name`, `district_id` FK, `UNIQUE(name, district_id)`)
  - Added geographic assignment foreign key columns to `users`:
    - `district_id` (`REFERENCES districts(district_id)`): Used by `AUDITOR` to govern their auditing scope.
    - `village_id` (`REFERENCES villages(village_id)`): Used by `VILLAGE_HEAD` to govern their village farm management scope. Their district is derived via `villages.district_id`.
  - Created prototype geographic seed data: 1 State (*Haryana*), 2 Districts (*Karnal*, *Kurukshetra*), and 4 Villages (*Gharaunda*, *Indri*, *Pehowa*, *Shahbad*).
  - Kept JWT token payload strictly minimal (`{ id, role }`).
  - Confirmed: Farmers are NOT system users; farms will be implemented in the subsequent domain stage.
- **Verification Performed**:
  - Successfully executed migration `002_create_geography.sql` and seed `001_geography_seed.sql` against `backend_db`.
  - Verified `states`, `districts`, and `villages` tables, foreign keys, unique composite constraints, and sequences.
  - Verified `users.district_id` and `users.village_id` columns and foreign key constraints.
  - Tested constraint enforcement: verified rejection of non-existent state/district IDs, duplicate district names in a state, and duplicate village names in a district.
  - Verified user geographic assignments for `VILLAGE_HEAD` and `AUDITOR`.
  - Verified all 12 authentication integration tests continue to pass with `npm test`.

### 2026-08-22
- **Task**: Domain Model Specification Update — Farm-Centric Tracking
- **Files Changed**:
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - Updated domain specifications: The platform tracks individual **FARMS** (`farm_id`, `name`, `village_id`), NOT individual farmer accounts or user entities.
  - Confirmed hierarchy: `State` → `District` → `Village` → `Farm` → `Seasonal Records`.
  - Reaffirmed that farms/farmers are data subjects and NOT authenticated users; only `VILLAGE_HEAD`, `AUDITOR`, `GOVERNMENT_EMPLOYEE`, and `ADMIN` hold authentication accounts.
  - No database tables or authentication logic were modified in this step.

### 2026-08-22
- **Task**: Authentication & Role-Based Authorization Implementation
- **Files Changed**:
  - `package.json`
  - `package-lock.json`
  - `.env.example`
  - `.env`
  - `src/utils/constants.js`
  - `src/services/auth.service.js`
  - `src/middleware/auth.middleware.js`
  - `src/controllers/auth.controller.js`
  - `src/routes/auth.routes.js`
  - `src/app.js`
  - `tests/auth.test.js`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - Installed `bcryptjs` for secure password hashing (salt rounds = 10) and `jsonwebtoken` for stateless token-based authentication.
  - Implemented JWT token generation with minimal non-sensitive payload (`{ id, role }`) and configurable expiration (`24h`).
  - Read `JWT_SECRET` from environment variables, updated `.env.example` template without secrets, and kept `.env` ignored by Git.
  - Created authentication middleware `authenticateToken` requiring `Authorization: Bearer <token>` header, attaching decoded claims to `req.user`.
  - Created reusable role authorization middleware `requireRole(...allowedRoles)` verifying `req.user.role` with HTTP 403 Forbidden on mismatch.
  - Enforced authenticated system user roles (`VILLAGE_HEAD`, `AUDITOR`, `GOVERNMENT_EMPLOYEE`, `ADMIN`); disallowed non-system roles like `FARMER`.
  - Implemented endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, and `GET /api/auth/admin-test`.
  - Guaranteed `password` and `password_hash` are never returned in any API responses.
- **Verification Performed**:
  - Successfully executed all 12 test cases via `tests/auth.test.js`:
    1. Registered `VILLAGE_HEAD` (201 Created)
    2. Registered `AUDITOR` (201 Created)
    3. Registered `GOVERNMENT_EMPLOYEE` (201 Created)
    4. Registered `ADMIN` (201 Created)
    5. Verified duplicate email rejection (409 Conflict)
    6. Verified invalid role (`FARMER`) rejection (400 Bad Request)
    7. Verified login with valid credentials returning JWT (200 OK)
    8. Verified login with invalid password rejection (401 Unauthorized)
    9. Verified `GET /api/auth/me` with valid JWT (200 OK, no password leaked)
    10. Verified `GET /api/auth/me` without token rejection (401 Unauthorized)
    11. Verified `GET /api/auth/admin-test` access granted for `ADMIN` (200 OK)
    12. Verified `GET /api/auth/admin-test` access forbidden for non-admin `VILLAGE_HEAD` (403 Forbidden)
    13. Verified `password_hash` is completely excluded from all API response payloads.

### 2026-08-22
- **Task**: Database schema creation for authenticated system users
- **Files Changed**:
  - `database/migrations/001_create_users.sql`
  - `AGENTS.md`
- **Important Decisions & Architecture Notes**:
  - Created initial migration `database/migrations/001_create_users.sql` for the `users` table (`id`, `name`, `email`, `password_hash`, `role`, `created_at`).
  - **Authenticated System User Roles**: The system restricts login/system accounts strictly to:
    1. `VILLAGE_HEAD`
    2. `AUDITOR`
    3. `GOVERNMENT_EMPLOYEE`
    4. `ADMIN`
  - **Farmers are NOT authenticated system users**: Farmers do not interact with or log into the system; they are data subjects managed by village heads and audited by auditors. `FARMER` is not an authentication role and is disallowed by the `role` CHECK constraint.
  - Enforced `SERIAL PRIMARY KEY` on `id`, `NOT NULL` on required fields, `UNIQUE` on `email`, and `DEFAULT CURRENT_TIMESTAMP` on `created_at`.
- **Verification Performed**:
  - Executed migration against `backend_db` PostgreSQL database.
  - Verified table existence, column definitions, data types, nullability, and defaults against `information_schema.columns`.
  - Verified primary key (`users_pkey`), unique email constraint (`users_email_key`), and role check constraint (`users_role_check`).
  - Tested constraint enforcement: verified rejection of duplicate emails and rejection of invalid roles (e.g. `FARMER`).
  - Verified initial table row count is `0`.

### 2026-08-22
- **Task**: PostgreSQL connection pool setup and connectivity verification
- **Files Changed**:
  - `package.json`
  - `package-lock.json`
  - `.env.example`
  - `.env`
  - `src/db/index.js`
  - `src/server.js`
  - `src/app.js`
  - `AGENTS.md`
- **Important Decisions**:
  - Installed `pg` and `dotenv` for connection management and environment variable parsing.
  - Implemented database module `src/db/index.js` creating a reusable `pg.Pool` instance and `testConnection()` helper using environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).
  - Added connection test on server startup in `src/server.js` ensuring the server only listens if PostgreSQL is reachable, with clean error handling on failure.
  - Updated `GET /api/health` in `src/app.js` to perform a live database check and return database connection status and server time.
  - Updated `.env.example` with database connection keys without hardcoded secrets.
- **Verification Performed**:
  - Successfully tested connection to PostgreSQL database `backend_db`.
  - Started the server and verified startup logs confirming DB connection and HTTP listener on port 3000.
  - Verified `GET /api/health` returns HTTP 200 with `{ "status": "ok", "message": "API is running", "database": { "status": "connected", "serverTime": "..." } }`.
  - Tested failed connection error handling with invalid credentials.

### 2026-08-22
- **Task**: Express application setup and health check endpoint
- **Files Changed**:
  - `src/app.js`
  - `src/server.js`
  - `AGENTS.md`
- **Important Decisions**:
  - Configured Express instance with `express.json()` middleware in `src/app.js`.
  - Added minimal `GET /api/health` route in `src/app.js` returning `{ status: 'ok', message: 'API is running' }`.
  - Configured `src/server.js` to import the app and listen on port 3000 (defaulting to process.env.PORT).
  - Kept route definitions out of `src/server.js`.
- **Verification Performed**:
  - Started the server on port 3000.
  - Verified `GET /api/health` returns HTTP 200 with JSON payload `{"status":"ok","message":"API is running"}`.

### 2026-08-22
- **Task**: Initial project structure setup and AGENTS.md creation
- **Files Changed**:
  - `package.json`
  - `package-lock.json`
  - `.gitignore`
  - `.env.example`
  - `README.md`
  - `AGENTS.md`
  - `src/app.js`
  - `src/server.js`
  - `src/routes/`
  - `src/controllers/`
  - `src/services/`
  - `src/middleware/`
  - `src/db/`
  - `src/utils/`
  - `tests/`
- **Important Decisions**:
  - Initialized Node.js project using npm with Express installed.
  - Established modular directory structure keeping subdirectories empty until respective development stages.
  - Configured `src/server.js` as the application entry point and `src/app.js` for Express configuration.
  - Added `.env` and `node_modules/` to `.gitignore`.
- **Verification Performed**:
  - Verified directory layout matches required structure.
  - Verified Express installation and `package.json` configuration.
  - Verified syntax of `src/app.js` and `src/server.js`.

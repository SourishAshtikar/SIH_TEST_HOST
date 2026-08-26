# Groundwater Platform Frontend

React/Vite client for the Express API in `../Backend`. It deliberately uses
the backend's authenticated API contracts and role authorization rather than
any mock domain data.

## Run locally

1. Start the backend in `../Backend` with `npm start`.
2. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` if the backend is
   not running at `http://localhost:3000`.
3. Run `npm run dev` in this directory.

The backend allowlist defaults to this Vite origin. Set `CORS_ORIGINS` in the
backend environment for any additional deployed frontend origin.

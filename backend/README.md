# Groundwater Platform — Backend Service

This is the Node.js / Express backend service for the Groundwater Adoption & Agricultural Irrigation Platform, integrated with a Python ML microservice.

For complete, repository-wide environment setup instructions, please refer to the main [Project README](../README.md).

---

## 📂 Project Structure

```
backend/
├── src/
│   ├── app.js          # Express app configuration & global middleware
│   ├── server.js       # Server startup and port listening (starts Python FastAPI automatically)
│   ├── routes/         # API route declarations
│   ├── controllers/    # Express controllers (request validation and orchestrating service logic)
│   ├── services/       # Core business logic (ML microservice queries, sustainability scores, audits)
│   ├── middleware/     # Custom middleware (authentication, error handlers)
│   ├── db/             # PostgreSQL database connection and migrations
│   └── utils/          # Shared utility and helper functions
├── Model/              # ML components (XGBoost pipelines, FastAPI api_intergate.py, training scripts)
├── tests/              # Test suites for backend services and controllers
├── Dataset/            # Dataset files used for ML model training
├── postman/            # Postman collections for testing API endpoints
├── package.json        # Node.js dependencies and script entries
└── README.md           # This file
```

---

## 🏃 Running Backend Scripts

Available script commands inside `/backend`:

*   **Start server in development/production**:
    ```bash
    npm start
    ```
    This script tests the database connection, ensures schema migrations are run, and automatically boots the Node server (port `3000`) and the Python FastAPI model service (port `8000`).

*   **Run all test suites**:
    ```bash
    npm test
    ```
    Executes tests sequentially for Authentication, Farms, Crops, Audits, Schemes, Sustainability scores, heatmaps, and ML Recharge/GWL integrations.

---

## 📊 Database Initialization & Seeding

If setting up the system database from scratch, execute the following Node.js scripts sequentially in the `/backend` folder:

1.  **Initialize Schema & Tables**:
    ```bash
    node setup_db.js
    ```
    *(Creates tables for States, Districts, Blocks, Villages, Users, Farms, Crop Records, Audits, and Schemes)*

2.  **Import Haryana Villages Geo-data**:
    ```bash
    node seed_all_villages.js
    ```
    *(Imports regional boundaries, latitude/longitude, and default stations for simulation)*

3.  **Create Test Accounts**:
    ```bash
    node create_test_users.js
    ```
    *(Creates testing profiles for Village Heads, District Auditors, Government Employees, and Administrators)*

4.  **Seed Dummy Farms & Sustainability Metrics**:
    ```bash
    node seed_dummy_farms_and_scores.js
    ```

5.  **Assign Village Heads**:
    ```bash
    node assign_villages.js
    ```

---

## 🤖 Python ML Microservice Integration

The Node.js server automatically manages the Python FastAPI process tree. On startup, it checks if a local Python virtual environment (`.venv`) is available in the project root or backend directory. If found, it automatically uses that Python executable to run the ML endpoints.

If you make modifications to the model inference endpoints, they are defined in:
*   [api_intergate.py](file:///d:/Projects/SIH%2026/SIH_GroundWater_Backend/backend/Model/api_intergate.py)
*   You can manually run it outside Node.js using:
    ```bash
    # (Inside .venv)
    uvicorn Model.api_intergate:app --host 127.0.0.1 --port 8000 --reload
    ```

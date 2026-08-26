# Groundwater & Agricultural Irrigation Platform

An integrated IoT & Machine Learning-powered platform for Groundwater Assessment, Crop Recommendation, and Irrigation Method Adoption tracking.

The system features:
1. **Node.js/Express Backend**: Serves application APIs, handles authentication (JWT), audits, schemes, and sustainability scoring.
2. **Python FastAPI ML Microservice**: Predicts groundwater levels (GWL) and recharge metrics using trained XGBoost and Random Forest pipelines.
3. **Frontend Dashboard**: A responsive, Leaflet-mapped interactive interface to view farm-level records, run predictions, and visual analytics.

---

## 📋 Table of Contents
- [Prerequisites](#-prerequisites)
- [🚀 Quick Start (Automated Setup)](#-quick-start-automated-setup)
- [🛠️ Detailed Manual Setup](#%EF%B8%8F-detailed-manual-setup)
  - [1. Database Configuration](#1-database-configuration)
  - [2. Node.js Backend Setup](#2-nodejs-backend-setup)
  - [3. Python ML Microservice Setup](#3-python-ml-microservice-setup)
- [⚙️ Environment Variables](#%EF%B8%8F-environment-variables)
- [🏃 Running the Application](#-running-the-application)
- [📊 Seeding Initial Data](#-seeding-initial-data)
- [💻 Frontend Dashboard Access](#-frontend-dashboard-access)

---

## 📋 Prerequisites

Before setting up, ensure you have the following installed on your machine:

- **Node.js** (v18.x or higher) and `npm`
- **Python** (v3.8 to v3.11) and `pip`
- **PostgreSQL** (v14 or higher) running locally or remotely

---

## 🚀 Quick Start (Automated Setup)

We have provided automated scripts to check dependencies, install Node packages, create a Python virtual environment (`.venv`), and install all Python dependencies.

### On Windows (PowerShell)
1. Open PowerShell as Administrator (if needed to adjust execution policy) and run:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
   ```
2. Run the installer script from the root directory:
   ```powershell
   ./install.ps1
   ```

### On macOS / Linux (Bash)
1. Open a terminal and run the installer script from the root directory:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

---

## 🛠️ Detailed Manual Setup

If you prefer to configure the environment components manually, follow the steps below:

### 1. Database Configuration
1. Make sure your local PostgreSQL server is running.
2. Create a new database named `backend_db` (or any custom name):
   ```sql
   CREATE DATABASE backend_db;
   ```
3. Copy `backend/.env.example` to `backend/.env` and fill in your PostgreSQL credentials:
   ```bash
   cp backend/.env.example backend/.env
   ```
   *(See the [Environment Variables](#%EF%B8%8F-environment-variables) section below for details)*.

### 2. Node.js Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install the Node package dependencies:
   ```bash
   npm install
   ```

### 3. Python ML Microservice Setup
We recommend using a Python virtual environment to isolate project packages.

1. In the project root directory, create a virtual environment:
   ```bash
   # On Windows/macOS/Linux
   python -m venv .venv
   ```
2. Activate the virtual environment:
   ```bash
   # On Windows (PowerShell)
   .venv\Scripts\Activate.ps1
   
   # On Windows (CMD)
   .venv\Scripts\activate.bat
   
   # On macOS / Linux
   source .venv/bin/activate
   ```
3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

---

## ⚙️ Environment Variables

Create a `.env` file inside the `backend` folder. Example settings:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=backend_db
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password
JWT_SECRET=a_secure_random_string_for_tokens
JWT_EXPIRES_IN=24h
```

---

## 🏃 Running the Application

Once installation and environment files are configured:

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Start the application:
   ```bash
   npm start
   ```
   *Note: Starting the server will automatically launch the Node.js Express server on port `3000` AND launch the Python FastAPI microservice on port `8000`. The server startup script automatically checks for a `.venv` directory and uses it.*

---

## 📊 Seeding Initial Data

To set up the initial schema, insert lookups, create test actors, and seed dummy farms/villages, run the following scripts in order (from the `/backend` folder):

1. **Initialize DB Schema and tables**:
   ```bash
   node setup_db.js
   ```
2. **Seed Haryana villages data**:
   ```bash
   node seed_all_villages.js
   ```
3. **Seed test system accounts** (Village Head, Auditor, Admin):
   ```bash
   node create_test_users.js
   ```
4. **Seed dummy farms and sustainability data**:
   ```bash
   node seed_dummy_farms_and_scores.js
   ```
5. **Assign test village heads to their respective villages**:
   ```bash
   node assign_villages.js
   ```

---

## 💻 Frontend Dashboard Access

The frontend consists of static assets that interface directly with the backend API.
- Simply open the [index.html](file:///d:/Projects/SIH%2026/SIH_GroundWater_Backend/frontend/index.html) file inside your web browser.
- Alternatively, you can serve the `/frontend` directory using any static file server (e.g. VS Code Live Server, Python's `http.server`, or `npx serve`).

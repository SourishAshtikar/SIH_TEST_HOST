# 🗺️ JalSaarthi Project Sitemap & Architecture Guide

**JalSaarthi** (जलसारथी) is an Intelligent Groundwater Insights & Agricultural Irrigation Decision Support Platform for India.

---

## 🌐 1. Public Web Navigation Sitemap

| Route / Section | View Component | Description | Access Level |
| :--- | :--- | :--- | :--- |
| `/` (`#home`) | [`LandingHero.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/landing/LandingHero.jsx) | Platform identity, tagline, quick actions & interactive GIS groundwater map preview | Public |
| `#map` | [`LandingGISMap.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/landing/LandingGISMap.jsx) | Interactive Leaflet GIS groundwater assessment explorer (District & Village scope) | Public |
| `#advisory` | [`LandingApproach.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/landing/LandingApproach.jsx) | 5-Step horizontal stepper (*Understand → Analyze → Recommend → Verify → Impact*) | Public |
| `#schemes` | [`LandingApproach.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/landing/LandingApproach.jsx) | Agricultural sustainability banner card & advisory call-to-action | Public |
| `/login` | [`Login.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/layout/Login.jsx) | Secure authentication portal for system accounts (4 Roles Supported) | Public |

---

## 🔐 2. Authenticated Dashboard Workspaces (4 System Roles)

### 🌾 A. Village Head Workspace (`VILLAGE_HEAD`)
- **Farm Register Tab (`'farms'`)**: [`VillageHeadContent.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/farms/VillageHeadContent.jsx)
  - Registered farms list & metrics (*Total land, crop records, verified audits*)
  - Add new farm modal form ([`FarmForm`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/farms/FarmForms.jsx))
  - Seasonal crop record logging ([`RecordForm`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/farms/FarmForms.jsx))
  - Sustainability score inspector modal ([`SustainabilityScoreModal.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/common/SustainabilityScoreModal.jsx))
- **Irrigation Advisory Tab (`'recommendations'`)**: [`GeneralRecommendationWorkspace.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/advisory/GeneralRecommendationWorkspace.jsx)
  - Interactive crop & irrigation practice simulation
  - Agronomic water-saving & cost reduction diagnostics
- **Subsidies & Schemes Tab (`'schemes'`)**: [`VillageHeadSchemes.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/schemes/VillageHeadSchemes.jsx)
  - Searchable directory of central and state agricultural subsidies
- **Groundwater Maps Tab (`'maps'`)**: [`AssessmentExplorer.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/AssessmentExplorer.jsx)
  - Full-feature GIS layer explorer with controls & year selector

### 🛡️ B. Auditor Workspace (`AUDITOR`)
- **Audit Field Logs Tab (`'verification'`)**: [`AuditorContent.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/audits/AuditorContent.jsx)
  - Verification log submission (*ADOPTED*, *NOT_ADOPTED*, *IN_PROGRESS*)
  - Field photo & evidence logging
- **Groundwater Maps Tab (`'maps'`)**: [`AssessmentExplorer.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/AssessmentExplorer.jsx)

### 🏛️ C. Government Employee Workspace (`GOVERNMENT_EMPLOYEE`)
- **Govt Schemes Catalog Tab (`'schemes'`)**: [`VillageHeadSchemes.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/schemes/VillageHeadSchemes.jsx)
  - Unboxed search bar & central/state water conservation subsidies directory
- **Groundwater Maps Tab (`'maps'`)**: [`AssessmentExplorer.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/AssessmentExplorer.jsx)

### 👑 D. Government Admin Workspace (`ADMIN`)
- **Scheme Catalogue Tab (`'schemes'`)**: [`AdminContent.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/schemes/AdminContent.jsx)
  - Create & manage government schemes, eligibility rules, and benefit links
- **Sustainability Scores Tab (`'scores'`)**: [`SustainabilityRankingTable.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/admin/SustainabilityRankingTable.jsx)
  - Village & district sustainability score leaderboard & ranking export
- **ML Microservice Tab (`'ml'`)**: [`PredictionTest.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/components/prediction/PredictionTest.jsx)
  - Machine learning model endpoint test & validation interface
- **Groundwater Maps Tab (`'maps'`)**: [`AssessmentExplorer.jsx`](file:///Users/jainamdavda/SIH_NEW/SIH_GroundWater_Backend/groundwater-frontend/src/AssessmentExplorer.jsx)

---

## ⚡ 3. Backend REST API Endpoints Sitemap

### 🔒 Auth & Session Management (`/api/auth`)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User sign-in & JWT token issuance
- `GET /api/auth/me` - Authenticated user profile verification

### 🗺️ GIS & Groundwater Assessment (`/api/groundwater-assessments`)
- `GET /api/groundwater-assessments` - Fetch assessment layers (*District / Village scope*)
- `GET /api/groundwater-assessments/years` - Available assessment years list
- `GET /api/groundwater-assessments/details` - Detailed hydrological metrics for selected polygon
- `GET /api/groundwater-heatmap` - Heatmap coordinates & extraction intensities

### 🚜 Farms & Agriculture (`/api/farms`, `/api/agriculture`)
- `GET /api/farms` - List farms for assigned village
- `POST /api/farms` - Register a new farm
- `GET /api/farms/:farmId/crop-records` - Fetch seasonal crop records
- `POST /api/farms/:farmId/crop-records` - Log seasonal crop record
- `GET /api/agriculture/seasons` - Agricultural seasons reference list
- `GET /api/agriculture/crops` - Crop catalog
- `GET /api/agriculture/irrigation-methods` - Irrigation methods catalog

### 💡 Advisory Engine & ML (`/api/recommendations`, `/api/ml`)
- `POST /api/recommendations` - Generate crop & irrigation advisory report
- `GET /api/reference/recommendation-options` - Recommendation simulation parameters
- `POST /api/ml/predict` - Invoke Machine Learning microservice prediction

### 🛡️ Audits & Sustainability (`/api/audits`, `/api/sustainability-scores`)
- `GET /api/audits` - List field verification audits
- `POST /api/audits` - Submit new field verification log
- `GET /api/sustainability-scores/village-rankings` - Village sustainability ranking table
- `GET /api/sustainability-scores/district-rankings` - District sustainability ranking table

### 📜 Schemes (`/api/schemes`)
- `GET /api/schemes` - List government schemes
- `POST /api/schemes` - Create government scheme (*Admin only*)

---

## 🎨 4. Theme & Color Palette Specification

- **Primary Brand Color**: `#43552d` *(Deep Agricultural Green)*
- **Secondary Accent**: `#9e8e6a` *(Warm Khaki)*
- **Main Page Background**: `#f5f1ea` *(Linen)*
- **Cards & Container Surfaces**: `#ffffff` *(Crisp White)*
- **Dark Heading Text**: `#2a361c` *(Forest Dark)*
- **Muted Body Text**: `#6e654e` *(Muted Khaki)*

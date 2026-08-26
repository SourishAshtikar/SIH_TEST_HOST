# Smart Irrigation Advisory & Recommendation Engine: Formulas & Data Sources Documentation

This document provides the complete mathematical framework, decision algorithms, scoring equations, and official scientific dataset citations powering the **Smart Irrigation Advisory & Recommendation Engine**.

---

## 1. Recommendation Engine Architecture & Mathematical Formulas

The recommendation engine uses a transparent, multi-factor weighted agronomic scoring model based on **FAO-56** and **ICAR** irrigation guidelines.

### 1.1 Multi-Factor Agronomic Scoring Equation

For any candidate irrigation practice $T \in \{\text{Drip}, \text{Sprinkler}, \text{AWD}, \text{Furrow}, \text{Border}, \text{RaisedBed}, \text{Pitcher}, \text{Flood}\}$, the total suitability score $\text{Score}(T)$ is computed as:

$$\text{Score}(T) = w_1 S_1(T) + w_2 S_2(T) + w_3 S_3(T) + w_4 S_4(T) + w_5 S_5(T)$$

Where the weights $w_i$ sum to $1.0$:

| Weight | Factor | Description |
|---|---|---|
| $w_1 = 0.35$ | **Groundwater Stage of Extraction ($S_1$)** | Priority based on aquifer stress (Safe, Semi-Critical, Critical, Over-Exploited) |
| $w_2 = 0.20$ | **Soil Texture & Drainage ($S_2$)** | Infiltration and water-holding capacity (Coarse/Sandy, Medium/Loamy, Fine/Clay) |
| $w_3 = 0.20$ | **Crop Water Requirement Class ($S_3$)** | Seasonal crop evapotranspiration demand ($K_c \times ET_0$) |
| $w_4 = 0.15$ | **Rainfall Deficit & Weather ($S_4$)** | Observed & forecast precipitation shortfall |
| $w_5 = 0.10$ | **Current Practice Transition ($S_5$)** | Preference penalty/bonus against existing farm setup |

---

### 1.2 Factor Sub-Scoring Functions

#### Factor 1: Groundwater Stage of Extraction ($S_1$)
$$\text{Stage of Extraction (\%)} = \left(\frac{\text{Annual Groundwater Extraction (BCM)}}{\text{Annual Extractable Resource (BCM)}}\right) \times 100$$

- **Over-Exploited ($\ge 100\%$)**: Drip ($95$), Pitcher ($80$), Sprinkler ($70$), AWD ($60$), Flood ($5$)
- **Critical ($90\% - 99\%$)**: Drip ($85$), Sprinkler ($75$), Pitcher ($70$), AWD ($65$), Flood ($8$)
- **Semi-Critical ($70\% - 89\%$)**: Sprinkler ($70$), Drip ($65$), AWD ($60$), Pitcher ($55$), Flood ($20$)
- **Safe ($< 70\%$)**: Flood ($60$), Sprinkler ($55$), Furrow ($55$), Drip ($40$)

#### Factor 2: Soil Texture & Drainage ($S_2$)
- **Coarse / Sandy (High infiltration rate $> 30\text{ mm/hr}$)**: Sprinkler ($85$), Drip ($60$), Pitcher ($55$), Flood ($20$)
- **Medium / Loamy Alluvium (Balanced $10 - 20\text{ mm/hr}$)**: Drip ($90$), Pitcher ($85$), Sprinkler ($75$), AWD ($70$), Flood ($50$)
- **Fine / Clay Loam (Low infiltration rate $< 5\text{ mm/hr}$)**: Drip ($75$), Furrow ($65$), Border ($60$), Sprinkler ($55$)

#### Factor 3: Crop Water Requirement ($S_3$)
- **Very High ($> 1,000\text{ mm}$ / Paddy, Sugarcane)**: AWD ($95$), Drip ($70$), Flood ($60$)
- **High ($600 - 1,000\text{ mm}$ / Cotton, Wheat)**: Drip ($90$), Sprinkler ($65$), Furrow ($50$)
- **Medium ($400 - 600\text{ mm}$ / Potato, Tomato, Maize, Onion)**: Drip ($85$), Sprinkler ($70$), RaisedBed ($60$)
- **Low ($< 400\text{ mm}$ / Bajra, Mustard, Gram, Masoor, Moong)**: Sprinkler ($80$), Rainfed ($75$), Drip ($65$)

---

### 1.3 Calibrated AI Confidence Score Formula

The confidence score ($\%$) reflects decision certainty based on top-pick score alignment, factor agreement consensus, and margin separation:

$$\text{Confidence (\%)} = \min\left(96, \max\left(72, \left(S_{\text{top}} \times 0.90\right) + \left(\frac{N_{\text{agree}}}{5} \times 12\right) + \min\left(0.8 \times (S_{\text{top}} - S_{\text{second}}), 12\right)\right)\right)$$

Where:
- $S_{\text{top}}$ = Score of the top-ranked technique ($0 - 100$)
- $S_{\text{second}}$ = Score of the runner-up technique
- $N_{\text{agree}}$ = Number of factors where sub-score $S_i \ge 65$ (out of $5$)

---

### 1.4 Dynamic Water Volume Saved Formula

Water savings per hectare are calculated dynamically based on crop-specific seasonal water requirements ($ET_c$):

$$V_{\text{saved}} (\text{m}^3/\text{ha}) = ET_{\text{crop\_req}} \times \left(\frac{\text{WaterSavingsPct}}{100}\right)$$

#### Benchmark Crop Water Requirements ($ET_{\text{crop\_req}}$):
| Crop | Baseline Requirement ($m^3/ha$) | Drip Saved ($55\%$) | Sprinkler Saved ($35\%$) |
|---|---|---|---|
| **Paddy / Rice** | $12,500\text{ m}^3/\text{ha}$ | $6,875\text{ m}^3/\text{ha}$ | $4,375\text{ m}^3/\text{ha}$ |
| **Sugarcane** | $18,000\text{ m}^3/\text{ha}$ | $9,900\text{ m}^3/\text{ha}$ | $6,300\text{ m}^3/\text{ha}$ |
| **Cotton** | $7,000\text{ m}^3/\text{ha}$ | $3,850\text{ m}^3/\text{ha}$ | $2,450\text{ m}^3/\text{ha}$ |
| **Wheat** | $4,500\text{ m}^3/\text{ha}$ | $2,475\text{ m}^3/\text{ha}$ | $1,575\text{ m}^3/\text{ha}$ |
| **Potato / Tomato** | $5,500 - 6,000\text{ m}^3/\text{ha}$ | $3,025 - 3,300\text{ m}^3/\text{ha}$ | $1,925 - 2,100\text{ m}^3/\text{ha}$ |
| **Mustard / Bajra** | $3,000\text{ m}^3/\text{ha}$ | $1,650\text{ m}^3/\text{ha}$ | $1,050\text{ m}^3/\text{ha}$ |

---

## 2. Official Data Sources & Citations

All data feeds and parameters consumed by the model originate from verified government agencies and international agricultural research bodies:

### 2.1 Central Ground Water Board (CGWB) — Ministry of Jal Shakti, Govt. of India
- **Dataset**: *National Dynamic Groundwater Resources Assessment of India* (Historical 1991–2020 & 2023–2024).
- **Parameters Used**: Net Annual Groundwater Availability (BCM), Annual Groundwater Draft/Extraction (BCM), Stage of Groundwater Extraction (%), Categorization (Safe, Semi-Critical, Critical, Over-Exploited), Depth to Water Level (m bgl).
- **Official Portal**: [http://cgwb.gov.in/](http://cgwb.gov.in/) & INDIA-WRIS ([https://indiawris.gov.in/](https://indiawris.gov.in/)).

### 2.2 Open-Meteo & ECMWF ERA5 Reanalysis + GFS Weather Forecast
- **Dataset**: ECMWF ERA5 Atmospheric Reanalysis & Global Forecast System (GFS).
- **Parameters Used**: Daily Precipitation ($mm$), Temperature ($^\circ C$), Relative Humidity ($\%$), Wind Speed ($m/s$), Reference Evapotranspiration $ET_0$ (Penman-Monteith equation).
- **Official Portal**: [https://open-meteo.com/](https://open-meteo.com/) / [https://cds.climate.copernicus.eu/](https://cds.climate.copernicus.eu/).

### 2.3 FAO-56 (Food and Agriculture Organization of the United Nations)
- **Publication**: *FAO Irrigation and Drainage Paper No. 56: Crop Evapotranspiration — Guidelines for Computing Crop Water Requirements*.
- **Parameters Used**: Crop coefficient curves ($K_c$), stage-wise crop growth periods (Initial, Crop Dev, Mid-Season, Late Season), application efficiency benchmarks ($\text{Drip}=90\%$, $\text{Sprinkler}=75\%$, $\text{Flood}=40\%$).
- **Official Portal**: [https://www.fao.org/land-water/databases-and-software/cropwat/en/](https://www.fao.org/land-water/databases-and-software/cropwat/en/).

### 2.4 Indian Council of Agricultural Research (ICAR) & CCS HAU Hissar
- **Publication**: *ICAR-HAU Package of Practices for Kharif & Rabi Crops of Haryana*.
- **Parameters Used**: Haryana agro-climatic zone classifications, soil texture maps, micro-irrigation subsidies, and Alternate Wetting and Drying (AWD) water savings protocols for paddy fields.
- **Official Portal**: [https://icar.org.in/](https://icar.org.in/) & [https://hau.ac.in/](https://hau.ac.in/).

### 2.5 NASA SMAP & Copernicus Sentinel-1 Topsoil Moisture
- **Dataset**: NASA Soil Moisture Active Passive (SMAP) & Copernicus Sentinel-1 SAR (2018–2025).
- **Parameters Used**: Topsoil volumetric moisture ($cm^3/cm^3$) at 0-15cm depth aggregated annually by district across Haryana.
- **Official Portal**: [https://smap.jpl.nasa.gov/](https://smap.jpl.nasa.gov/).

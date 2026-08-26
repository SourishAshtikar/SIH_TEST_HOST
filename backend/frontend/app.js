const API_BASE = window.location.origin.includes('localhost') ? window.location.origin : 'http://localhost:3000';
const TOKEN_KEY = 'jwt_prototype_token';

let currentUser = null;
let selectedFarmId = null;
let selectedFarmVillageId = null;
let auditorGridData = [];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// CORE API & TOKEN UTILITIES
// ==========================================

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
  currentUser = null;
  selectedFarmId = null;
  selectedFarmVillageId = null;
  auditorGridData = [];
}

function updateApiBanner(method, endpoint, status, data) {
  document.getElementById('api-last-endpoint').textContent = `${method} ${endpoint}`;
  const statusEl = document.getElementById('api-status-badge');
  const msgEl = document.getElementById('api-last-msg');

  statusEl.textContent = `HTTP ${status}`;
  statusEl.className = 'badge-status ' + (status >= 200 && status < 300 ? 'success' : 'error');

  if (typeof data === 'string') {
    msgEl.textContent = data;
  } else if (data && data.message) {
    msgEl.textContent = data.message;
  } else {
    msgEl.textContent = JSON.stringify(data);
  }
}

async function apiRequest(method, endpoint, body = null) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {};
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    let resData;
    const text = await res.text();
    try {
      resData = JSON.parse(text);
    } catch {
      resData = text;
    }

    updateApiBanner(method, endpoint, res.status, resData);
    return { status: res.status, data: resData };
  } catch (err) {
    updateApiBanner(method, endpoint, 'NET_ERR', { message: err.message });
    return { status: 0, error: err.message };
  }
}

// ==========================================
// AUTHENTICATION & SESSION ROUTING
// ==========================================

async function handleManualLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    alert('Please enter both email and password.');
    return;
  }

  const res = await apiRequest('POST', '/api/auth/login', { email, password });
  if (res.status === 200 && res.data?.data?.token) {
    setToken(res.data.data.token);
    await checkSessionAndRoute();
  } else {
    alert(res.data?.message || 'Login failed.');
  }
}

async function quickLogin(email) {
  let res = await apiRequest('POST', '/api/auth/login', { email, password: 'password123' });
  if (res.status !== 200) {
    res = await apiRequest('POST', '/api/auth/login', { email, password: 'Password123!' });
  }
  if (res.status === 200 && res.data?.data?.token) {
    setToken(res.data.data.token);
    await checkSessionAndRoute();
  } else {
    alert(res.data?.message || 'Quick login failed.');
  }
}

async function checkSessionAndRoute() {
  const token = getToken();
  if (!token) {
    showView('view-login');
    document.getElementById('user-nav-status').style.display = 'none';
    return;
  }

  const res = await apiRequest('GET', '/api/auth/me');
  if (res.status === 200 && res.data?.data?.user) {
    currentUser = res.data.data.user;

    document.getElementById('nav-user-name').textContent = currentUser.name || currentUser.email;
    document.getElementById('nav-user-role').textContent = currentUser.role;
    
    let geoText = '';
    if (currentUser.role === 'VILLAGE_HEAD') {
      geoText = currentUser.village_name ? `Assigned Village: ${currentUser.village_name}` : 'No Assigned Village';
    } else if (currentUser.role === 'AUDITOR') {
      geoText = currentUser.district_name ? `Assigned District: ${currentUser.district_name}` : 'No Assigned District';
    } else {
      geoText = 'Platform Scope: Global';
    }
    document.getElementById('nav-geo-info').textContent = geoText;
    document.getElementById('user-nav-status').style.display = 'flex';

    // Role-based routing
    if (currentUser.role === 'VILLAGE_HEAD') {
      showView('view-village-head');
      loadVillageFarms();
      loadSchemesForView();
    } else if (currentUser.role === 'AUDITOR') {
      showView('view-auditor');
      loadAuditorGrid();
    } else if (currentUser.role === 'ADMIN') {
      showView('view-admin');
      loadAdminSchemes();
      loadSustainabilityScoresTable();
    } else {
      alert(`Role ${currentUser.role} does not have a dedicated interface.`);
      showView('view-login');
    }
  } else {
    handleLogout();
  }
}

function showView(viewId) {
  ['view-login', 'view-village-head', 'view-auditor', 'view-admin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === viewId) ? 'block' : 'none';
  });

  const heatmapSection = document.getElementById('view-groundwater-heatmap');
  if (heatmapSection) {
    if (viewId === 'view-login') {
      heatmapSection.style.display = 'none';
    } else {
      heatmapSection.style.display = 'block';
      setTimeout(async () => {
        await populateAssessmentYears();
        loadGroundwaterHeatmap();
      }, 150);
    }
  }
}

let yearsLoaded = false;
async function populateAssessmentYears() {
  if (yearsLoaded) return;
  const yearSelect = document.getElementById('gis-assessment-year');
  if (!yearSelect) return;

  const res = await apiRequest('GET', '/api/groundwater-assessments/years');
  if (res.status === 200 && res.data?.data?.years) {
    const rawYears = res.data.data.years;
    // Sort descending: most recent first
    const sortedYears = rawYears.slice().sort().reverse();
    const currentVal = yearSelect.value || '2025-2026';

    yearSelect.innerHTML = sortedYears.map(y => {
      const startYear = parseInt(y.split('-')[0], 10);
      const isPred = !isNaN(startYear) && startYear >= 2025;
      const label = `${y} ${isPred ? '(Predicted)' : '(Historical)'}`;
      return `<option value="${y}" ${y === currentVal ? 'selected' : ''}>${label}</option>`;
    }).join('');

    // Ensure a valid selection
    if (!sortedYears.includes(currentVal) && sortedYears.length > 0) {
      yearSelect.value = sortedYears[0];
    }
    yearsLoaded = true;
  }
}

function handleLogout() {
  removeToken();
  yearsLoaded = false; // Reset loaded flag to refetch on next login
  showView('view-login');
  document.getElementById('user-nav-status').style.display = 'none';
  updateApiBanner('LOCAL', 'logout', 200, { message: 'Logged out successfully.' });
}

// ==========================================
// GROUNDWATER AVAILABILITY HEATMAP MODULE
// ==========================================

let leafletMap = null;
let geoJsonLayer = null;
let pointsLayerGroup = null;
let currentScope = 'district';
let currentYear = '2025-2026';
let cachedAssessments = [];
let cachedDetails = null;
let activeFocusScope = 'state';
let activeFocusId = null;
let districtLayers = {}; // Cache district layer references for programmatic focus
let villageMarkers = {};  // Cache village marker references
let cachedDistrictGeoJSON = null; // Cache the haryana_districts.geojson so we don't re-fetch unnecessarily

function initLeafletMap(defaultLat = 29.15, defaultLng = 76.3, defaultZoom = 8) {
  const mapContainer = document.getElementById('groundwater-leaflet-map');
  if (!mapContainer) return null;

  if (leafletMap) {
    try {
      leafletMap.invalidateSize();
    } catch { }
    return leafletMap;
  }

  // Clear existing DOM leaflet ID if container element was recreated/reused
  if (mapContainer._leaflet_id) {
    mapContainer._leaflet_id = null;
  }

  try {
    // Create Leaflet map centered on Haryana
    leafletMap = L.map('groundwater-leaflet-map', {
      center: [defaultLat, defaultLng],
      zoom: defaultZoom,
      zoomControl: true,
      attributionControl: true
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    const streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    // Default to Satellite view
    satelliteLayer.addTo(leafletMap);

    const baseMaps = {
      "🛰️ Satellite": satelliteLayer,
      "🗺️ Street Map": streetLayer
    };

    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(leafletMap);

    pointsLayerGroup = L.layerGroup().addTo(leafletMap);

    // Add Custom Legend Control on Bottom Right
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'map-legend-box');
      div.innerHTML = `
        <div class="map-legend-title">Category</div>
        <div class="map-legend-item"><div class="map-legend-color" style="background:#dbeafe;"></div>Safe</div>
        <div class="map-legend-item"><div class="map-legend-color" style="background:#2563eb;"></div>Semi Critical</div>
        <div class="map-legend-item"><div class="map-legend-color" style="background:#facc15;"></div>Critical</div>
        <div class="map-legend-item"><div class="map-legend-color" style="background:#dc2626;"></div>Over Exploited</div>
        <div class="map-legend-item"><div class="map-legend-color" style="background:#64748b;"></div>No Data</div>
      `;
      return div;
    };
    legend.addTo(leafletMap);
  } catch (err) {
    console.warn('Leaflet container initialization warning:', err);
  }

  return leafletMap;
}

function normalizeCategory(cat) {
  if (cat === 'Hilly Area') return 'Safe';
  return cat || 'No Data';
}

function getCategoryColor(cat) {
  const normCat = normalizeCategory(cat);
  switch (normCat) {
    case 'Safe': return '#dbeafe';
    case 'Semi Critical': return '#2563eb';
    case 'Critical': return '#facc15';
    case 'Over Exploited': return '#dc2626';
    default: return '#64748b';
  }
}

function getDTWColor(dtw) {
  if (dtw === null || dtw === undefined || isNaN(dtw)) return '#64748b';
  if (dtw < 5.0) return '#38bdf8';
  if (dtw < 10.0) return '#4ade80';
  if (dtw < 20.0) return '#facc15';
  if (dtw < 40.0) return '#fb923c';
  return '#f87171';
}

function updateMapLegend(mode) {
  // Update the existing legend in the map bottom-right
  const legendBox = document.querySelector('.map-legend-box');
  if (!legendBox) return;

  if (mode === 'dtw') {
    legendBox.innerHTML = `
      <div class="map-legend-title">Depth to Water (m bgl)</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#38bdf8;"></div>&lt; 5 m (Shallow)</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#4ade80;"></div>5 – 10 m</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#facc15;"></div>10 – 20 m</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#fb923c;"></div>20 – 40 m</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#f87171;"></div>&gt; 40 m (Deep)</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#64748b;"></div>No Data</div>
    `;
  } else {
    legendBox.innerHTML = `
      <div class="map-legend-title">Category</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#dbeafe;"></div>Safe</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#2563eb;"></div>Semi Critical</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#facc15;"></div>Critical</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#dc2626;"></div>Over Exploited</div>
      <div class="map-legend-item"><div class="map-legend-color" style="background:#64748b;"></div>No Data</div>
    `;
  }
}

async function loadGroundwaterHeatmap() {
  const loadingOverlay = document.getElementById('heatmap-loading-overlay');
  const errorOverlay = document.getElementById('heatmap-error-overlay');
  const errorMsg = document.getElementById('heatmap-error-msg');
  const yearSelect = document.getElementById('gis-assessment-year');
  const scopeSelect = document.getElementById('gis-map-scope');
  const modeSelect = document.getElementById('gis-map-mode');

  if (yearSelect) currentYear = yearSelect.value;
  if (scopeSelect) currentScope = scopeSelect.value;
  const currentMode = modeSelect ? modeSelect.value : 'category';

  if (yearSelect && yearSelect.options.length <= 1) {
    await populateAssessmentYears();
    currentYear = yearSelect.value || currentYear;
  }

  // Update floating map year badge
  const mapYearBadge = document.getElementById('map-year-badge');
  if (mapYearBadge) mapYearBadge.textContent = `Assessment year: ${currentYear}`;

  if (loadingOverlay) loadingOverlay.style.display = 'flex';
  if (errorOverlay) errorOverlay.style.display = 'none';

  try {
    initLeafletMap();
    updateMapLegend(currentMode);

    const url = `/api/groundwater-assessments?year=${currentYear}&scope=${currentScope}`;
    const res = await apiRequest('GET', url);

    if (loadingOverlay) loadingOverlay.style.display = 'none';

    if (res.status === 200 && res.data?.data) {
    cachedAssessments = res.data.data;
    districtLayers = {};
    villageMarkers = {};

    // 1. Calculate and update summary counters based on current mode
    updateSummaryCounters(cachedAssessments, currentMode);

    // 2. Clear old layers
    if (geoJsonLayer) {
      leafletMap.removeLayer(geoJsonLayer);
      geoJsonLayer = null;
    }
    if (pointsLayerGroup) {
      pointsLayerGroup.clearLayers();
    }

    // 3. Ensure District GeoJSON is loaded for boundary clipping
    try {
      const geoResponse = await fetch('/haryana_districts.geojson');
      if (!geoResponse.ok) throw new Error(`HTTP ${geoResponse.status}`);
      cachedDistrictGeoJSON = await geoResponse.json();
      console.log('[GIS] haryana_districts.geojson loaded, features:', cachedDistrictGeoJSON?.features?.length);
    } catch (err) {
      console.error('[GIS] Failed to fetch haryana_districts.geojson:', err);
      cachedDistrictGeoJSON = null;
    }

    // 4. Render new layers based on scope
    if (currentScope === 'district') {
      if (cachedDistrictGeoJSON) {
        geoJsonLayer = L.geoJSON(cachedDistrictGeoJSON, {
          style: function (feature) {
            const districtName = feature.properties.NAME_2;
            const match = cachedAssessments.find(a => a.district_name.toLowerCase() === districtName.toLowerCase());
            const fillColor = (currentMode === 'dtw') 
              ? getDTWColor(match ? match.dtw_m_bgl : null) 
              : getCategoryColor(match ? match.category : 'No Data');
            return {
              fillColor: fillColor,
              fillOpacity: 0.78,
              color: '#475569',
              weight: 1.5,
              dashArray: '1'
            };
          },
          onEachFeature: function (feature, layer) {
            const districtName = feature.properties.NAME_2;
            const match = cachedAssessments.find(a => a.district_name.toLowerCase() === districtName.toLowerCase());
            const cat = normalizeCategory(match ? match.category : 'No Data');
            const dtwVal = match && match.dtw_m_bgl != null ? `${match.dtw_m_bgl} m bgl` : 'N/A';

            if (match) {
              districtLayers[match.district_id] = layer;
            }

            layer.bindTooltip(`
              <div style="font-size:0.82rem; line-height:1.3;">
                <strong>${escapeHtml(districtName)}</strong> (District)<br>
                ${currentMode === 'dtw' 
                  ? `Water Depth: <span style="font-weight:bold; color:#0284c7;">${dtwVal}</span>` 
                  : `Category: <span style="font-weight:bold;">${cat}</span>`}
              </div>
            `, { sticky: true });

            layer.on({
              mouseover: function () {
                this.setStyle({
                  weight: 3,
                  color: '#0f172a',
                  fillOpacity: 0.88
                });
              },
              mouseout: function () {
                this.setStyle({
                  weight: 1.5,
                  color: '#475569',
                  fillOpacity: 0.78
                });
              },
              click: function (e) {
                leafletMap.fitBounds(this.getBounds());
                if (match) {
                  inspectFocusArea('district', match.district_id, currentYear);
                }
              }
            });
          }
        }).addTo(leafletMap);
      }
    } else if (currentScope === 'village') {
      try {
        const villageGeoResponse = await fetch('/haryana_villages.geojson');
        const villageGeoJSON = await villageGeoResponse.json();

        geoJsonLayer = L.geoJSON(villageGeoJSON, {
          style: function (feature) {
            const vName = (feature.properties.NAME || '').trim();
            const bName = (feature.properties.BLOCK || '').trim();
            const dName = (feature.properties.DISTRICT || '').trim();

            let match = cachedAssessments.find(a => 
              a.village_name.toLowerCase().trim() === vName.toLowerCase() ||
              a.village_name.toLowerCase().trim() === bName.toLowerCase()
            );
            if (!match) {
              match = cachedAssessments.find(a => a.district_name.toLowerCase().trim() === dName.toLowerCase());
            }
            const fillColor = (currentMode === 'dtw') 
              ? getDTWColor(match ? match.dtw_m_bgl : null) 
              : getCategoryColor(match ? match.category : 'Safe');
            return {
              fillColor: fillColor,
              fillOpacity: 0.82,
              color: '#1e293b',
              weight: 0.8,
              dashArray: '1'
            };
          },
          onEachFeature: function (feature, layer) {
            const vName = feature.properties.NAME || 'Village';
            const bName = feature.properties.BLOCK || '';
            const dName = feature.properties.DISTRICT || '';

            let match = cachedAssessments.find(a => 
              a.village_name.toLowerCase().trim() === vName.toLowerCase().trim() ||
              a.village_name.toLowerCase().trim() === bName.toLowerCase().trim()
            );
            if (!match) {
              match = cachedAssessments.find(a => a.district_name.toLowerCase().trim() === dName.toLowerCase().trim());
            }
            const cat = normalizeCategory(match ? match.category : 'Safe');
            const dtwVal = match && match.dtw_m_bgl != null ? `${match.dtw_m_bgl} m bgl` : 'N/A';

            if (match) {
              villageMarkers[match.village_id] = layer;
            }

            layer.bindTooltip(`
              <div style="font-size:0.82rem; line-height:1.3; color:#0f172a;">
                <strong style="font-size:0.88rem;">${escapeHtml(vName)}</strong> (Survey of India Village Boundary)<br>
                ${bName ? 'Block/Tehsil: ' + escapeHtml(bName) + '<br>' : ''}
                District: ${escapeHtml(dName)}<br>
                ${currentMode === 'dtw' 
                  ? `Water Depth: <span style="font-weight:bold; color:#0284c7;">${dtwVal}</span>` 
                  : `Groundwater Status: <span style="font-weight:bold; color:#0284c7;">${cat}</span>`}
              </div>
            `, { sticky: true });

            layer.on({
              mouseover: function () {
                this.setStyle({ weight: 2.5, color: '#0f172a', fillOpacity: 0.95 });
              },
              mouseout: function () {
                this.setStyle({ weight: 0.8, color: '#1e293b', fillOpacity: 0.82 });
              },
              click: function () {
                leafletMap.fitBounds(this.getBounds());
                if (match) {
                  inspectFocusArea('village', match.village_id, currentYear);
                }
              }
            });
          }
        }).addTo(leafletMap);
      } catch (err) {
        console.error('Failed to load official SOI village boundaries GeoJSON:', err);
      }
    }

    // 4. Trigger Details Inspection for the active focus
    // If the focus belongs to the other scope, fall back to state level details
    if (activeFocusScope === 'district' && currentScope === 'village') {
      inspectFocusArea('state', null, currentYear);
    } else if (activeFocusScope === 'village' && currentScope === 'district') {
      inspectFocusArea('state', null, currentYear);
    } else {
      inspectFocusArea(activeFocusScope, activeFocusId, currentYear);
    }

    } else {
      if (errorOverlay) {
        errorOverlay.style.display = 'flex';
        if (errorMsg) {
          if (res.status === 401) {
            errorMsg.textContent = 'Session expired or unauthenticated. Please log in to view GIS data.';
          } else {
            errorMsg.textContent = res.data?.message || 'Groundwater assessment service unreachable';
          }
        }
      }
    }
  } catch (err) {
    console.error('[GIS] loadGroundwaterHeatmap error:', err);
    if (errorOverlay) {
      errorOverlay.style.display = 'flex';
      if (errorMsg) errorMsg.textContent = `Error: ${err.message || 'Unknown error. Check browser console (F12).'}. Please log in or refresh.`;
    }
  } finally {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
  }
}

function refreshGroundwaterHeatmap() {
  loadGroundwaterHeatmap();
}

function updateSummaryCounters(assessments, mode = 'category') {
  const container = document.getElementById('gis-summary-items-container');
  if (!container) return;

  const total = assessments.length;

  if (mode === 'dtw') {
    let dtw0_5 = 0, dtw5_10 = 0, dtw10_20 = 0, dtw20_40 = 0, dtw40plus = 0;
    assessments.forEach(a => {
      const d = a.dtw_m_bgl;
      if (d != null && !isNaN(d)) {
        if (d < 5.0) dtw0_5++;
        else if (d < 10.0) dtw5_10++;
        else if (d < 20.0) dtw10_20++;
        else if (d < 40.0) dtw20_40++;
        else dtw40plus++;
      }
    });

    container.innerHTML = `
      <div class="gis-summary-item">Total: <span id="summary-count-total" class="gis-summary-val" style="background:#475569; color:#fff;">${total}</span></div>
      <div class="gis-summary-item">&lt; 5m (Shallow): <span class="gis-summary-val" style="background:#0284c7; color:#fff;">${dtw0_5}</span></div>
      <div class="gis-summary-item">5-10m (Moderate): <span class="gis-summary-val" style="background:#16a34a; color:#fff;">${dtw5_10}</span></div>
      <div class="gis-summary-item">10-20m (Deep): <span class="gis-summary-val" style="background:#eab308; color:#0f172a;">${dtw10_20}</span></div>
      <div class="gis-summary-item">20-40m (Very Deep): <span class="gis-summary-val" style="background:#ea580c; color:#fff;">${dtw20_40}</span></div>
      <div class="gis-summary-item">&gt; 40m (Depleted): <span class="gis-summary-val" style="background:#dc2626; color:#fff;">${dtw40plus}</span></div>
    `;
  } else {
    let safe = 0, semi = 0, critical = 0, over = 0;
    assessments.forEach(a => {
      const normCat = normalizeCategory(a.category);
      if (normCat === 'Safe') safe++;
      else if (normCat === 'Semi Critical') semi++;
      else if (normCat === 'Critical') critical++;
      else if (normCat === 'Over Exploited') over++;
    });

    container.innerHTML = `
      <div class="gis-summary-item">Total: <span id="summary-count-total" class="gis-summary-val" style="background:#475569; color:#fff;">${total}</span></div>
      <div class="gis-summary-item">Safe: <span id="summary-count-safe" class="gis-summary-val" style="background:#15803d; color:#fff;">${safe}</span></div>
      <div class="gis-summary-item">Semi-Critical: <span id="summary-count-semi" class="gis-summary-val" style="background:#2563eb; color:#fff;">${semi}</span></div>
      <div class="gis-summary-item">Critical: <span id="summary-count-critical" class="gis-summary-val" style="background:#eab308; color:#0f172a;">${critical}</span></div>
      <div class="gis-summary-item">Over-Exploited: <span id="summary-count-over" class="gis-summary-val" style="background:#dc2626; color:#fff;">${over}</span></div>
    `;
  }
}

function toggleAccordion(id) {
  const content = document.getElementById(id);
  if (!content) return;

  const currentDisplay = content.style.display;
  // Collapse all contents first
  const allContents = document.querySelectorAll('.gis-accordion-content');
  allContents.forEach(c => c.style.display = 'none');

  // Toggle clicked one
  content.style.display = (currentDisplay === 'none') ? 'block' : 'none';
}

async function inspectFocusArea(scope, id, year) {
  activeFocusScope = scope;
  activeFocusId = id;

  const url = `/api/groundwater-assessments/details?scope=${scope}&year=${year}&id=${id || ''}`;
  const res = await apiRequest('GET', url);

  if (res.status === 200 && res.data?.data) {
    cachedDetails = res.data.data;
    renderDetailsPanel(cachedDetails);
  }
}

function renderDetailsPanel(details) {
  const breadcrumbsEl = document.getElementById('inspector-breadcrumbs');
  const focusNameEl = document.getElementById('inspector-focus-name');
  const focusYearEl = document.getElementById('inspector-focus-year');
  
  if (breadcrumbsEl) breadcrumbsEl.textContent = details.breadcrumbs.join(' / ');
  if (focusNameEl) focusNameEl.textContent = `${details.focusName} (${details.focusType})`;
  if (focusYearEl) focusYearEl.textContent = `YEAR: ${details.year}`;

  // AI Predicted badge for ML-generated years (2025-2026, 2026-2027)
  let aiBadge = document.getElementById('inspector-ai-badge');
  if (!aiBadge) {
    aiBadge = document.createElement('span');
    aiBadge.id = 'inspector-ai-badge';
    aiBadge.style.cssText = 'display:inline-block;background:linear-gradient(135deg,#6d28d9,#a21caf);color:#fff;padding:2px 10px;border-radius:12px;font-size:0.72rem;font-weight:700;margin-left:8px;vertical-align:middle;letter-spacing:0.04em;';
    aiBadge.textContent = '🤖 AI PREDICTED';
    if (focusYearEl) focusYearEl.parentNode.insertBefore(aiBadge, focusYearEl.nextSibling);
  }
  aiBadge.style.display = details.is_predicted ? 'inline-block' : 'none';

  const isVillage = details.focusType === 'VILLAGE';
  const unit = isVillage ? 'ham' : 'BCM';
  const multiplier = isVillage ? 100000 : 1; // Convert BCM to ham for villages

  // Update accordion unit labels
  const unitLabels = document.querySelectorAll('.unit-label');
  unitLabels.forEach(lbl => lbl.textContent = unit);

  // Update card titles
  const extTitle = document.getElementById('metric-extractable-title');
  const usageTitle = document.getElementById('metric-extraction-title');
  if (extTitle) extTitle.textContent = `Annual Extractable Ground Water Resources (${unit})`;
  if (usageTitle) usageTitle.textContent = `Ground Water Extraction for all uses (${unit})`;

  // Calculate scaled metrics
  const extractableScaled = details.extractable_resources_bcm * multiplier;
  const extractionScaled = details.extraction_all_uses_bcm * multiplier;
  const rechargeScaled = details.recharge_bcm * multiplier;
  const dischargesScaled = details.natural_discharges_bcm * multiplier;

  // Render values to cards
  const extCardVal = document.getElementById('card-extractable-val');
  const usageCardVal = document.getElementById('card-extraction-val');
  if (extCardVal) extCardVal.textContent = formatMetricValue(extractableScaled);
  if (usageCardVal) usageCardVal.textContent = formatMetricValue(extractionScaled);

  // Render values to accordions
  const formatAcc = (summaryId, contentId, val, suffix = '') => {
    const sEl = document.getElementById(summaryId);
    const cEl = document.getElementById(contentId);
    const formatted = formatMetricValue(val) + suffix;
    if (sEl) sEl.textContent = formatted;
    if (cEl) cEl.textContent = formatted;
  };

  formatAcc('val-rainfall-summary', 'val-rainfall', details.rainfall_mm);
  formatAcc('val-recharge-summary', 'val-recharge', rechargeScaled);
  formatAcc('val-discharges-summary', 'val-discharges', dischargesScaled);
  formatAcc('val-extractable-summary', 'val-extractable', extractableScaled);
  formatAcc('val-extraction-summary', 'val-extraction', extractionScaled);
  formatAcc('val-stage-summary', 'val-stage', details.stage_of_extraction_pct, '%');

  const dtwVal = details.dtw_m_bgl !== null ? details.dtw_m_bgl.toFixed(2) : '-';
  const dtwSummaryEl = document.getElementById('val-dtw-summary');
  const dtwContentEl = document.getElementById('val-dtw');
  if (dtwSummaryEl) dtwSummaryEl.textContent = dtwVal;
  if (dtwContentEl) dtwContentEl.textContent = dtwVal;

  // Render Sub-region table
  renderSubregionTable(details.subRegions, unit, multiplier);
}

function formatMetricValue(val) {
  if (val === null || val === undefined || isNaN(val)) return '0.00';
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolumeWithUnits(bcmVal) {
  if (bcmVal === null || bcmVal === undefined || isNaN(bcmVal)) return '—';
  if (bcmVal < 1.0) {
    const ham = bcmVal * 100000;
    return `${ham.toLocaleString(undefined, { maximumFractionDigits: 0 })} ham (${bcmVal.toFixed(4)} BCM)`;
  } else {
    return `${bcmVal.toFixed(3)} BCM (${(bcmVal * 100000).toLocaleString(undefined, { maximumFractionDigits: 0 })} ham)`;
  }
}

// Voronoi Region Polygons Builder for Village Scope
function clipPolygonWithHalfPlane(poly, mid, nx, ny) {
  const isInside = (pt) => (pt[0] - mid[0]) * nx + (pt[1] - mid[1]) * ny >= 0;
  const output = [];

  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];

    const currInside = isInside(curr);
    const prevInside = isInside(prev);

    if (currInside) {
      if (!prevInside) {
        output.push(intersectLineAndHalfPlane(prev, curr, mid, nx, ny));
      }
      output.push(curr);
    } else if (prevInside) {
      output.push(intersectLineAndHalfPlane(prev, curr, mid, nx, ny));
    }
  }
  return output;
}

function intersectLineAndHalfPlane(p1, p2, mid, nx, ny) {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const num = (mid[0] - p1[0]) * nx + (mid[1] - p1[1]) * ny;
  const den = dx * nx + dy * ny;
  const t = den !== 0 ? num / den : 0;
  return [p1[0] + t * dx, p1[1] + t * dy];
}

function computeVillageVoronoiPolygons(villages) {
  const validVillages = villages.filter(v => v.latitude && v.longitude);
  const districtMap = {};

  // Group villages by district name
  validVillages.forEach(v => {
    const dName = (v.district_name || '').toLowerCase().trim();
    if (!districtMap[dName]) districtMap[dName] = [];
    districtMap[dName].push(v);
  });

  const results = [];
  const districtFeatures = cachedDistrictGeoJSON?.features || [];

  for (const [dName, dVillages] of Object.entries(districtMap)) {
    // Attempt to locate district boundary feature in GeoJSON
    const feat = districtFeatures.find(f => (f.properties.NAME_2 || '').toLowerCase().trim() === dName);
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    if (feat && feat.geometry) {
      const coordsArr = feat.geometry.type === 'MultiPolygon'
        ? feat.geometry.coordinates.flat(2)
        : feat.geometry.coordinates[0];

      coordsArr.forEach(c => {
        const lng = c[0], lat = c[1];
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });
    }

    // Fallback bounding box around district's villages if no GeoJSON match
    if (minLat === 90) {
      dVillages.forEach(v => {
        if (v.latitude < minLat) minLat = v.latitude;
        if (v.latitude > maxLat) maxLat = v.latitude;
        if (v.longitude < minLng) minLng = v.longitude;
        if (v.longitude > maxLng) maxLng = v.longitude;
      });
      minLat -= 0.08; maxLat += 0.08; minLng -= 0.08; maxLng += 0.08;
    }

    const initialBox = [
      [minLat - 0.02, minLng - 0.02],
      [minLat - 0.02, maxLng + 0.02],
      [maxLat + 0.02, maxLng + 0.02],
      [maxLat + 0.02, minLng - 0.02]
    ];

    dVillages.forEach(v => {
      let poly = [...initialBox];
      const p1 = [v.latitude, v.longitude];

      // Clip against other villages in the SAME district
      for (const v2 of dVillages) {
        if (v2.village_id === v.village_id) continue;
        const p2 = [v2.latitude, v2.longitude];
        const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
        const nx = p1[0] - p2[0];
        const ny = p1[1] - p2[1];
        poly = clipPolygonWithHalfPlane(poly, mid, nx, ny);
        if (poly.length < 3) break;
      }

      // Clip strictly within district bounding box
      if (poly.length >= 3) {
        poly = clipPolygonWithHalfPlane(poly, [minLat, minLng], 1, 0);  // South
        poly = clipPolygonWithHalfPlane(poly, [maxLat, maxLng], -1, 0); // North
        poly = clipPolygonWithHalfPlane(poly, [minLat, minLng], 0, 1);  // West
        poly = clipPolygonWithHalfPlane(poly, [maxLat, maxLng], 0, -1); // East
      }

      if (poly.length >= 3) {
        results.push({ village: v, polygon: poly });
      }
    });
  }

  return results;
}

function renderSubregionTable(subRegions, unit, multiplier) {
  const tbody = document.getElementById('subregions-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!subRegions || subRegions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No sub-regions available</td></tr>`;
    updateTableFooter(0, 0, 0);
    return;
  }

  let totalRainfall = 0;
  let totalResources = 0;
  let totalExtraction = 0;

  subRegions.forEach(sr => {
    const resValue = sr.extractable_resources_bcm * multiplier;
    const extValue = sr.extraction_all_uses_bcm * multiplier;

    totalRainfall += sr.rainfall_mm || 0;
    totalResources += resValue || 0;
    totalExtraction += extValue || 0;

    const tr = document.createElement('tr');
    tr.className = 'clickable';
    
    // Add dynamic category label styling
    const normCat = normalizeCategory(sr.category);
    const catColor = getCategoryColor(normCat);
    
    tr.innerHTML = `
      <td><strong>${escapeHtml(sr.name)}</strong></td>
      <td>${sr.rainfall_mm ? sr.rainfall_mm.toFixed(1) : '0.0'}</td>
      <td>${formatMetricValue(resValue)}</td>
      <td>${formatMetricValue(extValue)}</td>
      <td><span class="status-badge" style="background:${catColor}; color:${normCat === 'Critical' ? '#0f172a' : '#fff'}; font-size: 0.68rem; padding: 1px 6px;">${normCat}</span></td>
    `;

    // Row click handler to drill down
    tr.addEventListener('click', () => {
      if (activeFocusScope === 'state') {
        focusOnDistrict(sr.id);
      } else if (activeFocusScope === 'district') {
        focusOnVillage(sr.id);
      }
    });

    tbody.appendChild(tr);
  });

  // Calculate averages/sums for footer
  const avgRainfall = totalRainfall / subRegions.length;
  updateTableFooter(avgRainfall, totalResources, totalExtraction);
}

function updateTableFooter(rainfall, resources, extraction) {
  const rainEl = document.getElementById('foot-rainfall');
  const resEl = document.getElementById('foot-resources');
  const extEl = document.getElementById('foot-extraction');

  if (rainEl) rainEl.textContent = rainfall.toFixed(2);
  if (resEl) resEl.textContent = formatMetricValue(resources);
  if (extEl) extEl.textContent = formatMetricValue(extraction);
}

function onSubregionSearch(query) {
  if (!cachedDetails || !cachedDetails.subRegions) return;

  const filtered = cachedDetails.subRegions.filter(sr => 
    sr.name.toLowerCase().includes(query.toLowerCase())
  );

  const isVillage = cachedDetails.focusType === 'VILLAGE';
  const unit = isVillage ? 'ham' : 'BCM';
  const multiplier = isVillage ? 100000 : 1;

  renderSubregionTable(filtered, unit, multiplier);
}

function focusOnDistrict(districtId) {
  const layer = districtLayers[districtId];
  if (layer) {
    leafletMap.fitBounds(layer.getBounds());
    inspectFocusArea('district', districtId, currentYear);
  }
}

function focusOnVillage(villageId) {
  const marker = villageMarkers[villageId];
  if (marker) {
    leafletMap.setView(marker.getLatLng(), 12);
    inspectFocusArea('village', villageId, currentYear);
  }
}

// ==========================================
// VILLAGE HEAD WORKFLOW
// ==========================================

async function loadVillageFarms() {
  const res = await apiRequest('GET', '/api/farms');
  const tbody = document.getElementById('farms-tbody');
  tbody.innerHTML = '';

  if (res.status === 200 && Array.isArray(res.data?.data?.farms)) {
    const farms = res.data.data.farms;
    if (farms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No farms registered in this village yet.</td></tr>';
      document.getElementById('vh-village-name').textContent = currentUser.village_name 
        ? `${currentUser.village_name} (ID: ${currentUser.village_id}) (0 Farms)` 
        : 'Assigned Village (0 Farms)';
      return;
    }

    if (farms[0].village_name) {
      document.getElementById('vh-village-name').textContent = `${farms[0].village_name} (ID: ${farms[0].village_id}) (${farms.length} Farms)`;
      selectedFarmVillageId = farms[0].village_id;
    }

    farms.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${f.farm_id}</strong></td>
        <td>${escapeHtml(f.name)}</td>
        <td>${escapeHtml(f.owner_name || '-')}</td>
        <td>${f.total_land_area_hectares} ha</td>
        <td>
          <button onclick="selectFarm(${f.farm_id}, '${escapeHtml(f.name)}', ${f.village_id || 1})" class="btn-small btn-primary">
            View Records
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Error loading farms: ${res.data?.message || 'Unauthorized'}</td></tr>`;
  }
}

async function handleCreateFarm() {
  if (!currentUser?.village_id) {
    alert('Your account is not assigned to a village in the database. Cannot create farm.');
    return;
  }

  const name = document.getElementById('new-farm-name').value.trim();
  const owner_name = document.getElementById('new-farm-owner').value.trim();
  const total_land_area_hectares = parseFloat(document.getElementById('new-farm-area').value);

  if (!name || isNaN(total_land_area_hectares) || total_land_area_hectares <= 0) {
    alert('Please enter a valid Farm Name and positive Land Area.');
    return;
  }

  const res = await apiRequest('POST', '/api/farms', {
    name,
    owner_name: owner_name || null,
    village_id: currentUser.village_id,
    total_land_area_hectares
  });

  if (res.status === 201) {
    document.getElementById('new-farm-name').value = '';
    document.getElementById('new-farm-owner').value = '';
    document.getElementById('new-farm-area').value = '';
    await loadVillageFarms();
  } else {
    alert(`Failed to create farm: ${res.data?.message || 'Unknown error'}`);
  }
}

async function selectFarm(farmId, farmName, villageId = 1) {
  selectedFarmId = farmId;
  selectedFarmVillageId = villageId;
  document.getElementById('selected-farm-title').textContent = `${farmName} (#${farmId})`;
  document.getElementById('no-farm-selected-msg').style.display = 'none';
  document.getElementById('records-content').style.display = 'block';

  // Load crop records, audits, and all sustainability scores concurrently
  const [recRes, auditRes, scoreRes] = await Promise.all([
    apiRequest('GET', `/api/farms/${farmId}/crop-records`),
    apiRequest('GET', '/api/audits'),
    apiRequest('GET', '/api/sustainability-scores')
  ]);

  const tbody = document.getElementById('crop-records-tbody');
  tbody.innerHTML = '';

  if (recRes.status === 200 && Array.isArray(recRes.data?.data?.records)) {
    const records = recRes.data.data.records;
    const audits = (auditRes.status === 200 && Array.isArray(auditRes.data?.data?.audits)) ? auditRes.data.data.audits : [];
    const allScores = (scoreRes.status === 200 && Array.isArray(scoreRes.data?.data?.scores)) ? scoreRes.data.data.scores : [];

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No seasonal crop records for this farm yet.</td></tr>';
      return;
    }

    records.forEach(r => {
      // Find audit matching this crop record
      const matchingAudit = audits.find(a => a.record_id === r.record_id);
      let statusBadge = '<span class="status-badge un-audited">Not Yet Audited</span>';

      if (matchingAudit) {
        if (matchingAudit.adoption_status === 'ADOPTED') {
          statusBadge = '<span class="status-badge adopted">✓ ADOPTED</span>';
        } else if (matchingAudit.adoption_status === 'NOT_ADOPTED') {
          statusBadge = '<span class="status-badge not-adopted">✗ NOT ADOPTED</span>';
        } else {
          statusBadge = '<span class="status-badge pending">⏳ PENDING</span>';
        }
      }

      const cropName = r.crop_name || `Crop ${r.crop_id}`;
      const methodName = r.current_irrigation_method_name || `Method ${r.current_irrigation_method_id}`;

      // Match dynamic score for this farm, season, and year
      const matchingScore = allScores.find(s => s.farm_id === farmId && s.season_id === r.season_id && String(s.agricultural_year) === String(r.agricultural_year));

      let scoreBtn = `
        <button onclick="handleCalculateScore(${farmId}, ${r.season_id}, '${escapeHtml(r.agricultural_year)}')" class="btn-small" style="background:#15803d;color:#fff;margin-left:4px;">
          📊 Calculate Score
        </button>
      `;

      if (matchingScore) {
        const pClass = matchingScore.priority === 'HIGH' ? 'adopted' : matchingScore.priority === 'MEDIUM' ? 'pending' : 'not-adopted';
        scoreBtn = `
          <button onclick="openScoreModalFromObject(${escapeHtml(JSON.stringify(JSON.stringify(matchingScore)))})" class="btn-small status-badge ${pClass}" style="margin-left:4px;cursor:pointer;border:none;">
            Score: ${matchingScore.sustainability_score} (${matchingScore.priority})
          </button>
        `;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(r.agricultural_year)}</td>
        <td>${escapeHtml(r.season_name || `Season ${r.season_id}`)}</td>
        <td><strong>${escapeHtml(cropName)}</strong></td>
        <td>${r.cultivated_area_hectares} ha</td>
        <td>${escapeHtml(methodName)}</td>
        <td>${statusBadge}</td>
        <td>
          <button onclick="openRecommendationForRecord('${escapeHtml(cropName)}', '${escapeHtml(methodName)}')" class="btn-advisory">
            💡 AI Advisory
          </button>
          ${scoreBtn}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Error loading records: ${recRes.data?.message || 'Unknown error'}</td></tr>`;
  }
}

async function handleCreateCropRecord() {
  if (!selectedFarmId) {
    alert('Please select a farm first.');
    return;
  }

  const season_id = parseInt(document.getElementById('new-rec-season').value, 10);
  const agricultural_year = document.getElementById('new-rec-year').value.trim();
  const crop_id = parseInt(document.getElementById('new-rec-crop').value, 10);
  const cultivated_area_hectares = parseFloat(document.getElementById('new-rec-area').value);
  const current_irrigation_method_id = parseInt(document.getElementById('new-rec-method').value, 10);

  if (!agricultural_year || isNaN(cultivated_area_hectares) || cultivated_area_hectares <= 0) {
    alert('Please provide a valid Agricultural Year and positive Cultivated Area.');
    return;
  }

  const res = await apiRequest('POST', `/api/farms/${selectedFarmId}/crop-records`, {
    season_id,
    agricultural_year,
    crop_id,
    cultivated_area_hectares,
    current_irrigation_method_id
  });

  if (res.status === 201) {
    const farmTitle = document.getElementById('selected-farm-title').textContent;
    await selectFarm(selectedFarmId, farmTitle, selectedFarmVillageId);
  } else {
    alert(`Failed to add crop record: ${res.data?.message || 'Conflict or error'}`);
  }
}

// ==========================================
// RECOMMENDATION ENGINE INTEGRATION
// ==========================================

async function openRecommendationForRecord(cropName, currentMethodName) {
  const villageId = currentUser?.village_id || selectedFarmVillageId || '070001';
  await requestAndRenderRecommendation(villageId, cropName, currentMethodName);
}

async function runDirectRecommendation() {
  const cropName = document.getElementById('rec-sim-crop').value;
  const currentPractice = document.getElementById('rec-sim-practice').value;
  const villageId = currentUser?.village_id || '070001';
  await requestAndRenderRecommendation(villageId, cropName, currentPractice);
}

let allGeographicLocations = [];

async function initMLGeoAutoComplete() {
  try {
    const response = await fetch('/api/geography/villages');
    if (!response.ok) return;
    const json = await response.json();
    if (json.status === 'SUCCESS' && Array.isArray(json.data)) {
      allGeographicLocations = json.data;
      
      const districtsSet = new Set();
      const tehsilsSet = new Set();
      const stationsSet = new Set();

      allGeographicLocations.forEach(loc => {
        if (loc.district_name) districtsSet.add(loc.district_name);
        if (loc.tehsil) tehsilsSet.add(loc.tehsil);
        if (loc.name) stationsSet.add(loc.name);
        if (loc.station_name) stationsSet.add(loc.station_name);
      });

      populateDatalist('ml-districts-list', Array.from(districtsSet).sort());
      populateDatalist('ml-tehsils-list', Array.from(tehsilsSet).sort());
      populateDatalist('ml-stations-list', Array.from(stationsSet).sort());
    }
  } catch (err) {
    console.warn('[initMLGeoAutoComplete] Fetch failed:', err);
  }
}

function populateDatalist(id, items) {
  const list = document.getElementById(id);
  if (!list) return;
  list.innerHTML = items.map(item => `<option value="${escapeHtml(item)}"></option>`).join('');
}

function handleMLGeoAutoComplete(triggerField) {
  if (!allGeographicLocations || allGeographicLocations.length === 0) return;

  const districtInput = document.getElementById('ml-test-district');
  const tehsilInput = document.getElementById('ml-test-tehsil');
  const blockInput = document.getElementById('ml-test-block');
  const stationInput = document.getElementById('ml-test-station');
  const latInput = document.getElementById('ml-test-lat');
  const lonInput = document.getElementById('ml-test-lon');

  const distVal = districtInput ? districtInput.value.trim().toLowerCase() : '';
  const tehsilVal = tehsilInput ? tehsilInput.value.trim().toLowerCase() : '';
  const stationVal = stationInput ? stationInput.value.trim().toLowerCase() : '';

  if (!distVal && !tehsilVal && !stationVal) return;

  let match = null;

  const isMatch = (loc, val, field) => {
    if (!val) return false;
    const target = (loc[field] || '').toLowerCase();
    return target === val || target.startsWith(val);
  };

  if (triggerField === 'station' && stationVal) {
    match = allGeographicLocations.find(l => isMatch(l, stationVal, 'name') || isMatch(l, stationVal, 'station_name'));
  } else if (triggerField === 'tehsil' && tehsilVal) {
    match = allGeographicLocations.find(l => isMatch(l, tehsilVal, 'tehsil'));
  } else if (triggerField === 'district' && distVal) {
    match = allGeographicLocations.find(l => isMatch(l, distVal, 'district_name'));
  }

  if (!match) {
    match = allGeographicLocations.find(l => {
      const d = (l.district_name || '').toLowerCase();
      const t = (l.tehsil || '').toLowerCase();
      const s = (l.station_name || l.name || '').toLowerCase();
      if (stationVal && s.includes(stationVal)) return true;
      if (tehsilVal && t.includes(tehsilVal)) return true;
      if (distVal && d.includes(distVal)) return true;
      return false;
    });
  }

  if (match) {
    if (match.district_name && districtInput && triggerField !== 'district') {
      districtInput.value = match.district_name;
    }
    if (match.tehsil && tehsilInput && triggerField !== 'tehsil') {
      tehsilInput.value = match.tehsil;
    }
    if (match.block && blockInput) {
      blockInput.value = match.block;
    }
    if ((match.station_name || match.name) && stationInput && triggerField !== 'station') {
      stationInput.value = match.station_name || match.name;
    }
    if (match.latitude !== undefined && match.latitude !== null && latInput) {
      latInput.value = match.latitude;
    }
    if (match.longitude !== undefined && match.longitude !== null && lonInput) {
      lonInput.value = match.longitude;
    }
  }
}

async function runMLPrediction() {
  const payload = {
    District: document.getElementById('ml-test-district').value,
    Tehsil: document.getElementById('ml-test-tehsil').value,
    Block: document.getElementById('ml-test-block').value,
    Station: document.getElementById('ml-test-station').value,
    Latitude: parseFloat(document.getElementById('ml-test-lat').value),
    Longitude: parseFloat(document.getElementById('ml-test-lon').value),
    Year: parseInt(document.getElementById('ml-test-year').value, 10),
    Month: parseInt(document.getElementById('ml-test-month').value, 10)
  };

  const res = await apiRequest('POST', '/api/ml/predict', payload);
  const resultDiv = document.getElementById('ml-test-result');
  const valSpan = document.getElementById('ml-test-val');

  resultDiv.style.display = 'block';
  if (res.status === 200 && res.data?.predicted_gwl_meters !== undefined) {
    valSpan.innerHTML = `<span style="color: #15803d; font-weight: bold;">${res.data.predicted_gwl_meters.toFixed(2)} meters</span>`;
  } else {
    valSpan.innerHTML = `<span style="color: #b91c1c;">Error: ${res.data?.message || res.error || 'Unknown error'}</span>`;
  }
}

async function requestAndRenderRecommendation(villageId, cropName, currentPracticeName) {
  const modal = document.getElementById('rec-modal');
  const loadingEl = document.getElementById('rec-modal-loading');
  const bodyEl = document.getElementById('rec-modal-body');

  modal.style.display = 'flex';
  loadingEl.style.display = 'block';
  bodyEl.style.display = 'none';

  const res = await apiRequest('POST', '/api/recommendations', {
    villageId: String(villageId),
    cropName,
    currentPracticeName
  });

  loadingEl.style.display = 'none';
  bodyEl.style.display = 'block';

  if (res.status === 200 && res.data?.data) {
    const r = res.data.data;

    // Badges & Action
    const actionBadge = document.getElementById('rec-action-badge');
    actionBadge.textContent = r.actionRequired ? r.actionRequired.replace(/_/g, ' ') : 'RECOMMENDATION';
    actionBadge.className = 'status-badge ' + (r.actionRequired === 'CHANGE_RECOMMENDED' ? 'adopted' : 'pending');

    const gwBadge = document.getElementById('rec-gw-badge');
    gwBadge.textContent = `GW STATUS: ${r.groundwaterStatus || 'ALERT'}`;
    gwBadge.className = 'status-badge ' + (r.groundwaterStatus === 'CRITICAL' || r.groundwaterStatus === 'HIGH' ? 'not-adopted' : 'adopted');

    // AI badge
    const aiBadge = document.getElementById('rec-ai-badge');
    const modelSource = document.getElementById('rec-model-source');
    const confidenceRow = document.getElementById('rec-confidence-row');
    const confidenceVal = document.getElementById('rec-confidence-val');

    if (r.aiPowered) {
      aiBadge.style.display = 'inline-block';
      modelSource.style.display = 'inline-block';
      modelSource.textContent = r.modelSource || '';
      confidenceRow.style.display = 'flex';
      confidenceVal.textContent = `${r.confidenceScore || 95}%`;
    } else {
      aiBadge.style.display = 'none';
      modelSource.style.display = 'none';
      confidenceRow.style.display = 'none';
    }

    // Title / Transition
    document.getElementById('rec-current-text').textContent = r.currentPractice || currentPracticeName || 'Flood';
    document.getElementById('rec-recommended-text').textContent = r.recommendedPractice?.name || 'Drip Irrigation';

    // Savings
    document.getElementById('rec-water-saved-pct').textContent = `${r.waterSavingsPercentage || 0}%`;
    document.getElementById('rec-water-saved-vol').textContent = `${r.estimatedWaterSavedM3PerHa || 0} m³/ha`;
    document.getElementById('rec-energy-saved-pct').textContent = `${r.energySavedPercentage || 0}%`;

    // Diagnostics — Groundwater
    const gwLevel = r.diagnostics?.groundwaterLevelMeters;
    document.getElementById('diag-gw-val').textContent = gwLevel != null ? `${gwLevel} m bgl` : '— (ML unavailable)';
    document.getElementById('diag-gw-trend').textContent = `Trend: ${r.diagnostics?.groundwaterTrend || 'DECLINING'}`;

    document.getElementById('diag-weather-val').textContent = `Rain: ${r.diagnostics?.rainfallRecentMm ?? '—'}mm (Fcst: ${r.diagnostics?.rainfallForecastMm ?? '—'}mm)`;
    document.getElementById('diag-weather-temp').textContent = `Temp: ${r.diagnostics?.temperature ?? '—'}°C | ET₀: ${r.diagnostics?.et0 ?? '—'} mm/d`;

    document.getElementById('diag-soil-type').textContent = r.diagnostics?.soilType || 'Loamy Alluvium';
    document.getElementById('diag-soil-texture').textContent = `Texture: ${r.diagnostics?.soilTexture || 'Medium'}`;

    // ML Recharge Assessment Card
    const ml = r.diagnostics?.mlAssessment;
    if (ml) {
      document.getElementById('diag-ml-recharge').textContent = `Recharge: ${formatVolumeWithUnits(ml.recharge_bcm)}`;
      document.getElementById('diag-ml-extraction').textContent = `Extraction: ${formatVolumeWithUnits(ml.extraction_bcm)}`;
      const stageStr = ml.stage_of_extraction_pct != null ? `${ml.stage_of_extraction_pct.toFixed(1)}% — ${ml.category || ''}` : '—';
      document.getElementById('diag-ml-stage').textContent = `Stage: ${stageStr}`;
    } else {
      document.getElementById('diag-ml-recharge').textContent = 'Recharge: — (no DB assessment)';
      document.getElementById('diag-ml-extraction').textContent = 'Extraction: —';
      document.getElementById('diag-ml-stage').textContent = 'Stage: —';
    }

    // Reasons List
    const reasonsList = document.getElementById('rec-reasons-list');
    reasonsList.innerHTML = '';
    if (Array.isArray(r.reasons)) {
      r.reasons.forEach(reason => {
        const li = document.createElement('li');
        li.textContent = reason;
        reasonsList.appendChild(li);
      });
    }

    // Scoring breakdown tooltip (if present)
    if (r.scoringBreakdown) {
      const breakdownText = r.scoringBreakdown.map(s => `${s.technique}: ${s.score}`).join(' | ');
      const existingBreakdown = document.getElementById('rec-score-breakdown');
      if (existingBreakdown) existingBreakdown.textContent = `Top 3 scores: ${breakdownText}`;
    }
  } else {
    alert(`Failed to fetch recommendation: ${res.data?.message || 'Error occurred'}`);
    closeRecModal();
  }
}

function closeRecModal() {
  document.getElementById('rec-modal').style.display = 'none';
}

async function loadSchemesForView() {
  const res = await apiRequest('GET', '/api/schemes');
  const container = document.getElementById('vh-schemes-container');
  container.innerHTML = '';

  if (res.status === 200 && Array.isArray(res.data?.data?.schemes)) {
    const schemes = res.data.data.schemes;
    if (schemes.length === 0) {
      container.innerHTML = '<p class="text-muted">No government schemes cataloged in database.</p>';
      return;
    }

    schemes.forEach(s => {
      const card = document.createElement('div');
      card.className = 'scheme-card';
      card.innerHTML = `
        <h5>${escapeHtml(s.name)}</h5>
        <span class="scheme-level-badge">${escapeHtml(s.government_level || 'STATE')} INITIATIVE</span>
        <p><strong>Benefit:</strong> ${escapeHtml(s.benefit_description || s.description)}</p>
        <p><strong>Eligibility:</strong> ${escapeHtml(s.eligibility || 'Agricultural holdings meeting criteria')}</p>
        <p><strong>Application:</strong> ${escapeHtml(s.application_information || 'Apply via state agriculture department')}</p>
        ${s.external_link ? `<a href="${escapeHtml(s.external_link)}" target="_blank" class="btn-small btn-secondary" style="display:inline-block;text-decoration:none;">Official Portal ↗</a>` : ''}
      `;
      container.appendChild(card);
    });
  }
}

// ==========================================
// AUDITOR WORKFLOW & VERIFICATION
// ==========================================

async function loadAuditorGrid() {
  const res = await apiRequest('GET', '/api/audits');
  const tbody = document.getElementById('auditor-grid-tbody');
  tbody.innerHTML = '';

  if (res.status === 200 && Array.isArray(res.data?.data?.audits)) {
    auditorGridData = res.data.data.audits;
    if (auditorGridData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">No seasonal crop records found in your assigned district. Add crop records in Village Head dashboard to verify them here.</td></tr>';
      return;
    }

    if (auditorGridData[0].district_name) {
      document.getElementById('auditor-district-name').textContent = `${auditorGridData[0].district_name} (District ID: ${auditorGridData[0].district_id})`;
    }

    auditorGridData.forEach(a => {
      let badge = '<span class="status-badge un-audited">Not Yet Audited</span>';
      let actionText = 'Record Audit';

      if (a.adoption_status === 'ADOPTED') {
        badge = '<span class="status-badge adopted">✓ Adoption Verified</span>';
        actionText = 'Update Audit';
      } else if (a.adoption_status === 'NOT_ADOPTED') {
        badge = '<span class="status-badge not-adopted">✗ Not Adopted</span>';
        actionText = 'Update Audit';
      } else if (a.adoption_status === 'PENDING') {
        badge = '<span class="status-badge pending">⏳ Pending Audit</span>';
        actionText = 'Update Audit';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${a.record_id}</strong></td>
        <td>${escapeHtml(a.farm_name || `Farm ${a.farm_id}`)}</td>
        <td>${escapeHtml(a.village_name || `Village ${a.village_id}`)}</td>
        <td>${escapeHtml(a.agricultural_year || '2026')}</td>
        <td>${escapeHtml(a.crop_name || 'Crop Record')}</td>
        <td>${escapeHtml(a.current_irrigation_method_name || '-')}</td>
        <td>${escapeHtml(a.actual_irrigation_method_name || '-')}</td>
        <td>${badge}</td>
        <td>
          <button onclick="openAuditModal(${a.record_id})" class="btn-small btn-verify">
            ${actionText}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Error loading audits: ${res.data?.message || 'Unauthorized'}</td></tr>`;
  }
}

function openAuditModal(recordId) {
  const item = auditorGridData.find(a => a.record_id === recordId);
  if (!item) return;

  document.getElementById('modal-audit-id').value = item.audit_id || '';
  document.getElementById('modal-audit-record-id').value = item.record_id;
  document.getElementById('modal-audit-farm').textContent = item.farm_name || `Farm #${item.farm_id}`;
  document.getElementById('modal-audit-village').textContent = item.village_name || `Village #${item.village_id}`;
  document.getElementById('modal-audit-season').textContent = `${item.season_name || ''} (${item.agricultural_year || '2026'})`;
  document.getElementById('modal-audit-crop').textContent = `${item.crop_name || 'Crop'} (Current: ${item.current_irrigation_method_name || 'Flood'})`;

  document.getElementById('modal-audit-method').value = item.actual_irrigation_method_id || '2';
  
  // Set adoption radio
  const adoptionRadios = document.getElementsByName('adoption_radio');
  const currentStatus = (item.adoption_status && item.adoption_status !== 'UNAUDITED') ? item.adoption_status : 'ADOPTED';
  for (const radio of adoptionRadios) {
    radio.checked = (radio.value === currentStatus);
  }

  document.getElementById('modal-audit-date').value = item.audit_date ? item.audit_date.split('T')[0] : new Date().toISOString().split('T')[0];
  document.getElementById('modal-audit-notes').value = item.notes || '';

  document.getElementById('audit-modal').style.display = 'flex';
}

function closeAuditModal() {
  document.getElementById('audit-modal').style.display = 'none';
}

async function saveAuditVerification() {
  const auditId = document.getElementById('modal-audit-id').value;
  const record_id = parseInt(document.getElementById('modal-audit-record-id').value, 10);
  const actual_irrigation_method_id = parseInt(document.getElementById('modal-audit-method').value, 10);
  
  let adoption_status = 'ADOPTED';
  const adoptionRadios = document.getElementsByName('adoption_radio');
  for (const radio of adoptionRadios) {
    if (radio.checked) {
      adoption_status = radio.value;
      break;
    }
  }

  const audit_date = document.getElementById('modal-audit-date').value || new Date().toISOString().split('T')[0];
  const notes = document.getElementById('modal-audit-notes').value.trim();

  const payload = {
    record_id,
    actual_irrigation_method_id,
    adoption_status,
    audit_date,
    notes: notes || `Field audit: ${adoption_status}`
  };

  let res;
  if (auditId) {
    res = await apiRequest('PUT', `/api/audits/${auditId}`, payload);
  } else {
    res = await apiRequest('POST', '/api/audits', payload);
  }

  if (res.status === 200 || res.status === 201) {
    closeAuditModal();
    await loadAuditorGrid();
  } else {
    alert(`Audit submission failed: ${res.data?.message || 'Error'}`);
  }
}

// ==========================================
// ADMIN SCHEME MANAGEMENT WORKFLOW
// ==========================================

let adminSchemesList = [];

async function loadAdminSchemes() {
  const res = await apiRequest('GET', '/api/schemes');
  const tbody = document.getElementById('admin-schemes-tbody');
  tbody.innerHTML = '';

  if (res.status === 200 && Array.isArray(res.data?.data?.schemes)) {
    adminSchemesList = res.data.data.schemes;
    if (adminSchemesList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No government schemes in database. Click "+ Add New Scheme" to create one.</td></tr>';
      return;
    }

    adminSchemesList.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${s.scheme_id}</strong></td>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td><span class="scheme-level-badge">${escapeHtml(s.government_level || 'STATE')}</span></td>
        <td>${escapeHtml(s.benefit_description || s.description)}</td>
        <td>${s.external_link ? `<a href="${escapeHtml(s.external_link)}" target="_blank">Portal Link</a>` : '-'}</td>
        <td>
          <button onclick="openSchemeModal('edit', ${s.scheme_id})" class="btn-small btn-secondary">Edit</button>
          <button onclick="handleDeleteScheme(${s.scheme_id}, '${escapeHtml(s.name)}')" class="btn-small btn-danger">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Error loading schemes: ${res.data?.message || 'Unauthorized'}</td></tr>`;
  }
}

function openSchemeModal(mode, schemeId = null) {
  const modal = document.getElementById('scheme-modal');
  const title = document.getElementById('scheme-modal-title');
  const idInput = document.getElementById('modal-scheme-id');

  if (mode === 'create') {
    title.textContent = '+ Add New Government Scheme';
    idInput.value = '';
    document.getElementById('modal-scheme-name').value = '';
    document.getElementById('modal-scheme-desc').value = '';
    document.getElementById('modal-scheme-level').value = 'STATE';
    document.getElementById('modal-scheme-link').value = '';
    document.getElementById('modal-scheme-benefit').value = '';
    document.getElementById('modal-scheme-eligibility').value = '';
    document.getElementById('modal-scheme-appinfo').value = '';
  } else {
    title.textContent = 'Edit Government Scheme';
    idInput.value = schemeId;
    const scheme = adminSchemesList.find(s => s.scheme_id === schemeId);
    if (scheme) {
      document.getElementById('modal-scheme-name').value = scheme.name || '';
      document.getElementById('modal-scheme-desc').value = scheme.description || '';
      document.getElementById('modal-scheme-level').value = scheme.government_level || 'STATE';
      document.getElementById('modal-scheme-link').value = scheme.external_link || '';
      document.getElementById('modal-scheme-benefit').value = scheme.benefit_description || '';
      document.getElementById('modal-scheme-eligibility').value = scheme.eligibility || '';
      document.getElementById('modal-scheme-appinfo').value = scheme.application_information || '';
    }
  }

  modal.style.display = 'flex';
}

function closeSchemeModal() {
  document.getElementById('scheme-modal').style.display = 'none';
}

async function saveSchemeModal() {
  const schemeId = document.getElementById('modal-scheme-id').value;
  const name = document.getElementById('modal-scheme-name').value.trim();
  const description = document.getElementById('modal-scheme-desc').value.trim();
  const government_level = document.getElementById('modal-scheme-level').value;
  const external_link = document.getElementById('modal-scheme-link').value.trim();
  const benefit_description = document.getElementById('modal-scheme-benefit').value.trim();
  const eligibility = document.getElementById('modal-scheme-eligibility').value.trim();
  const application_information = document.getElementById('modal-scheme-appinfo').value.trim();

  if (!name || !description) {
    alert('Scheme Name and Description are required.');
    return;
  }

  const payload = {
    name,
    description,
    government_level,
    benefit_description: benefit_description || null,
    eligibility: eligibility || null,
    application_information: application_information || null,
    external_link: external_link || null
  };

  let res;
  if (!schemeId) {
    res = await apiRequest('POST', '/api/schemes', payload);
  } else {
    res = await apiRequest('PUT', `/api/schemes/${schemeId}`, payload);
  }

  if (res.status === 200 || res.status === 201) {
    closeSchemeModal();
    await loadAdminSchemes();
  } else {
    alert(`Failed to save scheme: ${res.data?.message || 'Error'}`);
  }
}

async function handleDeleteScheme(schemeId, schemeName) {
  if (!confirm(`Are you sure you want to delete scheme "${schemeName}" (#${schemeId})?`)) {
    return;
  }

  const res = await apiRequest('DELETE', `/api/schemes/${schemeId}`);
  if (res.status === 200) {
    await loadAdminSchemes();
  } else {
    alert(`Failed to delete scheme: ${res.data?.message || 'Error'}`);
  }
}

// ==========================================
// SUSTAINABILITY SCORE WORKFLOW & MODAL
// ==========================================

async function handleCalculateScore(farmId, seasonId, agriculturalYear) {
  const res = await apiRequest('POST', `/api/farms/${farmId}/sustainability-score/calculate`, {
    season_id: seasonId,
    agricultural_year: agriculturalYear
  });

  if (res.status === 200 && res.data?.data) {
    openScoreModal(res.data.data);
    const farmTitle = document.getElementById('selected-farm-title').textContent;
    await selectFarm(farmId, farmTitle, selectedFarmVillageId);
  } else {
    alert(`Failed to calculate score: ${res.data?.message || 'Error'}`);
  }
}

function openScoreModalFromObject(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    openScoreModal(data);
  } catch (e) {
    console.error('Error parsing score data:', e);
  }
}

function openScoreModal(scoreData) {
  const modal = document.getElementById('score-modal');
  const totalEl = document.getElementById('score-modal-total');
  const badgeEl = document.getElementById('score-modal-priority-badge');
  const farmInfoEl = document.getElementById('score-modal-farm-info');

  const adoptionEl = document.getElementById('score-modal-adoption');
  const contEl = document.getElementById('score-modal-continued');
  const auditEl = document.getElementById('score-modal-audit');

  totalEl.textContent = `${scoreData.sustainability_score || 0} / 100`;
  badgeEl.textContent = `${scoreData.priority || 'LOW'} INTERVENTION PRIORITY`;
  badgeEl.className = 'status-badge ' + (scoreData.priority === 'HIGH' ? 'adopted' : scoreData.priority === 'MEDIUM' ? 'pending' : 'not-adopted');
  
  farmInfoEl.textContent = `Farm ID: #${scoreData.farm_id} | Season: ${scoreData.season_name || `Season ${scoreData.season_id}`} (${scoreData.agricultural_year})`;

  adoptionEl.textContent = `${scoreData.scores?.adoption || 0} / 50 pts`;
  contEl.textContent = `${scoreData.scores?.continued_adoption || 0} / 30 pts`;
  auditEl.textContent = `${scoreData.scores?.audit || 0} / 20 pts`;

  modal.style.display = 'flex';
}

function closeScoreModal() {
  document.getElementById('score-modal').style.display = 'none';
}

async function loadSustainabilityScoresTable() {
  const tbody = document.getElementById('admin-scores-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading sustainability scores...</td></tr>';

  const res = await apiRequest('GET', '/api/sustainability-scores');

  if (res.status === 200 && Array.isArray(res.data?.data?.scores)) {
    const scores = res.data.data.scores;
    if (scores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No seasonal sustainability scores calculated yet. Scores calculate automatically once farm audits are verified.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    scores.forEach(s => {
      const pClass = s.priority === 'HIGH' ? 'adopted' : s.priority === 'MEDIUM' ? 'pending' : 'not-adopted';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(s.farm_name || `Farm #${s.farm_id}`)}</strong></td>
        <td>${escapeHtml(s.village_name || `Village #${s.village_id}`)}</td>
        <td>${escapeHtml(s.district_name || 'Karnal')}</td>
        <td>${escapeHtml(s.season_name || `Season ${s.season_id}`)} (${escapeHtml(s.agricultural_year)})</td>
        <td><strong>${s.sustainability_score} / 100</strong></td>
        <td><span class="status-badge ${pClass}">${escapeHtml(s.priority)}</span></td>
        <td>
          <button onclick="openScoreModalFromObject(${escapeHtml(JSON.stringify(JSON.stringify(s)))})" class="btn-small btn-secondary">
            View 50/30/20 Breakdown
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Error loading scores: ${res.data?.message || 'Unauthorized'}</td></tr>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Auto-check session on DOM load
window.addEventListener('DOMContentLoaded', () => {
  checkSessionAndRoute();
  initMLGeoAutoComplete();
});


function toggleMapFullscreen() {
  const wrapper = document.getElementById('gis-map-wrapper');
  const fsBtnText = document.getElementById('map-fs-text');
  const fsIcon = document.getElementById('map-fs-icon');
  if (!wrapper) return;

  const isFullscreen = wrapper.classList.toggle('gis-map-wrapper-fullscreen');
  if (isFullscreen) {
    if (fsBtnText) fsBtnText.textContent = 'Exit Fullscreen';
    if (fsIcon) fsIcon.textContent = '✖️';
    wrapper.style.height = '100vh';
  } else {
    if (fsBtnText) fsBtnText.textContent = 'Fullscreen';
    if (fsIcon) fsIcon.textContent = '📺';
    wrapper.style.height = '520px';
  }
  
  setTimeout(() => {
    if (leafletMap) {
      leafletMap.invalidateSize();
    }
  }, 100);
}


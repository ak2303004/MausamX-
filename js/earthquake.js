const USGS_FEED_BASE = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/";
const USGS_FDSNWS = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const REFRESH_SEC = 120;      // auto-refresh interval (seconds) – short-range global mode only
const MAJOR_THRESHOLD = 6.0;     // magnitude above which alert popup appears
const SUGGEST_DEBOUNCE_MS = 380; // ms to wait before firing Nominatim autocomplete
const SUGGEST_MIN_CHARS = 2;   // minimum characters before showing suggestions

const RANGE_DAYS = {
  hour: 1 / 24,
  day: 1,
  week: 7,
  month: 30,
  "3month": 90,
  "6month": 180,
  year: 365
};

const FDSNWS_LIMIT = 1000;

function severity(mag) {
  if (mag >= 6.0) return { cls: "eq-danger", color: "#FF3B30" };
  if (mag >= 5.0) return { cls: "eq-warning", color: "#FF9500" };
  if (mag >= 4.0) return { cls: "eq-elevated", color: "#FFCC00" };
  return { cls: "eq-minor", color: "#34C759" };
}

function markerRadius(mag) {
  return Math.max(4, mag * 5);
}

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
const rangeSelect = document.getElementById("eq-range-select");
const magSelect = document.getElementById("eq-mag-select");
const filterBar = document.querySelector(".eq-filter-bar");
const refreshBtn = document.getElementById("eq-refresh-btn");
const countdownEl = document.getElementById("eq-countdown");
const loadingEl = document.getElementById("eq-loading");
const errorEl = document.getElementById("eq-error");
const errorMsg = document.getElementById("eq-error-msg");
const listEl = document.getElementById("eq-list");
const listHeader = document.getElementById("eq-list-header");
const listCount = document.getElementById("eq-list-count");
const listTitle = document.getElementById("eq-list-title");
const noResults = document.getElementById("eq-no-results");
const alertPopup = document.getElementById("eq-alert-popup");
const alertTitle = document.getElementById("eq-alert-title");
const alertBody = document.getElementById("eq-alert-body");
const alertClose = document.getElementById("eq-alert-close");
const statTotal = document.getElementById("stat-total-num");
const statMinor = document.getElementById("stat-minor-num");
const statModerate = document.getElementById("stat-moderate-num");
const statDanger = document.getElementById("stat-danger-num");
const searchInput = document.getElementById("eq-search-input");
const searchClear = document.getElementById("eq-search-clear");
const suggestionsEl = document.getElementById("eq-suggestions");
const radiusWrap = document.getElementById("eq-radius-wrap");
const radiusSelect = document.getElementById("eq-radius-select");
const searchBanner = document.getElementById("eq-search-banner");
const searchBannerTx = document.getElementById("eq-search-banner-text");
const backBtn = document.getElementById("eq-back-btn");

const canvasRenderer = L.canvas({ padding: 0.5 });

const map = L.map("eq-map", {
  center: [20, 10],
  zoom: 2,
  zoomControl: false,          // we'll add it to a custom position
  attributionControl: false,
  preferCanvas: true,
  zoomSnap: 0.5,
  zoomDelta: 0.5,
  wheelPxPerZoomLevel: 90
});

L.control.zoom({ position: "bottomright" }).addTo(map);

const tileLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  { subdomains: "abcd", maxZoom: 20, minZoom: 1 }
).addTo(map);

const FullscreenControl = L.Control.extend({
  options: { position: "topright" },
  onAdd() {
    const btn = L.DomUtil.create("button", "eq-fs-btn");
    btn.title = "Toggle fullscreen";
    btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    let isFs = false;
    L.DomEvent.on(btn, "click", () => {
      const container = document.getElementById("eq-map");
      isFs = !isFs;
      container.classList.toggle("eq-map-fullscreen", isFs);
      btn.innerHTML = isFs
        ? '<i class="fa-solid fa-compress"></i>'
        : '<i class="fa-solid fa-expand"></i>';
      setTimeout(() => map.invalidateSize(), 300);
    });
    return btn;
  }
});
new FullscreenControl().addTo(map);

const LegendControl = L.Control.extend({
  options: { position: "bottomleft" },
  onAdd() {
    const div = L.DomUtil.create("div", "eq-map-legend");
    div.innerHTML = `
      <div class="eq-legend-title">Magnitude Scale</div>
      <div class="eq-legend-row"><span class="eq-legend-dot" style="background:#34C759"></span> &lt; 4.0 Minor</div>
      <div class="eq-legend-row"><span class="eq-legend-dot" style="background:#FFCC00"></span> 4.0 – 4.9 Elevated</div>
      <div class="eq-legend-row"><span class="eq-legend-dot" style="background:#FF9500"></span> 5.0 – 5.9 Strong</div>
      <div class="eq-legend-row"><span class="eq-legend-dot" style="background:#FF3B30"></span> 6.0+ Danger</div>`;
    return div;
  }
});
new LegendControl().addTo(map);

let markersLayer = L.layerGroup().addTo(map);

let searchRadiusCircle = null;

let countdownTimer = null;   // setInterval for countdown display
let secondsLeft = REFRESH_SEC;
let alertedQuakeId = null;   // tracks last alerted quake to avoid re-popup
let isFetching = false;  // guard against concurrent requests

let searchMode = null;

function isExtendedRange(range) {
  return range === "3month" || range === "6month" || range === "year";
}

function buildStartTime() {
  const range = rangeSelect.value;
  const daysBack = RANGE_DAYS[range] || 1;
  return new Date(Date.now() - daysBack * 86400000).toISOString();
}

function buildGlobalUrl() {
  const range = rangeSelect.value;
  const magVal = magSelect.value;

  if (!isExtendedRange(range)) {
    const magPart = (magVal === "all" || magVal === "significant") ? magVal : magVal;
    return `${USGS_FEED_BASE}${magPart}_${range}.geojson`;
  }
  const minMag = (magVal === "all" || magVal === "significant") ? 0 : parseFloat(magVal);
  const params = new URLSearchParams({
    format: "geojson",
    starttime: buildStartTime(),
    endtime: new Date().toISOString(),
    minmagnitude: minMag,
    orderby: "time",
    limit: FDSNWS_LIMIT
  });
  return `${USGS_FDSNWS}?${params.toString()}`;
}

function buildSearchUrl(lat, lon, radiusKm) {
  const magVal = magSelect.value;
  const minMag = (magVal === "all" || magVal === "significant") ? 0 : parseFloat(magVal);

  const params = new URLSearchParams({
    format: "geojson",
    latitude: lat,
    longitude: lon,
    maxradiuskm: radiusKm,
    minmagnitude: minMag,
    starttime: buildStartTime(),
    endtime: new Date().toISOString(),
    orderby: "time",
    limit: FDSNWS_LIMIT
  });
  return `${USGS_FDSNWS}?${params.toString()}`;
}

async function fetchEarthquakes() {
  if (isFetching) return;
  isFetching = true;
  loadingEl.style.display = "flex";
  errorEl.style.display = "none";
  listHeader.style.display = "none";
  noResults.style.display = "none";
  listEl.innerHTML = "";
  markersLayer.clearLayers();
  if (searchRadiusCircle) {
    map.removeLayer(searchRadiusCircle);
    searchRadiusCircle = null;
  }

  try {
    let url;
    if (searchMode) {
      const radiusKm = parseInt(radiusSelect.value, 10);
      url = buildSearchUrl(searchMode.lat, searchMode.lon, radiusKm);
      searchRadiusCircle = L.circle([searchMode.lat, searchMode.lon], {
        radius: radiusKm * 1000, // metres
        color: "#332464",
        weight: 1.5,
        fillColor: "#332464",
        fillOpacity: 0.06,
        dashArray: "6 4"
      }).addTo(map);
      L.circleMarker([searchMode.lat, searchMode.lon], {
        radius: 6,
        fillColor: "#332464",
        color: "#fff",
        weight: 2,
        fillOpacity: 1
      }).bindPopup(`<strong>${searchMode.name}</strong>`).addTo(markersLayer);
      map.flyToBounds(searchRadiusCircle.getBounds(), { padding: [20, 20], duration: 1 });

    } else {
      url = buildGlobalUrl();
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const geojson = await response.json();
    const features = (geojson.features || []).sort(
      (a, b) => b.properties.time - a.properties.time
    );
    const totals = { minor: 0, moderate: 0, danger: 0 };
    features.forEach(f => {
      const m = f.properties.mag || 0;
      if (m < 2.5) totals.minor++;
      else if (m < 5.0) totals.moderate++;
      else totals.danger++;
    });
    statTotal.textContent = features.length;
    statMinor.textContent = totals.minor;
    statModerate.textContent = totals.moderate;
    statDanger.textContent = totals.danger;
    if (features.length === 0) {
      noResults.style.display = "flex";
      loadingEl.style.display = "none";
      isFetching = false;
      return;
    }
    features.forEach((feature, idx) => {
      const props = feature.properties;
      const coords = feature.geometry ? feature.geometry.coordinates : null;
      const mag = props.mag != null ? +props.mag.toFixed(1) : "N/A";
      const place = props.place || "Unknown location";
      const time = props.time;
      const depth = coords ? coords[2] : null;
      const lon = coords ? coords[0] : null;
      const lat = coords ? coords[1] : null;
      const link = props.url || "#";
      const { cls, color } = severity(mag);
      if (lat !== null && lon !== null) {
        const numMag = typeof mag === "number" ? mag : 0;
        const radius = markerRadius(mag);
        const isMajor = numMag >= 6.0;
        const depthPct = depth !== null ? Math.min(100, (depth / 700) * 100) : 0;
        const depthBar = depth !== null
          ? `<div class="eq-popup-depth-bar"><div class="eq-popup-depth-fill" style="width:${depthPct.toFixed(1)}%"></div></div>`
          : "";
        const popupHtml = `
          <div class="eq-popup">
            <div class="eq-popup-mag" style="background:${color}">${mag !== "N/A" ? "M " + mag : "M ?"}</div>
            <div class="eq-popup-body">
              <div class="eq-popup-place">${place}</div>
              <div class="eq-popup-row"><i class="fa-regular fa-clock"></i> ${timeAgo(time)}</div>
              ${depth !== null ? `<div class="eq-popup-row"><i class="fa-solid fa-arrow-down"></i> Depth: ${depth.toFixed(1)} km ${depthBar}</div>` : ""}
              <div class="eq-popup-row"><i class="fa-solid fa-map-pin"></i> ${lat.toFixed(3)}°, ${lon.toFixed(3)}°</div>
            </div>
          </div>`;

        if (isMajor) {
          const pulseIcon = L.divIcon({
            className: "",
            html: `<div class="eq-pulse-wrapper" style="--c:${color}">
                     <div class="eq-pulse-ring"></div>
                     <div class="eq-pulse-dot" style="width:${radius * 2}px;height:${radius * 2}px;background:${color}"></div>
                   </div>`,
            iconSize: [radius * 2 + 24, radius * 2 + 24],
            iconAnchor: [radius + 12, radius + 12]
          });
          L.marker([lat, lon], { icon: pulseIcon })
            .bindPopup(popupHtml, { className: "eq-leaflet-popup", maxWidth: 260 })
            .addTo(markersLayer);
        } else {
          L.circleMarker([lat, lon], {
            renderer: canvasRenderer,
            radius,
            fillColor: color,
            color: "rgba(255,255,255,0.25)",
            weight: 1,
            fillOpacity: 0.85
          })
            .bindPopup(popupHtml, { className: "eq-leaflet-popup", maxWidth: 260 })
            .addTo(markersLayer);
        }
      }
      const card = document.createElement("div");
      card.className = `eq-card ${cls}`;
      card.style.animationDelay = `${idx * 0.04}s`;
      card.innerHTML = `
        <div class="eq-mag-badge">${mag !== "N/A" ? mag : "?"}</div>
        <div class="eq-card-body">
          <div class="eq-card-location" title="${place}">${place}</div>
          <div class="eq-card-meta">
            <span class="eq-meta-item">
              <i class="fa-regular fa-clock"></i> ${timeAgo(time)}
            </span>
            ${depth !== null ? `
            <span class="eq-meta-item">
              <i class="fa-solid fa-arrow-down"></i> ${depth.toFixed(1)} km deep
            </span>` : ""}
            ${lat !== null ? `
            <span class="eq-meta-item">
              <i class="fa-solid fa-map-pin"></i> ${lat.toFixed(2)}°, ${lon.toFixed(2)}°
            </span>` : ""}
          </div>
          ${mag >= 5.0 ? `<span class="eq-danger-label">⚠ Strong Event</span>` : ""}
        </div>
        <a href="${link}" target="_blank" rel="noopener" title="View on USGS"
           style="color:#332464;font-size:16px;text-decoration:none;"
           onclick="event.stopPropagation()">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>`;
      if (lat !== null) {
        card.addEventListener("click", () => map.flyTo([lat, lon], 6, { duration: 1 }));
      }

      listEl.appendChild(card);
    });
    listHeader.style.display = "flex";
    listTitle.textContent = searchMode
      ? `Near "${searchMode.name}"`
      : "Recent Events";
    listCount.textContent = `${features.length} event${features.length !== 1 ? "s" : ""}`;
    const biggest = features.find(f => (f.properties.mag || 0) >= MAJOR_THRESHOLD);
    if (biggest && biggest.id !== alertedQuakeId) {
      alertedQuakeId = biggest.id;
      const p = biggest.properties;
      alertTitle.textContent = `⚠ Major Earthquake Detected (M ${(+p.mag).toFixed(1)})`;
      alertBody.textContent = `${p.place} — ${timeAgo(p.time)}. Stay alert and follow local emergency guidance.`;
      alertPopup.style.display = "flex";
    }

  } catch (err) {
    console.error("Earthquake fetch error:", err);
    errorMsg.textContent = `Failed to load earthquake data. (${err.message})`;
    errorEl.style.display = "flex";
  } finally {
    loadingEl.style.display = "none";
    isFetching = false;
  }
}

function startCountdown() {
  clearInterval(countdownTimer);
  if (searchMode || isExtendedRange(rangeSelect.value)) {
    countdownEl.textContent = "–";
    return;
  }

  secondsLeft = REFRESH_SEC;
  countdownEl.textContent = `${secondsLeft}s`;

  countdownTimer = setInterval(() => {
    secondsLeft--;
    countdownEl.textContent = `${secondsLeft}s`;
    if (secondsLeft <= 0) {
      clearInterval(countdownTimer);
      fetchEarthquakes().then(startCountdown);
    }
  }, 1000);
}

let suggestDebounce = null;
let activeSuggestion = -1;   // keyboard navigation index
let lastQuery = "";   // track last geocoded string

async function fetchSuggestions(query) {
  if (query.length < SUGGEST_MIN_CHARS) {
    closeSuggestions();
    return;
  }
  suggestionsEl.innerHTML = `
    <li class="eq-suggestions-loading">
      <span class="eq-spinner-sm"></span> Searching locations…
    </li>`;
  suggestionsEl.classList.add("open");

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: 6,
      addressdetails: 1
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { "Accept-Language": "en" }
    });
    const data = await res.json();

    if (!data.length) {
      suggestionsEl.innerHTML = `
        <li class="eq-suggestion-item" style="pointer-events:none;color:#aaa;font-size:13px;">
          No locations found
        </li>`;
      suggestionsEl.classList.add("open");
      return;
    }

    suggestionsEl.innerHTML = "";
    activeSuggestion = -1;

    data.forEach((place, i) => {
      const name = place.name || place.display_name.split(",")[0];
      const subtext = place.display_name;
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);

      const li = document.createElement("li");
      li.className = "eq-suggestion-item";
      li.role = "option";
      li.dataset.index = i;
      li.innerHTML = `
        <i class="fa-solid fa-location-dot eq-suggestion-icon"></i>
        <div>
          <div class="eq-suggestion-name">${name}</div>
          <div class="eq-suggestion-sub">${subtext}</div>
        </div>`;

      li.addEventListener("click", () => selectLocation(lat, lon, name));
      suggestionsEl.appendChild(li);
    });

    suggestionsEl.classList.add("open");

  } catch (err) {
    console.error("Nominatim error:", err);
    closeSuggestions();
  }
}

function closeSuggestions() {
  suggestionsEl.classList.remove("open");
  suggestionsEl.innerHTML = "";
  activeSuggestion = -1;
}

async function selectLocation(lat, lon, name) {
  closeSuggestions();
  searchInput.value = name;
  searchClear.style.display = "inline-flex";
  lastQuery = name;
  searchMode = { lat, lon, name };
  radiusWrap.classList.add("visible");
  searchBanner.style.display = "flex";
  searchBannerTx.textContent = `Earthquakes within ${radiusSelect.value} km of "${name}"`;
  clearInterval(countdownTimer);
  countdownEl.textContent = "–";
  await fetchEarthquakes();
}

function resetToGlobal() {
  searchMode = null;
  searchInput.value = "";
  searchClear.style.display = "none";
  searchBanner.style.display = "none";
  radiusWrap.classList.remove("visible");
  closeSuggestions();
  fetchEarthquakes().then(startCountdown);
  map.flyTo([20, 10], 2, { duration: 1.2 });
}
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  searchClear.style.display = q.length ? "inline-flex" : "none";

  clearTimeout(suggestDebounce);
  if (!q) { closeSuggestions(); return; }

  suggestDebounce = setTimeout(() => fetchSuggestions(q), SUGGEST_DEBOUNCE_MS);
});
searchInput.addEventListener("keydown", e => {
  const items = suggestionsEl.querySelectorAll(".eq-suggestion-item[data-index]");

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeSuggestion = Math.min(activeSuggestion + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle("active", i === activeSuggestion));

  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeSuggestion = Math.max(activeSuggestion - 1, 0);
    items.forEach((el, i) => el.classList.toggle("active", i === activeSuggestion));

  } else if (e.key === "Enter") {
    e.preventDefault();
    if (activeSuggestion >= 0 && items[activeSuggestion]) {
      items[activeSuggestion].click();
    } else if (searchInput.value.trim()) {
      fetchSuggestions(searchInput.value.trim());
    }

  } else if (e.key === "Escape") {
    closeSuggestions();
  }
});
searchClear.addEventListener("click", () => {
  if (searchMode) {
    resetToGlobal();
  } else {
    searchInput.value = "";
    searchClear.style.display = "none";
    closeSuggestions();
  }
});
document.addEventListener("click", e => {
  if (!e.target.closest("#eq-search-section")) closeSuggestions();
});
backBtn.addEventListener("click", resetToGlobal);
radiusSelect.addEventListener("change", () => {
  if (!searchMode) return;
  searchBannerTx.textContent = `Earthquakes within ${radiusSelect.value} km of "${searchMode.name}"`;
  fetchEarthquakes();
});
refreshBtn.addEventListener("click", () => {
  if (searchMode) {
    fetchEarthquakes(); // re-run location search
  } else {
    fetchEarthquakes().then(startCountdown);
  }
});
let filterDebounce;
function onFilterChange() {
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(() => {
    if (searchMode) {
      fetchEarthquakes();
    } else {
      fetchEarthquakes().then(startCountdown);
    }
  }, 400);
}
rangeSelect.addEventListener("change", onFilterChange);
magSelect.addEventListener("change", onFilterChange);

alertClose.addEventListener("click", () => {
  alertPopup.style.display = "none";
});
alertPopup.addEventListener("click", e => {
  if (e.target === alertPopup) alertPopup.style.display = "none";
});

(async () => {
  await fetchEarthquakes();
  startCountdown();
})();
(function initVoiceSearch() {
    const voiceBtn  = document.getElementById("voice-btn");
    const searchInp = document.getElementById("eq-search-input");

    if (!voiceBtn || !searchInp) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
        voiceBtn.title = "Voice search not supported in this browser (use Chrome/Edge)";
        voiceBtn.style.opacity = "0.4";
        voiceBtn.style.cursor  = "not-allowed";
        return;
    }

    const toast = document.createElement("div");
    toast.id = "voice-toast";
    toast.style.cssText = [
        "position:fixed","top:68px","left:50%","transform:translateX(-50%) translateY(-10px)",
        "background:rgba(30,30,50,0.97)","border:1px solid rgba(255,255,255,0.12)",
        "border-radius:30px","padding:8px 20px","font-size:13px","font-weight:600",
        "color:#fff","pointer-events:none","z-index:99999",
        "opacity:0","transition:opacity 0.25s, transform 0.25s","white-space:nowrap"
    ].join(";");
    document.body.appendChild(toast);

    function showToast(msg, color) {
        toast.textContent = msg;
        toast.style.borderColor = color || "rgba(255,255,255,0.15)";
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
    }
    function hideToast() {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(-10px)";
    }

    const rec = new SR();
    rec.continuous       = false;
    rec.interimResults   = false;
    rec.maxAlternatives  = 1;

    let listening = false;

    function startListening() {
        try { rec.start(); } catch (err) {}
    }

    voiceBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (listening) { rec.stop(); return; }
        startListening();
    });

    rec.onstart = () => {
        listening = true;
        searchInp.placeholder = "🎤 Listening…";
        showToast("🎤  Speak a city name…", "#ff3b30");
        voiceBtn.style.animation = "mic-pulse 0.9s ease-in-out infinite";
        const icon = document.getElementById("voice-icon");
        if (icon) icon.style.stroke = "#ff3b30";
    };

    rec.onresult = (e) => {
        const city = e.results[0][0].transcript.trim();
        searchInp.value = city;
        showToast(`✅  Searching: ${city}`, "#34c759");
        setTimeout(() => {
            hideToast();
            searchInp.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        }, 800);
    };

    rec.onerror = (e) => {
        let msg = "Voice error — try again";
        if (e.error === "not-allowed")  msg = "❌  Mic blocked — allow access";
        if (e.error === "no-speech")    msg = "🔇  No speech detected — try again";
        if (e.error === "network")      msg = "❌  Network error (Must use Live Server, not file://)";
        showToast(msg, "#ff9500");
        setTimeout(hideToast, 3000);
    };

    rec.onend = () => {
        listening = false;
        searchInp.placeholder = "Search by city, region or country…";
        voiceBtn.style.animation = "none";
        const icon = document.getElementById("voice-icon");
        if (icon) icon.style.stroke = "#9898b8";
    };
})();
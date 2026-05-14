const GLOBE_API_KEY = "1e3e8f230b6064d27976e41163a82b77";
const OWM_CURRENT = "https://api.openweathermap.org/data/2.5/weather";
const OWM_FORECAST = "https://api.openweathermap.org/data/2.5/forecast";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

const GLOBE_CITIES = [
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "Paris", lat: 48.85, lon: 2.35 },
  { name: "Moscow", lat: 55.75, lon: 37.62 },
  { name: "Cairo", lat: 30.04, lon: 31.24 },
  { name: "Dubai", lat: 25.20, lon: 55.27 },
  { name: "Mumbai", lat: 19.08, lon: 72.88 },
  { name: "Delhi", lat: 28.70, lon: 77.10 },
  { name: "Beijing", lat: 39.91, lon: 116.39 },
  { name: "Tokyo", lat: 35.69, lon: 139.69 },
  { name: "Sydney", lat: -33.87, lon: 151.21 },
  { name: "New York", lat: 40.71, lon: -74.01 },
  { name: "Los Angeles", lat: 34.05, lon: -118.24 },
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "Lagos", lat: 6.45, lon: 3.39 },
  { name: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Bangkok", lat: 13.75, lon: 100.52 },
  { name: "Nairobi", lat: -1.29, lon: 36.82 },
  { name: "Istanbul", lat: 41.01, lon: 28.95 },
];

const canvas = document.getElementById("globe-canvas");
const wrap = document.getElementById("globe-wrap");
const loadingEl = document.getElementById("globe-loading");
const labelsLayer = document.getElementById("globe-labels-layer");
const searchInput = document.getElementById("globe-search-input");
const style = document.createElement("style");
style.textContent = `
#globe-labels-layer {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  overflow: hidden;
  z-index: 10;
}
.globe-marker-label {
  position: absolute;
  background: rgba(10, 20, 35, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
  color: #fff;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13px;
  pointer-events: none;
  transition: opacity 0.2s ease;
  white-space: nowrap;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  transform: translate(-50%, -100%);
}
.globe-marker-label strong {
  color: #5ac8fa;
  margin-right: 6px;
}
`;
document.head.appendChild(style);
const searchClear = document.getElementById("gsc-clear");
const searchDrop = document.getElementById("globe-search-dropdown");
const grpEmpty = document.getElementById("grp-empty");
const grpPanelLoad = document.getElementById("grp-panel-loading");
const grpInfo = document.getElementById("grp-info");
const grpCity = document.getElementById("grp-city");
const grpCountry = document.getElementById("grp-country");
const grpTemp = document.getElementById("grp-temp");
const grpCondition = document.getElementById("grp-condition");
const grpFeels = document.getElementById("grp-feels");
const grpIcon = document.getElementById("grp-icon");
const grpHumidity = document.getElementById("grp-humidity");
const grpWind = document.getElementById("grp-wind");
const grpPressure = document.getElementById("grp-pressure");
const grpVisibility = document.getElementById("grp-visibility");
const grpForecast = document.getElementById("grp-forecast-list");
const grpCoords = document.getElementById("grp-coords");

const W = wrap.clientWidth || 600;
const H = wrap.clientHeight || 480;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
camera.position.z = 2.8;

scene.add(new THREE.AmbientLight(0x334466, 1.2));
const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
sunLight.position.set(4, 3, 5);
scene.add(sunLight);
const rimLight = new THREE.DirectionalLight(0x3355ff, 0.5);
rimLight.position.set(-5, -2, -4);
scene.add(rimLight);

const GLOBE_RADIUS = 1.0;
const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);

function makeProceduralTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#0d2240"); g.addColorStop(0.5, "#0a2a4a"); g.addColorStop(1, "#061520");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
  return new THREE.CanvasTexture(c);
}

const globeMat = new THREE.MeshPhongMaterial({
  map: makeProceduralTexture(), specular: new THREE.Color(0x000000), shininess: 0
});
const tl = new THREE.TextureLoader();
tl.load(
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/planets/earth_atmos_2048.jpg",
  t => { globeMat.map = t; globeMat.needsUpdate = true; }, undefined,
  () => tl.load("https://unpkg.com/three@0.134.0/examples/textures/planets/earth_atmos_2048.jpg",
    t => { globeMat.map = t; globeMat.needsUpdate = true; })
);

const globe = new THREE.Mesh(globeGeo, globeMat);
scene.add(globe);
const atmMat = new THREE.MeshPhongMaterial({
  color: 0x3366ff, emissive: 0x112266, transparent: true,
  opacity: 0.09, side: THREE.FrontSide, depthWrite: false,
  specular: new THREE.Color(0x000000), shininess: 0
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS + 0.045, 64, 64), atmMat));
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_RADIUS + 0.10, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0x1133aa, transparent: true, opacity: 0.04, side: THREE.BackSide })
));

function buildGraticule() {
  const mat = new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.22 });
  const grp = new THREE.Group();
  const r = GLOBE_RADIUS + 0.002;
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [], phi = THREE.MathUtils.degToRad(90 - lat);
    for (let lon = 0; lon <= 360; lon += 3) {
      const t = THREE.MathUtils.degToRad(lon);
      pts.push(new THREE.Vector3(r * Math.sin(phi) * Math.cos(t), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(t)));
    }
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  for (let lon = 0; lon < 360; lon += 30) {
    const pts = [], theta = THREE.MathUtils.degToRad(lon);
    for (let lat = -90; lat <= 90; lat += 3) {
      const phi = THREE.MathUtils.degToRad(90 - lat);
      pts.push(new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)));
    }
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  return grp;
}
let graticule = buildGraticule();
scene.add(graticule);

(function () {
  const pos = [];
  for (let i = 0; i < 2000; i++) {
    const v = new THREE.Vector3((Math.random() - .5) * 200, (Math.random() - .5) * 200, (Math.random() - .5) * 200);
    if (v.length() > 10) pos.push(v.x, v.y, v.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaaccff, size: 0.12, transparent: true, opacity: 0.5 })));
})();

function latLonToVec3(lat, lon, r) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    -r * Math.sin(phi) * Math.sin(theta)
  );
}

function vec3ToLatLon(v) {
  const r = v.length();
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(Math.min(1, Math.max(-1, v.y / r))));
  let lon = THREE.MathUtils.radToDeg(Math.atan2(-v.z, v.x));
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return { lat, lon };
}

function windDirStr(deg) {
  if (deg == null) return "–";
  return ["N ↑", "NE ↗", "E →", "SE ↘", "S ↓", "SW ↙", "W ←", "NW ↖"][Math.round(deg / 45) % 8];
}

function fmtVis(m) {
  if (!m && m !== 0) return "–";
  return m >= 10000 ? "≥ 10 km" : (m / 1000).toFixed(1) + " km";
}

function fmtTime(unix, tz = 0) {
  return new Date((unix + tz) * 1000).toUTCString().slice(17, 22);
}

function conditionColor(main) {
  const m = (main || "").toLowerCase();
  if (m.includes("thunder")) return "#bf5af2";
  if (m.includes("rain") || m.includes("drizzle")) return "#30b0c7";
  if (m.includes("snow")) return "#5ac8fa";
  return "#34c759";
}

const citiesGroup = new THREE.Group();
const cityMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
const cityGeo = new THREE.SphereGeometry(0.006, 8, 8);
GLOBE_CITIES.forEach(c => {
  const mesh = new THREE.Mesh(cityGeo, cityMat);
  mesh.position.copy(latLonToVec3(c.lat, c.lon, GLOBE_RADIUS));
  citiesGroup.add(mesh);
});
globe.add(citiesGroup);

const markerGroup = new THREE.Group();
const markerCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.012, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xff3333 })
);
const markerGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.025, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.4 })
);
markerGroup.add(markerCore);
markerGroup.add(markerGlow);
markerGroup.visible = false;
globe.add(markerGroup);

let currentLabel = { lat: 0, lon: 0, element: null };

function setMarker(lat, lon) {
  const pos = latLonToVec3(lat, lon, GLOBE_RADIUS);
  markerGroup.position.copy(pos);
  markerGroup.visible = true;
}

function updateLabel(lat, lon, name, temp) {
  if (!currentLabel.element) {
    currentLabel.element = document.createElement("div");
    currentLabel.element.className = "globe-marker-label";
    labelsLayer.appendChild(currentLabel.element);
  }
  currentLabel.lat = lat;
  currentLabel.lon = lon;
  currentLabel.element.innerHTML = `<strong>${name}</strong> <span>${temp}</span>`;
  currentLabel.element.style.display = "block";
}

function showPanelState(state) {
  grpEmpty.style.display = state === "empty" ? "flex" : "none";
  grpPanelLoad.style.display = state === "loading" ? "flex" : "none";
  grpInfo.style.display = state === "info" ? "block" : "none";
}
showPanelState("empty");

async function fetchAndShow(lat, lon) {
  showPanelState("loading");
  try {
    const [curRes, fcRes] = await Promise.all([
      fetch(`${OWM_CURRENT}?lat=${lat}&lon=${lon}&units=metric&appid=${GLOBE_API_KEY}`),
      fetch(`${OWM_FORECAST}?lat=${lat}&lon=${lon}&units=metric&cnt=40&appid=${GLOBE_API_KEY}`)
    ]);
    if (!curRes.ok) throw new Error("API error");
    const cur = await curRes.json();
    const fc = fcRes.ok ? await fcRes.json() : null;
    renderPanel(cur, fc, lat, lon);
    showPanelState("info");
  } catch (e) {
    console.error(e);
    showPanelState("empty");
  }
}

function renderPanel(cur, fc, lat, lon) {
  const w = cur;
  grpCity.textContent = w.name || "–";
  grpCountry.textContent = w.sys?.country || "";
  grpTemp.textContent = `${Math.round(w.main.temp)}°C`;
  const cond = w.weather[0].description;
  grpCondition.textContent = cond.toUpperCase();
  grpCondition.style.color = conditionColor(w.weather[0].main);
  grpFeels.textContent = `Feels like ${Math.round(w.main.feels_like)}°C`;
  grpIcon.src = `https://openweathermap.org/img/wn/${w.weather[0].icon}@2x.png`;
  grpIcon.alt = cond;
  grpHumidity.textContent = `${w.main.humidity}%`;
  grpWind.textContent = `${Math.round(w.wind.speed * 3.6)} km/h ${windDirStr(w.wind.deg)}`;
  grpPressure.textContent = `${w.main.pressure} hPa`;
  grpVisibility.textContent = fmtVis(w.visibility);
  grpCoords.textContent = `📍 ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  renderForecast(fc);
  updateLabel(lat, lon, w.name || "–", `${Math.round(w.main.temp)}°C`);
}

function renderForecast(fc) {
  grpForecast.innerHTML = "";
  if (!fc || !fc.list) return;
  const days = {};
  fc.list.forEach(item => {
    const d = new Date(item.dt * 1000);
    const key = d.toISOString().slice(0, 10);
    const hour = d.getUTCHours();
    if (!days[key] || Math.abs(hour - 12) < Math.abs(new Date(days[key].dt * 1000).getUTCHours() - 12)) {
      days[key] = item;
    }
  });

  const entries = Object.values(days).slice(0, 5);
  const allTemps = entries.map(e => e.main.temp);
  const minT = Math.min(...allTemps), maxT = Math.max(...allTemps);

  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  entries.forEach((item, i) => {
    const date = new Date(item.dt * 1000);
    const label = i === 0 ? "TODAY" : dayNames[date.getUTCDay()];
    const hi = Math.round(item.main.temp_max);
    const lo = Math.round(item.main.temp_min);
    const icon = item.weather[0].icon;
    const range = maxT - minT || 1;
    const barL = ((item.main.temp_min - minT) / range * 70).toFixed(1);
    const barW = (((item.main.temp_max - item.main.temp_min) / range) * 70 + 10).toFixed(1);

    const row = document.createElement("div");
    row.className = "grp-fc-row";
    row.innerHTML = `
      <span class="grp-fc-day">${label}</span>
      <img class="grp-fc-icon" src="https://openweathermap.org/img/wn/${icon}.png" alt="" />
      <div class="grp-fc-bar-wrap">
        <span class="grp-fc-lo">${lo}°</span>
        <div class="grp-fc-bar">
          <div class="grp-fc-fill" style="margin-left:${barL}%;width:${barW}%"></div>
        </div>
        <span class="grp-fc-hi">${hi}°</span>
      </div>`;
    grpForecast.appendChild(row);
  });
}

const raycaster = new THREE.Raycaster();
let isDragging = false, dragMoved = false;
let prevMX = 0, prevMY = 0, rotVelX = 0, rotVelY = 0;

wrap.addEventListener("mousedown", e => {
  isDragging = true; dragMoved = false;
  prevMX = e.clientX; prevMY = e.clientY;
  wrap.style.cursor = "grabbing";
});
window.addEventListener("mouseup", () => { isDragging = false; wrap.style.cursor = "grab"; });
window.addEventListener("mousemove", e => {
  if (!isDragging) return;
  const dx = e.clientX - prevMX, dy = e.clientY - prevMY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
  rotVelX = dy * 0.003; rotVelY = dx * 0.003;
  globe.rotation.x += rotVelX; globe.rotation.y += rotVelY;
  prevMX = e.clientX; prevMY = e.clientY;
});

wrap.addEventListener("touchstart", e => {
  prevMX = e.touches[0].clientX; prevMY = e.touches[0].clientY;
  isDragging = true; dragMoved = false;
}, { passive: true });
wrap.addEventListener("touchmove", e => {
  if (!isDragging) return;
  const dx = e.touches[0].clientX - prevMX, dy = e.touches[0].clientY - prevMY;
  dragMoved = true;
  globe.rotation.x += dy * 0.003; globe.rotation.y += dx * 0.003;
  prevMX = e.touches[0].clientX; prevMY = e.touches[0].clientY;
}, { passive: true });
wrap.addEventListener("touchend", e => {
  isDragging = false;
  if (!dragMoved && e.changedTouches.length) {
    const t = e.changedTouches[0];
    handleGlobeClick(t.clientX, t.clientY);
  }
}, { passive: true });

wrap.addEventListener("click", e => { if (!dragMoved) handleGlobeClick(e.clientX, e.clientY); });

function handleGlobeClick(cx, cy) {
  const rect = wrap.getBoundingClientRect();
  const mv = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(mv, camera);
  const hits = raycaster.intersectObject(globe);
  if (!hits.length) return;
  const local = globe.worldToLocal(hits[0].point.clone());
  const { lat, lon } = vec3ToLatLon(local);
  setMarker(lat, lon);
  fetchAndShow(lat, lon);
}

let autoSpin = true;
let showGrid = true;
const spinBtn = document.getElementById("gcb-spin");
const spinIcon = spinBtn.querySelector("i");
const spinLbl = spinBtn.querySelector(".gcb-spin-label");

spinBtn.addEventListener("click", function () {
  autoSpin = !autoSpin;
  if (autoSpin) {
    spinIcon.className = "fa-solid fa-pause";
    spinLbl.textContent = "RUNNING";
    this.classList.add("active");
  } else {
    spinIcon.className = "fa-solid fa-play";
    spinLbl.textContent = "STOPPED";
    this.classList.remove("active");
  }
});
wrap.addEventListener("wheel", e => {
  e.preventDefault();
  camera.position.z = Math.min(4.5, Math.max(1.6, camera.position.z + e.deltaY * 0.002));
}, { passive: false });

let searchDebounce = null;
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  searchClear.style.display = q ? "inline-flex" : "none";
  clearTimeout(searchDebounce);
  if (q.length < 2) { searchDrop.classList.remove("open"); return; }
  searchDebounce = setTimeout(() => fetchSearchSuggestions(q), 380);
});
searchClear.addEventListener("click", () => {
  searchInput.value = ""; searchClear.style.display = "none";
  searchDrop.classList.remove("open"); searchDrop.innerHTML = "";
});
document.addEventListener("click", e => {
  if (!e.target.closest(".globe-search-wrap")) searchDrop.classList.remove("open");
});

async function fetchSearchSuggestions(q) {
  const params = new URLSearchParams({ q, format: "json", limit: 5, addressdetails: 1 });
  try {
    const res = await fetch(`${NOMINATIM}?${params}`, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    searchDrop.innerHTML = "";
    if (!data.length) { searchDrop.innerHTML = `<li class="gsd-empty">No results</li>`; searchDrop.classList.add("open"); return; }
    data.forEach(place => {
      const li = document.createElement("li");
      li.className = "gsd-item";
      const name = place.name || place.display_name.split(",")[0];
      li.innerHTML = `<i class="fa-solid fa-location-dot"></i><div><div class="gsd-name">${name}</div><div class="gsd-sub">${place.display_name}</div></div>`;
      li.addEventListener("click", () => {
        const lat = parseFloat(place.lat), lon = parseFloat(place.lon);
        searchInput.value = name; searchDrop.classList.remove("open");
        searchClear.style.display = "inline-flex";
        globe.rotation.y = THREE.MathUtils.degToRad(-90 - lon);
        globe.rotation.x = THREE.MathUtils.degToRad(lat * 0.5);
        setMarker(lat, lon);
        fetchAndShow(lat, lon);
      });
      searchDrop.appendChild(li);
    });
    searchDrop.classList.add("open");
  } catch { searchDrop.classList.remove("open"); }
}

window.addEventListener("resize", () => {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  if (autoSpin && !isDragging) {
    globe.rotation.y += 0.0015;
  }
  if (!isDragging && (Math.abs(rotVelX) > 0.0001 || Math.abs(rotVelY) > 0.0001)) {
    globe.rotation.x += rotVelX; globe.rotation.y += rotVelY;
    rotVelX *= 0.88; rotVelY *= 0.88;
  }
  atmMat.opacity = 0.07 + 0.025 * Math.sin(t * 0.6);
  if (currentLabel.element && currentLabel.element.style.display !== "none") {
    const pos = latLonToVec3(currentLabel.lat, currentLabel.lon, GLOBE_RADIUS);
    pos.applyMatrix4(globe.matrixWorld);
    const cameraToPoint = camera.position.clone().sub(pos);
    if (cameraToPoint.dot(pos) > 0) {
      currentLabel.element.style.opacity = 1;
      pos.project(camera);
      const x = (pos.x * 0.5 + 0.5) * wrap.clientWidth;
      const y = (pos.y * -0.5 + 0.5) * wrap.clientHeight;
      currentLabel.element.style.left = `${x}px`;
      currentLabel.element.style.top = `${y - 15}px`;
    } else {
      currentLabel.element.style.opacity = 0;
    }
  }

  renderer.render(scene, camera);
}

animate();
loadingEl.style.display = "none";
(function initVoiceSearch() {
    const voiceBtn  = document.getElementById("voice-btn");
    const searchInp = document.getElementById("globe-search-input");

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
        searchInp.placeholder = "Search global cities…";
        voiceBtn.style.animation = "none";
        const icon = document.getElementById("voice-icon");
        if (icon) icon.style.stroke = "#9898b8";
    };
})();
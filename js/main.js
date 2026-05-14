let apiKey = "1e3e8f230b6064d27976e41163a82b77";

navigator.geolocation.getCurrentPosition(async function (position) {
   
    try {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        var map = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=5&appid=${apiKey}`);
        var userdata = await map.json();
        let loc = userdata[0].name;
        await updateWeatherUI(loc, lat, lon);

    } catch (error) {
        console.error("An error occurred:", error);
    }
},
() => {
    alert("Please turn on your location and refresh the page");
});

async function updateWeatherUI(loc, lat, lon) {
    try {
        let url = `https://api.openweathermap.org/data/2.5/forecast?&units=metric&`;
        let respond = await fetch(url + `q=${loc}&` + `appid=${apiKey}`);
        let data = await respond.json();

        console.log(data);
        let cityMain = document.getElementById("city-name");
        let cityTemp = document.getElementById("metric");
        let weatherMain = document.querySelectorAll("#weather-main");
        let mainHumidity = document.getElementById("humidity");
        let mainFeel = document.getElementById("feels-like");
        let weatherImg = document.querySelector(".weather-icon");
        let weatherImgs = document.querySelector(".weather-icons");
        let tempMinWeather = document.getElementById("temp-min-today");
        let tempMaxWeather = document.getElementById("temp-max-today");

        cityMain.innerHTML = data.city.name;
        cityTemp.innerHTML = Math.floor(data.list[0].main.temp) + "°";
        weatherMain[0].innerHTML = data.list[0].weather[0].description;
        weatherMain[1].innerHTML = data.list[0].weather[0].description;
        mainHumidity.innerHTML = Math.floor(data.list[0].main.humidity);
        mainFeel.innerHTML = Math.floor(data.list[0].main.feels_like);
        tempMinWeather.innerHTML = Math.floor(data.list[0].main.temp_min) + "°";
        tempMaxWeather.innerHTML = Math.floor(data.list[0].main.temp_max) + "°";

        let weatherCondition = data.list[0].weather[0].main.toLowerCase();

        if (weatherCondition === "rain") {
            weatherImg.src = "img/rain.png";
            weatherImgs.src = "img/rain.png";
        } else if (weatherCondition === "clear" || weatherCondition === "clear sky") {
            weatherImg.src = "img/sun.png";
            weatherImgs.src = "img/sun.png";
        } else if (weatherCondition === "snow") {
            weatherImg.src = "img/snow.png";
            weatherImgs.src = "img/snow.png";
        } else if (weatherCondition === "clouds" || weatherCondition === "smoke") {
            weatherImg.src = "img/cloud.png";
            weatherImgs.src = "img/cloud.png";
        } else if (weatherCondition === "mist" || weatherCondition === "fog") {
            weatherImg.src = "img/mist.png";
            weatherImgs.src = "img/mist.png";
        } else if (weatherCondition === "haze") {
            weatherImg.src = "img/haze.png";
            weatherImgs.src = "img/haze.png";
        } else if (weatherCondition === "thunderstorm") {
            weatherImg.src = "img/thunderstorm.png";
            weatherImgs.src = "img/thunderstorm.png";
        }
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${data.city.name}&appid=${apiKey}&units=metric`;
        fetch(forecastUrl)
            .then(response => response.json())
            .then(forecastData => {
                console.log("5-Day Forecast for", forecastData.city.name);
                displayForecast(forecastData);
            })
            .catch(error => {
                console.error("Error fetching forecast:", error);
            });

        function displayForecast(forecastData) {
            const dailyForecasts = {};
            let forecast = document.getElementById('future-forecast-box');
            let forecastbox = "";

            forecastData.list.forEach(item => {
                const date = item.dt_txt.split(' ')[0];
                let dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                let day = new Date(date).getDay();

                if (!dailyForecasts[date]) {
                    dailyForecasts[date] = {
                        day_today: dayName[day],
                        temperature: Math.floor(item.main.temp) + "°",
                        description: item.weather[0].description,
                        weatherImg: item.weather[0].main.toLowerCase()
                    };
                }
            });

            for (const date in dailyForecasts) {
                let imgSrc = "";
                switch (dailyForecasts[date].weatherImg) {
                    case "rain":        imgSrc = "img/rain.png";        break;
                    case "clear":
                    case "clear sky":   imgSrc = "img/sun.png";         break;
                    case "snow":        imgSrc = "img/snow.png";        break;
                    case "clouds":
                    case "smoke":       imgSrc = "img/cloud.png";       break;
                    case "mist":
                    case "fog":         imgSrc = "img/mist.png";        break;
                    case "haze":        imgSrc = "img/haze.png";        break;
                    case "thunderstorm":imgSrc = "img/thunderstorm.png";break;
                    default:            imgSrc = "img/sun.png";
                }

                forecastbox += `
                <div class="weather-forecast-box">
                  <div class="day-weather"><span>${dailyForecasts[date].day_today}</span></div>
                  <div class="weather-icon-forecast"><img src="${imgSrc}" /></div>
                  <div class="temp-weather"><span>${dailyForecasts[date].temperature}</span></div>
                  <div class="weather-main-forecast">${dailyForecasts[date].description}</div>
                </div>`;
            }

            forecast.innerHTML = forecastbox;
        }
        fetchAQI(lat, lon);
        fetchUV(lat, lon);
    } catch (error) {
        console.error("Failed to update weather UI:", error);
    }
}

const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

if (searchForm && searchInput) {
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            try {
                const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=1&appid=${apiKey}`);
                const geoData = await geoRes.json();
                
                if (geoData && geoData.length > 0) {
                    const { lat, lon, name } = geoData[0];
                    await updateWeatherUI(name, lat, lon);
                    searchInput.value = '';
                } else {
                    alert("City not found. Please try another search.");
                }
            } catch (error) {
                console.error("Error searching city:", error);
                alert("Error searching city. Please try again.");
            }
        }
    });
}

async function fetchAQI(lat, lon) {
    try {
        const res = await fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`
        );
        const data = await res.json();
        if (!data.current) throw new Error("Open-Meteo: no AQ data");

        const c = data.current;

        const pm25 = c.pm2_5 ?? 0;
        const pm10 = c.pm10  ?? 0;
        const co   = c.carbon_monoxide ?? 0; // μg/m³
        const so2  = c.sulphur_dioxide ?? 0; // μg/m³
        const no2  = c.nitrogen_dioxide ?? 0; // μg/m³
        const o3   = c.ozone ?? 0; // μg/m³
        const aqiNum = c.us_aqi ?? 0;
        const f1 = (v) => parseFloat(v.toFixed(1));
        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        setEl("modal-pm25", f1(pm25));
        setEl("modal-pm10", f1(pm10));
        setEl("modal-co",   f1(co));   // µg/m³
        setEl("modal-so2",  f1(so2));  // µg/m³
        setEl("modal-no2",  f1(no2));  // µg/m³
        setEl("modal-o3",   f1(o3));   // µg/m³
        ["modal-co","modal-so2","modal-no2","modal-o3"].forEach(id => {
            const small = document.querySelector(`#${id}`)?.nextElementSibling;
            if (small && small.tagName === "SMALL") small.textContent = "µg/m³";
        });
        function setBorder(elId, val, t) {
            const card = document.getElementById(elId);
            if (!card) return;
            card.classList.remove("border-green","border-yellow","border-orange","border-red","border-maroon");
            if      (val <= t[0]) card.classList.add("border-green");
            else if (val <= t[1]) card.classList.add("border-yellow");
            else if (val <= t[2]) card.classList.add("border-orange");
            else if (val <= t[3]) card.classList.add("border-red");
            else                  card.classList.add("border-maroon");
        }
        setBorder("card-pm25", pm25,  [12,   35.4, 55.4, 150.4]);
        setBorder("card-pm10", pm10,  [54,   154,  254,  354  ]);
        setBorder("card-co",   co,    [4400, 9400, 12400,15400]);
        setBorder("card-so2",  so2,   [20,   80,   250,  350  ]);
        setBorder("card-no2",  no2,   [40,   70,   150,  200  ]);
        setBorder("card-o3",   o3,    [60,   100,  140,  180  ]);
        let label = "Unknown", pct = 0, barColor = "#34c759";
        if (aqiNum <= 50)  { label = "Good";                    barColor = "#34c759"; }
        else if (aqiNum <= 100) { label = "Moderate";           barColor = "#ffcc00"; }
        else if (aqiNum <= 150) { label = "Unhealthy (Sensitive)"; barColor = "#ff9500"; }
        else if (aqiNum <= 200) { label = "Unhealthy";          barColor = "#ff3b30"; }
        else if (aqiNum <= 300) { label = "Very Unhealthy";     barColor = "#8b0000"; }
        else                    { label = "Hazardous";          barColor = "#7e0023"; }
        pct = Math.min(Math.round((aqiNum / 300) * 100), 100);

        const subEl   = document.getElementById("aqi-sub");
        const barEl   = document.getElementById("aqi-bar");
        const badgeEl = document.getElementById("aqi-badge");
        if (subEl)   subEl.textContent    = `${label} · ${aqiNum} AQI`;
        if (barEl) { barEl.style.width    = `${pct}%`; barEl.style.background = barColor; }
        if (badgeEl) {
            badgeEl.textContent           = `${aqiNum}`;
            badgeEl.style.color           = barColor;
            badgeEl.style.background      = `${barColor}22`;
        }

        console.log(`AQI: ${aqiNum} (${label}) | PM2.5: ${f1(pm25)} µg/m³`);
    } catch (err) {
        console.error("AQI fetch failed:", err);
        const subEl = document.getElementById("aqi-sub");
        if (subEl) subEl.textContent = "Unavailable";
    }
}
async function fetchUV(lat, lon) {
    try {
        const res = await fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=uv_index`
        );
        const data = await res.json();
        const uvi = data.current && data.current.uv_index !== undefined
            ? data.current.uv_index
            : null;

        if (uvi === null) throw new Error("No UV index in response");

        const uvRound = Math.round(uvi);

        let uvLabel;
        if      (uvRound <= 2)  uvLabel = "Low";
        else if (uvRound <= 5)  uvLabel = "Moderate";
        else if (uvRound <= 7)  uvLabel = "High";
        else if (uvRound <= 10) uvLabel = "Very High";
        else                    uvLabel = "Extreme";
        const pct = Math.min(Math.round((uvRound / 11) * 100), 100);

        const subEl = document.getElementById("uv-sub");
        const barEl = document.getElementById("uv-bar");

        if (subEl) subEl.textContent = `${uvLabel} · ${uvRound}`;
        if (barEl) barEl.style.width = `${pct}%`;

        console.log("UV Index (Open-Meteo):", uvRound, uvLabel);
    } catch (err) {
        console.error("UV fetch failed:", err);
        const subEl = document.getElementById("uv-sub");
        if (subEl) subEl.textContent = "Unavailable";
    }
}
document.addEventListener("DOMContentLoaded", () => {
    const aqiCard = document.getElementById("aqi-card");
    const aqiModal = document.getElementById("aqi-modal");
    const aqiClose = document.getElementById("aqi-modal-close");

    if (aqiCard && aqiModal && aqiClose) {
        aqiCard.addEventListener("click", () => {
            aqiModal.classList.add("active");
        });
        aqiClose.addEventListener("click", () => {
            aqiModal.classList.remove("active");
        });
        aqiModal.addEventListener("click", (e) => {
            if (e.target === aqiModal) {
                aqiModal.classList.remove("active");
            }
        });
    }

});
(function initVoiceSearch() {
    const voiceBtn  = document.getElementById("voice-btn");
    const searchForm = document.getElementById("search-form");
    const searchInp = document.getElementById("search-input");

    if (!voiceBtn || !searchForm || !searchInp) return;

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
        try {
            rec.start();
        } catch (err) {
            console.warn("Voice start error:", err);
        }
    }

    voiceBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (listening) { rec.stop(); return; }
        startListening();
    });

    rec.onstart = () => {
        listening = true;
        voiceBtn.classList.add("listening");
        searchForm.classList.add("listening");
        searchInp.placeholder = "🎤 Listening…";
        showToast("🎤  Speak a city name…", "#ff3b30");
    };

    rec.onresult = (e) => {
        const city = e.results[0][0].transcript.trim();
        searchInp.value = city;
        showToast(`✅  Searching: ${city}`, "#34c759");
        setTimeout(() => {
            hideToast();
            if (typeof searchForm.requestSubmit === 'function') {
                searchForm.requestSubmit();
            } else {
                searchForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            }
        }, 800);
    };

    rec.onerror = (e) => {
        console.error("Voice error:", e.error);
        let msg = "Voice error — try again";
        if (e.error === "not-allowed")  msg = "❌  Mic blocked — allow access in browser settings";
        if (e.error === "no-speech")    msg = "🔇  No speech detected — try again";
        if (e.error === "network")      msg = "❌  Network error (Must use Live Server, not file://)";
        showToast(msg, "#ff9500");
        setTimeout(hideToast, 3000);
    };

    rec.onend = () => {
        listening = false;
        voiceBtn.classList.remove("listening");
        searchForm.classList.remove("listening");
        searchInp.placeholder = "Search city...";
    };
})();
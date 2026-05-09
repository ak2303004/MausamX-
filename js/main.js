let apiKey = "1e3e8f230b6064d27976e41163a82b77";

navigator.geolocation.getCurrentPosition(async function (position) {
   
    try {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;

        // Reverse-geocode lat/lon → city name
        var map = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=5&appid=${apiKey}`);
        var userdata = await map.json();
        let loc = userdata[0].name;

        // Fetch forecast data
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
        
        // Display current weather info
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

        // Fetch and display 6-day forecast
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

        // ── Real-time AQI & UV (use resolved lat/lon) ──────────────────
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
                // Geocode city to get lat/lon for AQI and UV
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

// ── US EPA AQI calculator from PM2.5 concentration ─────────────────────────
function calcUSAQI(pm25) {
    // PM2.5 breakpoints: [ConcLow, ConcHigh, AQILow, AQIHigh]
    const bp = [
        [0.0,   12.0,   0,   50],
        [12.1,  35.4,  51,  100],
        [35.5,  55.4, 101,  150],
        [55.5, 150.4, 151,  200],
        [150.5, 250.4, 201, 300],
        [250.5, 350.4, 301, 400],
        [350.5, 500.4, 401, 500],
    ];
    for (const [cLow, cHigh, aLow, aHigh] of bp) {
        if (pm25 >= cLow && pm25 <= cHigh) {
            return Math.round(((aHigh - aLow) / (cHigh - cLow)) * (pm25 - cLow) + aLow);
        }
    }
    return 500; // off-scale high
}

// ── AQI Helper ──────────────────────────────────────────────────────────────
// OpenWeatherMap Air Pollution API — free tier, no extra subscription
async function fetchAQI(lat, lon) {
    try {
        const res = await fetch(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
        );
        const data = await res.json();
        const pm25raw = data.list[0].components.pm2_5;   // raw µg/m³ float
        const pm25    = parseFloat(pm25raw.toFixed(1));  // one decimal

        // Compute real US EPA AQI from PM2.5
        const aqiNum = calcUSAQI(pm25);

        // Human-readable label from AQI number
        let label;
        if      (aqiNum <= 50)  label = "Good";
        else if (aqiNum <= 100) label = "Moderate";
        else if (aqiNum <= 150) label = "Unhealthy (Sensitive)";
        else if (aqiNum <= 200) label = "Unhealthy";
        else if (aqiNum <= 300) label = "Very Unhealthy";
        else                    label = "Hazardous";

        // Progress bar: scale 0–300 → 0–100% (anything ≥300 = 100%)
        const pct = Math.min(Math.round((aqiNum / 300) * 100), 100);

        const subEl   = document.getElementById("aqi-sub");
        const barEl   = document.getElementById("aqi-bar");
        const badgeEl = document.getElementById("aqi-badge");

        if (subEl)   subEl.textContent   = `${label} · ${aqiNum} AQI`;
        if (barEl)   barEl.style.width   = `${pct}%`;
        if (badgeEl) badgeEl.textContent = `${aqiNum}`;

        console.log("AQI (US EPA):", aqiNum, label, "PM2.5:", pm25);
    } catch (err) {
        console.error("AQI fetch failed:", err);
        const subEl = document.getElementById("aqi-sub");
        if (subEl) subEl.textContent = "Unavailable";
    }
}

// ── UV Index Helper ─────────────────────────────────────────────────────────
// Uses Open-Meteo API — free, no API key required, real-time uv_index
async function fetchUV(lat, lon) {
    try {
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index&timezone=auto&forecast_days=1`
        );
        const data = await res.json();
        const uvi = data.current && data.current.uv_index !== undefined
            ? data.current.uv_index
            : null;

        if (uvi === null) throw new Error("No UV index in Open-Meteo response");

        const uvRound = Math.round(uvi);

        let uvLabel;
        if      (uvRound <= 2)  uvLabel = "Low";
        else if (uvRound <= 5)  uvLabel = "Moderate";
        else if (uvRound <= 7)  uvLabel = "High";
        else if (uvRound <= 10) uvLabel = "Very High";
        else                    uvLabel = "Extreme";

        // Scale 0–11+ → 0–100%; cap at 100%
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
let apiKey = "1e3e8f230b6064d27976e41163a82b77";
let searchinput = document.querySelector(`.searchinput`);

async function search(query) {
    let url = `https://api.openweathermap.org/data/2.5/forecast?units=metric&q=${query}&appid=${apiKey}`;
    let respond = await fetch(url);
    
    if (respond.ok) {
        let data = await respond.json();
        console.log(data);
        
        let box = document.querySelector(".return");
        box.style.display = "flex";

        let message = document.querySelector(".message");
        if (message) message.style.display = "none";

        let errormessage = document.querySelector(".error-message");
        if (errormessage) errormessage.style.display = "none";

        // Display current weather info
        let cityMain       = document.getElementById("city-name");
        let cityTemp       = document.getElementById("metric");
        let weatherMain    = document.querySelectorAll("#weather-main");
        let mainHumidity   = document.getElementById("humidity");
        let mainFeel       = document.getElementById("feels-like");
        let weatherImg     = document.querySelector(".weather-icon");
        let weatherImgs    = document.querySelector(".weather-icons");
        let tempMinWeather = document.getElementById("temp-min-today");
        let tempMaxWeather = document.getElementById("temp-max-today");

        if (cityMain)       cityMain.innerHTML       = data.city.name;
        if (cityTemp)       cityTemp.innerHTML       = Math.floor(data.list[0].main.temp) + "°";
        if (weatherMain.length > 0) weatherMain[0].innerHTML = data.list[0].weather[0].description;
        if (weatherMain.length > 1) weatherMain[1].innerHTML = data.list[0].weather[0].description;
        if (mainHumidity)   mainHumidity.innerHTML   = Math.floor(data.list[0].main.humidity);
        if (mainFeel)       mainFeel.innerHTML       = Math.floor(data.list[0].main.feels_like);
        if (tempMinWeather) tempMinWeather.innerHTML = Math.floor(data.list[0].main.temp_min) + "°";
        if (tempMaxWeather) tempMaxWeather.innerHTML = Math.floor(data.list[0].main.temp_max) + "°";

        let weatherCondition = data.list[0].weather[0].main.toLowerCase();

        if (weatherCondition === "rain") {
            if (weatherImg)  weatherImg.src  = "img/rain.png";
            if (weatherImgs) weatherImgs.src = "img/rain.png";
        } else if (weatherCondition === "clear" || weatherCondition === "clear sky") {
            if (weatherImg)  weatherImg.src  = "img/sun.png";
            if (weatherImgs) weatherImgs.src = "img/sun.png";
        } else if (weatherCondition === "snow") {
            if (weatherImg)  weatherImg.src  = "img/snow.png";
            if (weatherImgs) weatherImgs.src = "img/snow.png";
        } else if (weatherCondition === "clouds" || weatherCondition === "smoke") {
            if (weatherImg)  weatherImg.src  = "img/cloud.png";
            if (weatherImgs) weatherImgs.src = "img/cloud.png";
        } else if (weatherCondition === "mist" || weatherCondition === "fog") {
            if (weatherImg)  weatherImg.src  = "img/mist.png";
            if (weatherImgs) weatherImgs.src = "img/mist.png";
        } else if (weatherCondition === "haze") {
            if (weatherImg)  weatherImg.src  = "img/haze.png";
            if (weatherImgs) weatherImgs.src = "img/haze.png";
        } else if (weatherCondition === "thunderstorm") {
            if (weatherImg)  weatherImg.src  = "img/thunderstorm.png";
            if (weatherImgs) weatherImgs.src = "img/thunderstorm.png";
        } else {
            if (weatherImg)  weatherImg.src  = "img/sun.png";
            if (weatherImgs) weatherImgs.src = "img/sun.png";
        }

        displayForecast(data);

        // ── Real-time AQI & UV using city coordinates from forecast response ──
        const cityLat = data.city.coord.lat;
        const cityLon = data.city.coord.lon;
        fetchAQI(cityLat, cityLon);
        fetchUV(cityLat, cityLon);

    } else {
        let box = document.querySelector(".return");
        if (box) box.style.display = "none";

        let message = document.querySelector(".message");
        if (message) message.style.display = "none";

        let errormessage = document.querySelector(".error-message");
        if (errormessage) errormessage.style.display = "block";
    }
}

function displayForecast(data) {
    const dailyForecasts = {};
    let forecast = document.getElementById('future-forecast-box');
    if (!forecast) return;
    
    let forecastbox = "";

    data.list.forEach(item => {
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
            case "rain":         imgSrc = "img/rain.png";        break;
            case "clear":
            case "clear sky":    imgSrc = "img/sun.png";         break;
            case "snow":         imgSrc = "img/snow.png";        break;
            case "clouds":
            case "smoke":        imgSrc = "img/cloud.png";       break;
            case "mist":
            case "fog":          imgSrc = "img/mist.png";        break;
            case "haze":         imgSrc = "img/haze.png";        break;
            case "thunderstorm": imgSrc = "img/thunderstorm.png";break;
            default:             imgSrc = "img/sun.png";
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

// ── US EPA AQI calculator from PM2.5 concentration ─────────────────────────
function calcUSAQI(pm25) {
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
    return 500;
}

// ── AQI Helper ──────────────────────────────────────────────────────────────
// OpenWeatherMap Air Pollution API — free tier, no extra subscription
async function fetchAQI(lat, lon) {
    try {
        const res = await fetch(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
        );
        const data = await res.json();
        const pm25raw = data.list[0].components.pm2_5;
        const pm25    = parseFloat(pm25raw.toFixed(1));

        const aqiNum = calcUSAQI(pm25);

        let label;
        if      (aqiNum <= 50)  label = "Good";
        else if (aqiNum <= 100) label = "Moderate";
        else if (aqiNum <= 150) label = "Unhealthy (Sensitive)";
        else if (aqiNum <= 200) label = "Unhealthy";
        else if (aqiNum <= 300) label = "Very Unhealthy";
        else                    label = "Hazardous";

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
// Open-Meteo API — completely free, no API key, real-time uv_index
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

searchinput.addEventListener('keydown', function(event) {
    if (event.keyCode === 13 || event.which === 13) {
        search(searchinput.value);
        console.log("worked");
    }
});
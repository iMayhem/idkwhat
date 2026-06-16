// CINEWAVE CLIENT ENGINE - MINIMALIST CODE FOR RAW HTML LAYOUT
const TMDB_KEY = "dfa4c2c7c1de1005adee824dc5593672";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

// State
let currentMedia = null;
let currentType = "movie";
let selectedServer = "direct";
let currentSeason = 1;
let currentEpisode = 1;
let activeStreams = [];
let hlsInstance = null;

// Initial Load
document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    loadCategories();
    setupSearch();
    setupPlayerControls();
    loadFavorites();
    setupModalEvents();
    
    // Handle URL Hash Routing
    handleRouting();
    window.addEventListener("hashchange", handleRouting);
});

// Modal Events
function setupModalEvents() {
    document.querySelectorAll(".close-modal-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.getElementById("movie-modal").classList.add("hidden");
        });
    });
}

// Section Show/Hide Helper
function showSection(key) {
    const navLinks = {
        home: document.getElementById("menu-home"),
        watch: document.getElementById("menu-watch"),
        favorites: document.getElementById("menu-favorites"),
        about: document.getElementById("menu-about")
    };
    
    const sections = {
        home: document.getElementById("sec-home"),
        watch: document.getElementById("sec-watch"),
        favorites: document.getElementById("sec-favorites"),
        about: document.getElementById("sec-about"),
        search: document.getElementById("sec-search")
    };

    // Update Active Link
    Object.values(navLinks).forEach(m => {
        if (m) m.classList.remove("active");
    });
    if (navLinks[key]) {
        navLinks[key].classList.add("active");
    }

    // Update Active Section
    Object.keys(sections).forEach(secKey => {
        if (secKey === key) {
            sections[secKey].classList.remove("hidden");
        } else {
            sections[secKey].classList.add("hidden");
        }
    });
}

// Navigation / Tabs (via Hashes)
function setupNavigation() {
    const navLinks = {
        home: document.getElementById("menu-home"),
        watch: document.getElementById("menu-watch"),
        favorites: document.getElementById("menu-favorites"),
        about: document.getElementById("menu-about")
    };
    
    if (navLinks.home) {
        navLinks.home.addEventListener("click", () => { window.location.hash = "#home"; });
    }
    if (navLinks.watch) {
        navLinks.watch.addEventListener("click", () => { 
            if (currentMedia) {
                window.location.hash = `#/${currentType}/${currentMedia.id}${currentType === 'tv' ? `/${currentSeason}/${currentEpisode}` : ''}`;
            } else {
                window.location.hash = "#watch"; 
            }
        });
    }
    if (navLinks.favorites) {
        navLinks.favorites.addEventListener("click", () => { window.location.hash = "#favorites"; });
    }
    if (navLinks.about) {
        navLinks.about.addEventListener("click", () => { window.location.hash = "#about"; });
    }
    
    // Logo button triggers Home
    const logoBtn = document.getElementById("logo-btn");
    if (logoBtn) {
        logoBtn.addEventListener("click", () => {
            window.location.hash = "#home";
        });
    }
}

// URL Hash Router
async function handleRouting() {
    const hash = window.location.hash;
    
    if (!hash || hash === "#" || hash === "#home") {
        stopVideoPlayback();
        showSection("home");
        return;
    }
    if (hash === "#favorites") {
        stopVideoPlayback();
        showSection("favorites");
        return;
    }
    if (hash === "#about") {
        stopVideoPlayback();
        showSection("about");
        return;
    }
    if (hash === "#watch") {
        showSection("watch");
        return;
    }
    if (hash.startsWith("#/search")) {
        stopVideoPlayback();
        showSection("search");
        const match = hash.match(/#\/search\?q=(.*)/);
        const query = match ? decodeURIComponent(match[1]) : "";
        if (query) {
            executeSearch(query);
        }
        return;
    }
    
    // Match #/movie/{id} or #/tv/{id}/{season}/{episode}
    const match = hash.match(/^#\/(movie|tv)\/(\d+)(?:\/(\d+)\/(\d+))?$/);
    if (match) {
        const type = match[1];
        const id = parseInt(match[2]);
        const season = match[3] ? parseInt(match[3]) : 1;
        const episode = match[4] ? parseInt(match[4]) : 1;
        await loadAndPlayMedia(id, type, season, episode);
    } else {
        stopVideoPlayback();
        showSection("home");
    }
}

// Load Details from TMDB & Start Stream Playback
async function loadAndPlayMedia(id, type, season = 1, episode = 1) {
    try {
        // Close modal if open
        const modal = document.getElementById("movie-modal");
        if (modal) modal.classList.add("hidden");
        
        showSection("watch");
        
        // Show immediate loading message in watch details sidebar
        const detailsArea = document.getElementById("player-media-details");
        if (detailsArea) {
            detailsArea.innerHTML = `<h3>Loading title details...</h3>`;
        }
        
        const response = await fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_KEY}`);
        if (!response.ok) throw new Error("Failed to load details");
        const data = await response.json();
        
        currentMedia = data;
        currentType = type;
        currentSeason = season;
        currentEpisode = episode;
        
        populatePlayerSidebar(currentMedia, currentType, currentSeason, currentEpisode);
        loadScrapedStream(currentMedia.id, currentType, currentSeason, currentEpisode);
    } catch (err) {
        console.error(err);
        const detailsArea = document.getElementById("player-media-details");
        if (detailsArea) {
            detailsArea.innerHTML = `<h3 style="color:red;">Error loading media details.</h3>`;
        }
    }
}

// Load Categories
async function loadCategories() {
    loadCategoryRow(`${BASE_URL}/trending/movie/day?api_key=${TMDB_KEY}`, "trending-carousel", "movie");
    loadCategoryRow(`${BASE_URL}/discover/movie?api_key=${TMDB_KEY}&with_genres=28`, "action-carousel", "movie");
    loadCategoryRow(`${BASE_URL}/discover/movie?api_key=${TMDB_KEY}&with_genres=35`, "comedy-carousel", "movie");
    loadCategoryRow(`${BASE_URL}/discover/movie?api_key=${TMDB_KEY}&with_genres=878`, "scifi-carousel", "movie");
    loadCategoryRow(`${BASE_URL}/tv/popular?api_key=${TMDB_KEY}`, "tv-carousel", "tv");
}

async function loadCategoryRow(url, elementId, type) {
    const carousel = document.getElementById(elementId);
    if (!carousel) return;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Fetch failed");
        const data = await response.json();
        carousel.innerHTML = "";
        
        data.results.forEach((item, idx) => {
            const card = createMovieCard(item, type);
            carousel.appendChild(card);
            
            // Populate featured title with first item of trending
            if (elementId === "trending-carousel" && idx === 0) {
                setHeroFeature(item, type);
            }
        });
    } catch (err) {
        console.error(`Error loading category ${elementId}:`, err);
        carousel.innerHTML = `<div class="status-msg" style="color: var(--error);">Failed to load titles.</div>`;
    }
}

// Hero Feature
function setHeroFeature(item, type) {
    const banner = document.getElementById("featured-movie");
    const poster = document.getElementById("featured-poster");
    const title = document.getElementById("featured-title");
    const meta = document.getElementById("featured-meta");
    const desc = document.getElementById("featured-desc");
    const playBtn = document.getElementById("hero-play-btn");
    
    if (!banner || !item) return;
    
    poster.src = item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : "";
    
    const itemTitle = item.title || item.name || "Featured Title";
    title.textContent = itemTitle;
    
    const releaseDate = item.release_date || item.first_air_date || "";
    const year = releaseDate ? releaseDate.substring(0, 4) : "N/A";
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "0.0";
    meta.textContent = `Released: ${year} | Rating: ⭐ ${rating} / 10 | Type: ${type.toUpperCase()}`;
    
    desc.textContent = item.overview || "No description available.";
    
    playBtn.onclick = () => {
        window.location.hash = `#/${type}/${item.id}`;
    };
}

// Create Card
function createMovieCard(item, type) {
    const card = document.createElement("div");
    card.className = "movie-card";
    
    const title = item.title || item.name || "Unknown Title";
    const releaseDate = item.release_date || item.first_air_date || "";
    const year = releaseDate ? releaseDate.substring(0, 4) : "N/A";
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "0.0";
    const posterSrc = item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : "https://via.placeholder.com/120x180/ffffff/000000?text=No+Poster";

    card.innerHTML = `
        <div class="movie-poster-container">
            <span class="card-rating-badge">⭐ ${rating}</span>
            <img class="movie-poster" src="${posterSrc}" alt="${title}" loading="lazy">
        </div>
        <div class="movie-title" title="${title}">${title}</div>
        <div class="movie-meta">${year} | ${type.toUpperCase()}</div>
    `;

    card.addEventListener("click", () => {
        openMediaDetails(item.id, type);
    });

    return card;
}

// Search
function setupSearch() {
    const searchInput = document.getElementById("header-search-input");
    
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            const query = searchInput.value.trim();
            if (!query) return;
            window.location.hash = `#/search?q=${encodeURIComponent(query)}`;
        }
    });
}

// Open Details Modal
async function openMediaDetails(id, type) {
    const modal = document.getElementById("movie-modal");
    const contentArea = document.getElementById("modal-content-area");
    
    contentArea.innerHTML = `<div class="loading-indicator">Fetching media details...</div>`;
    modal.classList.remove("hidden");

    try {
        const response = await fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_KEY}`);
        if (!response.ok) throw new Error("Fetch failed");
        
        const data = await response.json();
        currentMedia = data;
        currentType = type;

        const title = data.title || data.name || "Unknown Title";
        const overview = data.overview || "No description available.";
        const rating = data.vote_average ? data.vote_average.toFixed(1) : "0.0";
        const releaseDate = data.release_date || data.first_air_date || "";
        const year = releaseDate ? releaseDate.substring(0, 4) : "N/A";
        const posterSrc = data.poster_path ? `${IMAGE_BASE}${data.poster_path}` : "https://via.placeholder.com/120x180/ffffff/000000?text=No+Poster";
        const genres = data.genres ? data.genres.map(g => g.name).join(", ") : "N/A";

        let episodeSelectHTML = "";
        if (type === "tv") {
            episodeSelectHTML = `
                <div style="margin: 15px 0; border: 1px solid #ccc; padding: 10px; background: #fafafa;">
                    <strong>TV Show Episode Selector:</strong><br/>
                    Season: <input id="tv-season-input" type="number" value="1" min="1" max="${data.number_of_seasons || 10}" style="width: 50px; padding: 2px;">
                    Episode: <input id="tv-episode-input" type="number" value="1" min="1" max="100" style="width: 50px; padding: 2px;">
                </div>
            `;
        }

        document.getElementById("modal-title-bar").textContent = `Details: ${title}`;

        contentArea.innerHTML = `
            <div class="movie-details-modal">
                <img class="details-poster" src="${posterSrc}" alt="${title}">
                <div class="details-info">
                    <h2>${title} (${year})</h2>
                    <p>${overview}</p>
                    <div class="details-meta-list">
                        <div class="details-meta-item">⭐ Rating: ${rating} / 10</div>
                        <div class="details-meta-item">📂 Genres: ${genres}</div>
                        ${type === 'tv' ? `<div class="details-meta-item">📺 Seasons: ${data.number_of_seasons || 1} (${data.number_of_episodes || 0} episodes)</div>` : ''}
                    </div>
                    
                    ${episodeSelectHTML}

                    <div class="details-actions">
                        <button id="btn-modal-watch">Play Media</button>
                        <button id="btn-modal-fav">Favorite</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById("btn-modal-watch").addEventListener("click", () => {
            modal.classList.add("hidden");
            
            let s = 1;
            let e = 1;
            if (type === "tv") {
                s = parseInt(document.getElementById("tv-season-input").value) || 1;
                e = parseInt(document.getElementById("tv-episode-input").value) || 1;
            }

            window.location.hash = `#/${type}/${data.id}${type === 'tv' ? `/${s}/${e}` : ''}`;
        });

        const favBtn = document.getElementById("btn-modal-fav");
        const isFav = checkIfFavorite(id);
        favBtn.textContent = isFav ? "⭐ Remove Favorite" : "⭐ Add Favorite";
        favBtn.addEventListener("click", () => {
            toggleFavorite(data, type);
            const isNowFav = checkIfFavorite(id);
            favBtn.textContent = isNowFav ? "⭐ Remove Favorite" : "⭐ Add Favorite";
        });

    } catch (err) {
        contentArea.innerHTML = `<div class="status-msg" style="color: var(--error);">Error fetching details.</div>`;
    }
}

// Favorites local storage
function checkIfFavorite(id) {
    const favorites = JSON.parse(localStorage.getItem("favorites_list") || "[]");
    return favorites.some(item => item.id === id);
}

function toggleFavorite(item, type) {
    let favorites = JSON.parse(localStorage.getItem("favorites_list") || "[]");
    const isFav = favorites.some(f => f.id === item.id);

    if (isFav) {
        favorites = favorites.filter(f => f.id !== item.id);
    } else {
        favorites.push({
            id: item.id,
            title: item.title || item.name,
            poster_path: item.poster_path,
            release_date: item.release_date || item.first_air_date,
            vote_average: item.vote_average,
            type: type
        });
    }

    localStorage.setItem("favorites_list", JSON.stringify(favorites));
    loadFavorites();
}

function loadFavorites() {
    const grid = document.getElementById("favorites-grid");
    if (!grid) return;
    const favorites = JSON.parse(localStorage.getItem("favorites_list") || "[]");

    if (favorites.length === 0) {
        grid.innerHTML = `<div class="status-msg">Your favorites list is currently empty.</div>`;
        return;
    }

    grid.innerHTML = "";
    favorites.forEach(item => {
        const card = createMovieCard(item, item.type);
        grid.appendChild(card);
    });
}

// Episode navigation
function setupPlayerControls() {
    const playerTvGoBtn = document.getElementById("player-tv-go-btn");
    if (!playerTvGoBtn) return;

    playerTvGoBtn.addEventListener("click", () => {
        const s = parseInt(document.getElementById("player-season-input").value) || 1;
        const e = parseInt(document.getElementById("player-episode-input").value) || 1;
        window.location.hash = `#/${currentType}/${currentMedia.id}/${s}/${e}`;
    });
}

function initializePlayer() {
    if (!currentMedia) return;

    const watchLink = document.getElementById("menu-watch");
    if (watchLink) watchLink.click();

    populatePlayerSidebar(currentMedia, currentType, currentSeason, currentEpisode);
    loadScrapedStream(currentMedia.id, currentType, currentSeason, currentEpisode);
}

function populatePlayerSidebar(item, type, season, episode) {
    const detailsArea = document.getElementById("player-media-details");
    const actionsWrapper = document.getElementById("sidebar-actions-wrapper");
    const favBtn = document.getElementById("btn-sidebar-fav");
    
    if (!detailsArea) return;
    
    const title = item.title || item.name || "Unknown Title";
    const releaseDate = item.release_date || item.first_air_date || "";
    const year = releaseDate ? releaseDate.substring(0, 4) : "N/A";
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "0.0";
    const overview = item.overview || "No description available.";
    
    let tagsHTML = `
        <span class="meta-tag rating">Rating: ⭐ ${rating}</span> | 
        <span class="meta-tag">Year: ${year}</span> | 
        <span class="meta-tag">${type.toUpperCase()}</span>
    `;
    if (type === "tv") {
        tagsHTML += ` | <span class="meta-tag">S${season} E${episode}</span>`;
    }
    
    detailsArea.innerHTML = `
        <h3 style="margin-top:0; border:none; padding:0;">${title}</h3>
        <p style="font-size:12px; margin-bottom: 10px;">${tagsHTML}</p>
        <p style="font-size:13px; line-height:1.5; color:#444;">${overview}</p>
    `;
    
    if (actionsWrapper && favBtn) {
        actionsWrapper.style.display = "block";
        const isFav = checkIfFavorite(item.id);
        favBtn.textContent = isFav ? "⭐ Remove Favorite" : "⭐ Add Favorite";
        
        const newFavBtn = favBtn.cloneNode(true);
        favBtn.parentNode.replaceChild(newFavBtn, favBtn);
        
        newFavBtn.addEventListener("click", () => {
            toggleFavorite(item, type);
            const isNowFav = checkIfFavorite(item.id);
            newFavBtn.textContent = isNowFav ? "⭐ Remove Favorite" : "⭐ Add Favorite";
        });
    }
}

// Extract links from JSON
function extractLinks(data) {
    let links = [];
    if (!data) return links;
    if (Array.isArray(data)) {
        for (let item of data) {
            links = links.concat(extractLinks(item));
        }
    } else if (typeof data === 'object') {
        for (let key of ['url', 'file', 'src']) {
            let val = data[key];
            if (val && typeof val === 'string') {
                let isStream = val.toLowerCase().includes('m3u8') || 
                               val.toLowerCase().includes('.mp4') || 
                               val.toLowerCase().includes('stream') || 
                               val.toLowerCase().includes('/get') ||
                               ['hls', 'mp4', 'direct'].includes(data.type);
                if (isStream) {
                    links.push({
                        url: val,
                        label: data.quality || data.language || data.title || 'unknown',
                        headers: data.headers || {},
                        type: data.type || (val.toLowerCase().includes('m3u8') ? 'hls' : 'mp4')
                    });
                }
            }
        }
        for (let k in data) {
            if (data[k] && typeof data[k] === 'object') {
                links = links.concat(extractLinks(data[k]));
            }
        }
    } else if (typeof data === 'string') {
        let isStream = data.toLowerCase().includes('m3u8') || 
                       data.toLowerCase().includes('.mp4') || 
                       data.toLowerCase().includes('stream') || 
                       data.toLowerCase().includes('/get');
        if (isStream) {
            links.push({
                url: data,
                label: 'unknown',
                headers: {},
                type: data.toLowerCase().includes('m3u8') ? 'hls' : 'mp4'
            });
        }
    }
    return links;
}

// Load and Test Streams in Concurrency Batch of 4
async function loadScrapedStream(id, type, season, episode) {
    const screenArea = document.getElementById("player-screen-area");
    const serverCard = document.getElementById("server-card-wrapper");
    const serverGrid = document.getElementById("server-grid-container");
    const diagnostics = document.getElementById("player-diagnostics");
    
    if (window.activeHlsInstance) {
        try {
            window.activeHlsInstance.destroy();
        } catch (e) {}
        window.activeHlsInstance = null;
    }
    
    // Show premium Loading Spinner and message in the Player area
    screenArea.innerHTML = `
        <div class="loading-screen" style="text-align: center; color: #fff; font-family: Arial, sans-serif;">
            <div class="spinner" style="border: 4px solid rgba(255,255,255,0.1); width: 40px; height: 40px; border-radius: 50%; border-left-color: #0000ee; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
            <h3>Scraping Streaming Channels...</h3>
            <p style="font-size: 13px; color: #aaa;">Querying open indexers in parallel</p>
        </div>
    `;
    
    serverCard.style.display = "block";
    serverGrid.innerHTML = `<div class="loading-indicator">Resolving streams...</div>`;
    
    diagnostics.style.display = "block";
    diagnostics.innerHTML = `Querying parallel scraper pipeline for ID ${id} (${type.toUpperCase()} S${season}E${episode})...`;
    activeStreams = [];
    
    const tvNavigator = document.getElementById("sidebar-tv-navigator");
    if (type === "tv") {
        tvNavigator.style.display = "block";
        document.getElementById("player-season-input").value = season;
        document.getElementById("player-episode-input").value = episode;
    } else {
        tvNavigator.style.display = "none";
    }
    
    try {
        const response = await fetch(`/api/scrape?id=${id}&type=${type}&season=${season}&episode=${episode}`);
        const data = await response.json();
        
        if (data.error) {
            diagnostics.innerHTML += `\nError: ${data.error}`;
            screenArea.innerHTML = `<div class="status-msg" style="color:red;">Scraper Error: ${data.error}</div>`;
            serverCard.style.display = "none";
            return;
        }
        
        activeStreams = extractLinks(data);
        
        if (activeStreams.length === 0) {
            diagnostics.innerHTML += `\nNo active feeds returned.`;
            screenArea.innerHTML = `<div class="status-msg">No streaming feeds could be found.</div>`;
            serverCard.style.display = "none";
            return;
        }
        
        diagnostics.innerHTML += `\nSuccess: Resolved ${activeStreams.length} stream links. Testing latencies (concurrency limit: 4, timeout: 5s)...`;
        serverGrid.innerHTML = ""; // Clear loading indicators
        
        // Render initial server buttons
        activeStreams.forEach((stream, idx) => {
            const btn = document.createElement("div");
            btn.className = "server-item";
            btn.id = `server-item-${idx}`;
            
            let label = String(stream.label || "Auto Server");
            if (label.toLowerCase() === "unknown") {
                label = `Mirror Gateway ${idx + 1}`;
            }
            stream.displayName = label;
            
            btn.innerHTML = `
                <span class="server-name">Channel: ${label}</span>
                <span class="server-latency" id="server-latency-${idx}">Waiting...</span>
            `;
            serverGrid.appendChild(btn);
        });
        
        const testStreamLatency = async (stream, index) => {
            const latencyBadge = document.getElementById(`server-latency-${index}`);
            if (latencyBadge) latencyBadge.textContent = "Pinging...";
            
            const encodedUrl = encodeURIComponent(stream.url);
            const referer = stream.headers.Referer || stream.headers.referer || '';
            const origin = stream.headers.Origin || stream.headers.origin || '';
            const userAgent = stream.headers['User-Agent'] || stream.headers['user-agent'] || '';
            
            let proxiedUrl = `/api/proxy?url=${encodedUrl}`;
            if (referer) proxiedUrl += `&referer=${encodeURIComponent(referer)}`;
            if (origin) proxiedUrl += `&origin=${encodeURIComponent(origin)}`;
            if (userAgent) proxiedUrl += `&user_agent=${encodeURIComponent(userAgent)}`;
            
            try {
                const start = performance.now();
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout
                
                const resp = await fetch(proxiedUrl, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (resp.ok) {
                    const latency = Math.round(performance.now() - start);
                    stream.latency = latency;
                    
                    let latencyClass = "latency-good";
                    if (latency > 350 && latency < 800) latencyClass = "latency-fair";
                    else if (latency >= 800) latencyClass = "latency-poor";
                    
                    if (latencyBadge) latencyBadge.innerHTML = `<span class="${latencyClass}">${latency}ms</span>`;
                    diagnostics.innerHTML += `\n[${stream.displayName}] OK: ${latency}ms`;
                } else {
                    stream.latency = 99999;
                    if (latencyBadge) latencyBadge.innerHTML = `<span class="latency-poor">Offline</span>`;
                    diagnostics.innerHTML += `\n[${stream.displayName}] Failed: HTTP ${resp.status}`;
                }
            } catch (err) {
                stream.latency = 99999;
                if (latencyBadge) latencyBadge.innerHTML = `<span class="latency-poor">Timeout</span>`;
                diagnostics.innerHTML += `\n[${stream.displayName}] Failed: Timeout`;
            }
            diagnostics.scrollTop = diagnostics.scrollHeight;
        };
        
        // Execute the pings in a sliding worker pool of concurrency limit 4
        await pool(4, activeStreams, (stream, idx) => testStreamLatency(stream, idx));
        
        let fastestIndex = 0;
        let lowestLatency = 99999;
        activeStreams.forEach((stream, idx) => {
            if (stream.latency < lowestLatency) {
                lowestLatency = stream.latency;
                fastestIndex = idx;
            }
        });
        
        activeStreams.forEach((stream, idx) => {
            const btn = document.getElementById(`server-item-${idx}`);
            if (!btn) return;
            btn.onclick = () => {
                document.querySelectorAll(".server-item").forEach(el => el.classList.remove("active"));
                btn.classList.add("active");
                playScrapedFeed(idx);
            };
        });
        
        const fastestBtn = document.getElementById(`server-item-${fastestIndex}`);
        if (fastestBtn) fastestBtn.classList.add("active");
        
        if (lowestLatency === 99999) {
            diagnostics.innerHTML += `\nAll gateways offline. Connecting mirror 1...`;
            await new Promise(r => setTimeout(r, 800));
            playScrapedFeed(0);
        } else {
            diagnostics.innerHTML += `\nConnecting to Channel ${fastestIndex + 1} (${lowestLatency}ms)...`;
            await new Promise(r => setTimeout(r, 800));
            playScrapedFeed(fastestIndex);
        }
        
        setTimeout(() => {
            diagnostics.style.display = "none";
        }, 4000);
        
    } catch (err) {
        console.error(err);
        diagnostics.innerHTML += `\nAPI Error: ${err.message}`;
        screenArea.innerHTML = `<div class="status-msg" style="color:red;">Error: ${err.message}</div>`;
    }
}

function playScrapedFeed(index) {
    const stream = activeStreams[index];
    if (!stream) return;

    const encodedUrl = encodeURIComponent(stream.url);
    const referer = stream.headers.Referer || stream.headers.referer || '';
    const origin = stream.headers.Origin || stream.headers.origin || '';
    const userAgent = stream.headers['User-Agent'] || stream.headers['user-agent'] || '';
    
    let proxiedUrl = `/api/proxy?url=${encodedUrl}`;
    if (referer) proxiedUrl += `&referer=${encodeURIComponent(referer)}`;
    if (origin) proxiedUrl += `&origin=${encodeURIComponent(origin)}`;
    if (userAgent) proxiedUrl += `&user_agent=${encodeURIComponent(userAgent)}`;

    updatePlayerSource(proxiedUrl, stream.type);
}

function updatePlayerSource(streamUrl, streamType) {
    const screenArea = document.getElementById("player-screen-area");
    
    if (window.activeHlsInstance) {
        try {
            window.activeHlsInstance.destroy();
        } catch(e) {}
        window.activeHlsInstance = null;
    }

    screenArea.innerHTML = `<video id="custom-html5-player" controls autoplay style="width: 100%; height: 100%; background: #000; display: block;"></video>`;

    const video = document.getElementById("custom-html5-player");
    
    let hls = null;
    const isHls = (streamType === "hls") || streamUrl.toLowerCase().includes(".m3u8") || streamUrl.toLowerCase().includes("m3u8");
    if (isHls && typeof Hls !== "undefined" && Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            video.play().catch(e => console.log("Autoplay blocked."));
        });
    } else {
        video.src = streamUrl;
    }

    window.activeHlsInstance = hls;
}

// Concurrency pool helper for parallel checks (limit of 4)
async function pool(limit, array, fn) {
    const promises = [];
    const poolSet = new Set();
    for (let i = 0; i < array.length; i++) {
        const item = array[i];
        const p = Promise.resolve().then(() => fn(item, i));
        promises.push(p);
        poolSet.add(p);
        const clean = () => poolSet.delete(p);
        p.then(clean, clean);
        if (poolSet.size >= limit) {
            await Promise.race(poolSet);
        }
    }
    return Promise.all(promises);
}

// Stop Video Playback & Clean Stream Resources
function stopVideoPlayback() {
    if (window.activeHlsInstance) {
        try {
            window.activeHlsInstance.destroy();
        } catch(e) {}
        window.activeHlsInstance = null;
    }
    const video = document.getElementById("custom-html5-player");
    if (video) {
        try {
            video.pause();
            video.src = "";
            video.load();
        } catch(e) {}
    }
    const screenArea = document.getElementById("player-screen-area");
    if (screenArea) {
        screenArea.innerHTML = `
            <div class="no-media-screen" style="text-align: center; color: #777;">
                <h3>No Stream Loaded</h3>
                <p>Select any item from the lists to load stream links.</p>
            </div>
        `;
    }
    const serverCard = document.getElementById("server-card-wrapper");
    if (serverCard) {
        serverCard.style.display = "none";
    }
}

// Execute route-driven TMDB Search query
async function executeSearch(query) {
    const searchInput = document.getElementById("header-search-input");
    const resultsGrid = document.getElementById("search-results-grid");
    
    searchInput.value = query;
    document.getElementById("search-query-title").textContent = `Search Results for "${query}"`;
    resultsGrid.innerHTML = `<div class="loading-indicator">Searching database...</div>`;
    
    try {
        const [movieResp, tvResp] = await Promise.all([
            fetch(`${BASE_URL}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`),
            fetch(`${BASE_URL}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`)
        ]);
        
        if (!movieResp.ok || !tvResp.ok) throw new Error("Search failed");
        
        const movieData = await movieResp.json();
        const tvData = await tvResp.json();
        
        resultsGrid.innerHTML = "";
        
        const combined = [
            ...movieData.results.map(item => ({ ...item, mediaType: "movie" })),
            ...tvData.results.map(item => ({ ...item, mediaType: "tv" }))
        ];
        combined.sort((a, b) => b.popularity - a.popularity);
        
        if (combined.length === 0) {
            resultsGrid.innerHTML = `<div class="status-msg">No results found for "${query}".</div>`;
            return;
        }
        
        combined.forEach(item => {
            const card = createMovieCard(item, item.mediaType);
            resultsGrid.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        resultsGrid.innerHTML = `<div class="status-msg" style="color: var(--error);">Error executing query.</div>`;
    }
}

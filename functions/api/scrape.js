// /functions/api/scrape.js

const CUSTOM_ALPHABET = "RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=";
const TMDB_KEY = "dfa4c2c7c1de1005adee824dc5593672";
const BASE_URL = "https://api.themoviedb.org/3";

// Polyfill/Helper for fetch with timeout (highly compatible across all JS runtimes)
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

function customB64Decode(encodedStr) {
    const charToIdx = {};
    for (let i = 0; i < CUSTOM_ALPHABET.length; i++) {
        charToIdx[CUSTOM_ALPHABET[i]] = i;
    }
    encodedStr = encodedStr.replace(/=/g, '');
    const decoded = [];
    for (let i = 0; i < encodedStr.length; i += 4) {
        let chunk = encodedStr.slice(i, i + 4);
        while (chunk.length < 4) {
            chunk += '=';
        }
        const vals = [];
        for (let j = 0; j < 4; j++) {
            const char = chunk[j];
            vals.push(charToIdx[char] !== undefined ? charToIdx[char] : 64);
        }
        
        decoded.push((vals[0] << 2) | (vals[1] >> 4));
        if (vals[2] !== 64) {
            decoded.push(((vals[1] & 15) << 4) | (vals[2] >> 2));
        }
        if (vals[3] !== 64) {
            decoded.push(((vals[2] & 3) << 6) | vals[3]);
        }
    }
    
    const textDecoder = new TextDecoder('utf-8');
    const u8 = new Uint8Array(decoded);
    const text = textDecoder.decode(u8);
    try {
        if (text.trim().startsWith('{')) {
            return JSON.parse(text);
        }
    } catch (e) {}
    return text;
}

function base64UrlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) {
        s += '=';
    }
    const raw = atob(s);
    const u8 = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        u8[i] = raw.charCodeAt(i);
    }
    return u8;
}

async function decryptPayload(encStr, keyHex = "a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5d") {
    try {
        const parts = encStr.split('.');
        if (parts.length !== 3) return null;
        
        const iv = base64UrlDecode(parts[0]);
        const ciphertext = base64UrlDecode(parts[1]);
        const tag = base64UrlDecode(parts[2]);
        
        const combined = new Uint8Array(ciphertext.length + tag.length);
        combined.set(ciphertext);
        combined.set(tag, ciphertext.length);
        
        const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        
        const cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyBytes,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );
        
        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
                tagLength: 128
            },
            cryptoKey,
            combined
        );
        
        const textDecoder = new TextDecoder('utf-8');
        const decryptedText = textDecoder.decode(decryptedBuffer);
        return JSON.parse(decryptedText);
    } catch (e) {
        console.error("Decryption failed:", e);
        return null;
    }
}

async function tryPeachify(tmdbId, mediaType = "movie", season = 1, episode = 1) {
    const providers = [
        { label: "Iron", path: "moviebox", apis: ["https://uwu.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] },
        { label: "Spider", path: "holly", apis: ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] },
        { label: "Wolf", path: "air", apis: ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] },
        { label: "Multi", path: "multi", apis: ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] },
        { label: "Dark", path: "net", apis: ["https://uwu.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] },
        { label: "Some Sweet", path: "sweet", apis: ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] }
    ];
    
    const urls = [];
    providers.forEach(prov => {
        prov.apis.forEach(api => {
            const url = mediaType === "movie" 
                ? `${api}/${prov.path}/movie/${tmdbId}`
                : `${api}/${prov.path}/tv/${tmdbId}/${season}/${episode}`;
            urls.push({ url, label: prov.label });
        });
    });
    
    const results = [];
    const promises = urls.map(async ({ url, label }) => {
        try {
            const resp = await fetchWithTimeout(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Origin': 'https://peachify.top',
                    'Referer': 'https://peachify.top/'
                }
            }, 5000);
            if (!resp.ok) return;
            const text = await resp.text();
            let j;
            try {
                j = JSON.parse(text);
            } catch(e) {
                return;
            }
            let dec = null;
            if (j.isEncrypted && j.data) {
                dec = await decryptPayload(j.data);
            } else if (j.sources || j.streams || j.file || j.url) {
                dec = j;
            }
            if (dec && dec.sources && Array.isArray(dec.sources)) {
                dec.sources.forEach(src => {
                    src.title = `Peachify (${label})`;
                    results.push(src);
                });
            }
        } catch (e) {
            console.error(`Peachify failed for ${url}:`, e);
        }
    });
    
    await Promise.all(promises);
    return results.length ? { sources: results } : null;
}

async function tryMovish(tmdbId, mediaType = "movie", season = 1, episode = 1) {
    const url = mediaType === "movie"
        ? `https://movish.net/moviebox-embed/movie/${tmdbId}`
        : `https://movish.net/moviebox-embed/tv/${tmdbId}/${season}/${episode}`;
        
    try {
        const resp = await fetchWithTimeout(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                'Referer': 'https://movish.net/'
            }
        }, 5000);
        if (!resp.ok) return null;
        const html = await resp.text();
        const match = html.match(/const\s+STREAMS\s*=\s*(\[.*?\]);/);
        if (match) {
            const streams = JSON.parse(match[1]);
            const results = [];
            streams.forEach(s => {
                const sUrl = s.url;
                if (sUrl) {
                    results.push({
                        url: sUrl,
                        title: "Movish",
                        quality: s.label || "unknown",
                        type: s.type || "mp4",
                        headers: {
                            "Referer": "https://movish.net/",
                            "Origin": "https://movish.net"
                        }
                    });
                }
            });
            return results.length ? { sources: results } : null;
        }
    } catch(e) {
        console.error("Movish failed:", e);
    }
    return null;
}

async function tryVidNest(tmdbId, mediaType = "movie", season = 1, episode = 1) {
    const bases = ["https://new.vidnest.fun", "https://vidnest.fun"];
    let paths = [];
    if (mediaType === "movie") {
        paths = ["movies4f/movie", "catflix/movie", "videasy/movie", "moviesapi/movie", "allmovies/movie", "flixhq/movie", "vidlink/movie"];
    } else {
        paths = ["movies4f/tv", "catflix/tv", "videasy/tv", "moviesapi/tv", "allmovies/tv", "flixhq/tv", "vidlink/tv"];
    }
    
    const urls = [];
    bases.forEach(base => {
        paths.forEach(path => {
            const url = mediaType === "movie"
                ? `${base}/${path}/${tmdbId}`
                : `${base}/${path}/${tmdbId}/${season}/${episode}`;
            urls.push(url);
        });
    });
    
    const sources = [];
    const streams = [];
    
    const promises = urls.map(async (url) => {
        try {
            const resp = await fetchWithTimeout(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://vidnest.fun'
                }
            }, 5000);
            if (!resp.ok) return;
            const text = await resp.text();
            let j;
            try {
                j = JSON.parse(text);
            } catch(e) {
                return;
            }
            
            let dec = null;
            if (j.encrypted && j.data) {
                dec = customB64Decode(j.data);
            } else if (j.sources || j.streams || j.stream || j.data || j.file || j.url) {
                dec = j;
            }
            
            if (dec && typeof dec === 'object') {
                if (dec.sources && Array.isArray(dec.sources)) {
                    sources.push(...dec.sources);
                }
                if (dec.streams && Array.isArray(dec.streams)) {
                    streams.push(...dec.streams);
                }
                if (dec.url) {
                    sources.push(dec);
                }
            }
        } catch (e) {
            console.error("VidNest endpoint failed:", e);
        }
    });
    
    await Promise.all(promises);
    return (sources.length || streams.length) ? { sources, streams } : null;
}

async function tryVidSrcFamily(tmdbId, mediaType = "movie", season = 1, episode = 1) {
    const domains = [
        "vidsrc.to", 
        "vidsrc.me", 
        "vidsrc.pro", 
        "vidsrc.in", 
        "vidsrc.pm", 
        "vidsrc.net", 
        "vidsrc.cc",
        "vsembed.ru", 
        "vsembed.su"
    ];
    const urls = [];
    domains.forEach(d => {
        if (mediaType === "movie") {
            urls.push({ url: `https://${d}/embed/movie/${tmdbId}`, ref: `https://${d}` });
            urls.push({ url: `https://${d}/embed/${tmdbId}`, ref: `https://${d}` });
        } else {
            urls.push({ url: `https://${d}/embed/tv/${tmdbId}/${season}/${episode}`, ref: `https://${d}` });
            urls.push({ url: `https://${d}/embed/${tmdbId}/${season}/${episode}`, ref: `https://${d}` });
            if (d === "vidsrc.me") {
                urls.push({ url: `https://${d}/embed?tmdb=${tmdbId}&season=${season}&episode=${episode}`, ref: `https://${d}` });
            }
        }
    });
    
    const sources = [];
    const promises = urls.map(async ({ url, ref }) => {
        try {
            const resp = await fetchWithTimeout(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                    'Referer': ref
                }
            }, 5000);
            if (!resp.ok) return;
            const html = await resp.text();
            
            const matches = html.match(/https?:\/\/[^\s"\'<>\]]+\.m3u8[^\s"\'<>]*/g);
            if (matches) {
                const domain = new URL(url).hostname;
                matches.forEach(m => {
                    sources.push({ file: m, title: domain });
                });
            }
        } catch(e) {
            console.error("VidSrc Family failed:", e);
        }
    });
    
    await Promise.all(promises);
    return sources.length ? { sources } : null;
}

async function tryOtherProviders(tmdbId, mediaType = "movie", season = 1, episode = 1) {
    let others = [];
    if (mediaType === "movie") {
        others = [
            `https://vidsrc.pro/embed/movie/${tmdbId}`,
            `https://2embed.to/embed/tmdb/${tmdbId}`,
            `https://vidplay.site/embed/movie/${tmdbId}`,
            `https://vidplay.online/embed/movie/${tmdbId}`,
            `https://autoembed.to/movie/${tmdbId}`,
            `https://autoembed.co/movie/${tmdbId}`,
        ];
    } else {
        others = [
            `https://vidsrc.pro/embed/tv/${tmdbId}/${season}/${episode}`,
            `https://2embed.to/embed/series.php?db=${tmdbId}&s=${season}&e=${episode}`,
            `https://vidplay.site/embed/tv/${tmdbId}/${season}/${episode}`,
            `https://vidplay.online/embed/tv/${tmdbId}/${season}/${episode}`,
            `https://autoembed.to/tv/${tmdbId}/${season}/${episode}`,
            `https://autoembed.co/tv/${tmdbId}/${season}/${episode}`,
        ];
    }
    
    const sources = [];
    const promises = others.map(async (url) => {
        try {
            const resp = await fetchWithTimeout(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                    'Referer': 'https://vidnest.fun'
                }
            }, 5000);
            if (!resp.ok) return;
            const html = await resp.text();
            const matches = html.match(/https?:\/\/[^\s"\'<>]+\.m3u8[^\s"\'<>]*/g);
            if (matches) {
                const domain = new URL(url).hostname;
                matches.forEach(m => {
                    sources.push({ file: m, title: domain });
                });
            }
        } catch(e) {
            console.error("Other provider failed:", e);
        }
    });
    await Promise.all(promises);
    return sources.length ? { sources } : null;
}

function jsHash(s) {
    let t = 0;
    for (let n = 0; n < s.length; n++) {
        t = (t << 5) - t + s.charCodeAt(n);
        t &= t;
    }
    return Math.abs(t).toString(16).padStart(8, "0");
}

async function tryCinemaOS(tmdbId, mediaType = "movie", season = 1, episode = 1) {
    const secret = "dde0443a51aed264819df2c1292e678eacf0bbaff0ed279cce0b0f2094fcabe5";
    const r = Math.floor(Date.now() / 60000);
    const hashInput = `${tmdbId}:${r}:${secret}`;
    const a = jsHash(hashInput);
    const h = `${a}-${r.toString(36)}`;
    
    const urls = [];
    
    // cinemaosv2
    let paramsV2 = `tmdbId=${tmdbId}&type=${mediaType}&h=${h}&_gt=2549b22d9bf0d91847a2811baac98d0079e02dba592aea94`;
    if (mediaType === "tv") {
        paramsV2 += `&season=${season}&episode=${episode}`;
    }
    urls.push({
        url: `https://cinemaos.live/api/cinemaosv2?${paramsV2}`,
        type: 'cinemaosv2'
    });
    
    // multi-movies
    let paramsMulti = `tmdbId=${tmdbId}&type=${mediaType}&h=${h}`;
    if (mediaType === "tv") {
        paramsMulti += `&season=${season}&episode=${episode}`;
    }
    urls.push({
        url: `https://cinemaos.live/api/multi-movies?${paramsMulti}`,
        type: 'multi-movies'
    });
    
    const results = [];
    const promises = urls.map(async ({ url, type }) => {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const resp = await fetchWithTimeout(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                        'Referer': `https://cinemaos.live/${mediaType}/watch/${tmdbId}`
                    }
                }, 5000);
                if (!resp.ok) {
                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, 1000));
                        continue;
                    }
                    return;
                }
                const text = await resp.text();
                let j;
                try {
                    j = JSON.parse(text);
                } catch(e) {
                    return;
                }
                
                if (type === 'cinemaosv2' && j.streams && Array.isArray(j.streams)) {
                    j.streams.forEach(s => {
                        const sUrl = s.url || s.link;
                        if (sUrl) {
                            results.push({
                                url: sUrl,
                                title: `CinemaOS (${s.name || "V2"})`,
                                quality: s.quality || "unknown",
                                headers: s.headers || {}
                            });
                        }
                    });
                } else if (type === 'multi-movies' && j.results && Array.isArray(j.results)) {
                    j.results.forEach(s => {
                        const sUrl = s.link;
                        if (sUrl) {
                            const sourceName = s.source || "MultiMovies";
                            const quality = s.quality || "HD";
                            results.push({
                                url: sUrl,
                                title: `CinemaOS (${sourceName})`,
                                quality: quality,
                                headers: {}
                            });
                        }
                    });
                }
                break;
            } catch (e) {
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                console.error(`CinemaOS endpoint ${type} failed:`, e);
            }
        }
    });
    
    await Promise.all(promises);
    return results.length ? { sources: results } : null;
}

function extractLinks(data) {
    let links = [];
    if (typeof data === 'object' && data !== null) {
        if (Array.isArray(data)) {
            for (let item of data) {
                links = links.concat(extractLinks(item));
            }
        } else {
            for (let key of ['url', 'file', 'src']) {
                let val = data[key];
                if (val && typeof val === 'string') {
                    let isStream = val.toLowerCase().includes('m3u8') || 
                                   val.toLowerCase().includes('.mp4') || 
                                   val.toLowerCase().includes('stream') || 
                                   val.toLowerCase().includes('/get') ||
                                   ['hls', 'mp4', 'direct'].includes(data.type);
                    if (isStream) {
                        let quality = data.quality;
                        let title = data.title;
                        let dub = data.dub;
                        let label = "";
                        if (title) label += String(title);
                        if (dub) label += ` (${dub})`;
                        if (quality) {
                            let qStr = String(quality);
                            if (!qStr.toLowerCase().endsWith('p')) qStr += 'p';
                            label += label ? ` [${qStr}]` : qStr;
                        }
                        if (!label) label = data.language || 'unknown';
                        
                        links.push({
                            url: val,
                            label: label,
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

async function scrapeMedia(tmdbId, mediaType = "movie", season = 1, episode = 1) {
    const allResults = [];
    const providers = [
        tryPeachify,
        tryMovish,
        tryVidNest,
        tryVidSrcFamily,
        tryOtherProviders,
        tryCinemaOS
    ];
    
    const promises = providers.map(async (provider) => {
        try {
            const res = await provider(tmdbId, mediaType, season, episode);
            if (res) allResults.push(res);
        } catch(e) {
            console.error("Provider failed:", e);
        }
    });
    
    await Promise.all(promises);
    
    if (allResults.length) {
        const merged = { sources: [], streams: [] };
        allResults.forEach(res => {
            if (res && typeof res === 'object') {
                if (res.sources && Array.isArray(res.sources)) {
                    merged.sources.push(...res.sources);
                }
                if (res.streams && Array.isArray(res.streams)) {
                    merged.streams.push(...res.streams);
                }
                if (res.url) {
                    merged.sources.push(res);
                }
            }
        });
        
        const seenUrls = new Set();
        const dedupedSources = [];
        merged.sources.forEach(src => {
            const url = src.url || src.file;
            if (url && !seenUrls.has(url)) {
                seenUrls.add(url);
                dedupedSources.push(src);
            }
        });
        merged.sources = dedupedSources;
        
        const dedupedStreams = [];
        merged.streams.forEach(stream => {
            const url = stream.url || stream.file;
            if (url && !seenUrls.has(url)) {
                seenUrls.add(url);
                dedupedStreams.push(stream);
            }
        });
        merged.streams = dedupedStreams;
        
        return merged;
    }
    return null;
}

export async function onRequest(context) {
    // Handle CORS preflight
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400"
            }
        });
    }

    const { searchParams } = new URL(context.request.url);
    const tmdbIdStr = searchParams.get('id') || '0';
    const mediaType = searchParams.get('type') || 'movie';
    const seasonStr = searchParams.get('season') || '1';
    const episodeStr = searchParams.get('episode') || '1';
    
    const tmdbId = parseInt(tmdbIdStr);
    const season = parseInt(seasonStr);
    const episode = parseInt(episodeStr);
    
    if (!tmdbId) {
        return new Response(JSON.stringify({ error: "Missing or invalid TMDB ID" }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            status: 400
        });
    }
    
    try {
        const data = await scrapeMedia(tmdbId, mediaType, season, episode);
        if (data) {
            return new Response(JSON.stringify(data), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        } else {
            return new Response(JSON.stringify({ error: "No stream sources found" }), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                status: 404
            });
        }
    } catch(e) {
        return new Response(JSON.stringify({ error: `Internal scraper error: ${e.message}` }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            status: 500
        });
    }
}

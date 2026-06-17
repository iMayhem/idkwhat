import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";
import { Readable } from "stream";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API initialized successfully.");
  } else {
    console.warn("GEMINI_API_KEY environment variable not found.");
  }
} catch (e) {
  console.error("Failed to initialize Gemini:", e);
}

// API Route for AI Recommendations
app.post("/api/ai/recommend", async (req, res) => {
  const { mood, genre, query } = req.body;
  if (!ai) {
    return res.status(503).json({ error: "Gemini AI is not initialized. Please verify your secrets panel configuration." });
  }

  try {
    const prompt = `You are the Aura-Flix 3D Smart AI Movie Profiler. Return a list of 5 movies that match the user request.
Mood context: ${mood || 'Any'}
Desired genre context: ${genre || 'Any'}
User prompt: "${query || 'Suggest top highly atmospheric immersive movies'}"

Format your response as a valid JSON array of objects. Do not wrap it in markdown block tags (like \`\`\`json). Return raw JSON array only. Each object must have these exact fields:
1. title - The exact movie title (e.g. "Interstellar")
2. reason - A short, high-fidelity explanation (1-2 sentences) of why it fits their "Aura" and mood.
3. auraColor - A hexadecimal color code representing the "Aura energy" profile of this movie (e.g. "#FF4D57" for intense crimson, "#A855F7" for psychedelic space violet, "#3B82F6" for cyberpunk cobalt blue, "#10B981" for emerald matrix, etc.)
4. visualVibe - A short 3-word visual motif (e.g. "Neon Space Void").`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const text = response.text || "[]";
    let recommendations = [];
    try {
      recommendations = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON, trying regex fallback...", text);
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        recommendations = JSON.parse(match[0]);
      } else {
        throw new Error("Unable to parse recommendations JSON from: " + text);
      }
    }

    res.json({ recommendations });
  } catch (error: any) {
    console.error("AI Recommendation failed:", error);
    res.status(500).json({ error: error.message || "Failed to generate recommendation" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date() });
});

// --- Scraper Implementation ---
const CUSTOM_ALPHABET = "RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=";
const TMDB_KEY = "dfa4c2c7c1de1005adee824dc5593672";
const BASE_URL = "https://api.themoviedb.org/3";

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 5000): Promise<Response> {
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

function customB64Decode(encodedStr: string): any {
  const charToIdx: Record<string, number> = {};
  for (let i = 0; i < CUSTOM_ALPHABET.length; i++) {
    charToIdx[CUSTOM_ALPHABET[i]] = i;
  }
  encodedStr = encodedStr.replace(/=/g, '');
  const decoded: number[] = [];
  for (let i = 0; i < encodedStr.length; i += 4) {
    let chunk = encodedStr.slice(i, i + 4);
    while (chunk.length < 4) {
      chunk += '=';
    }
    const vals: number[] = [];
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

function base64UrlDecode(s: string): Uint8Array {
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

async function decryptPayload(encStr: string, keyHex = "a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5d"): Promise<any> {
  try {
    const parts = encStr.split('.');
    if (parts.length !== 3) return null;
    
    const iv = base64UrlDecode(parts[0]);
    const ciphertext = base64UrlDecode(parts[1]);
    const tag = base64UrlDecode(parts[2]);
    
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext);
    combined.set(tag, ciphertext.length);
    
    const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const subtle = crypto.webcrypto ? crypto.webcrypto.subtle : (globalThis.crypto ? globalThis.crypto.subtle : null);
    if (!subtle) throw new Error("Web Crypto Subtle not available");

    const cryptoKey = await subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    
    const decryptedBuffer = await subtle.decrypt(
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

async function tryPeachify(tmdbId: number, mediaType = "movie", season = 1, episode = 1): Promise<any> {
  const providers = [
    { label: "Iron", path: "moviebox", apis: ["https://uwu.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] },
    { label: "Spider", path: "holly", apis: ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] },
    { label: "Wolf", path: "air", apis: ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] },
    { label: "Multi", path: "multi", apis: ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] },
    { label: "Dark", path: "net", apis: ["https://uwu.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] },
    { label: "Rasmalai", path: "rasmalai", apis: ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"] }
  ];
  
  const urls: { url: string; label: string }[] = [];
  providers.forEach(prov => {
    prov.apis.forEach(api => {
      const url = mediaType === "movie" 
        ? `${api}/${prov.path}/movie/${tmdbId}`
        : `${api}/${prov.path}/tv/${tmdbId}/${season}/${episode}`;
      urls.push({ url, label: prov.label });
    });
  });
  
  const results: any[] = [];
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
        dec.sources.forEach((src: any) => {
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

async function tryMovish(tmdbId: number, mediaType = "movie", season = 1, episode = 1): Promise<any> {
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
      const results: any[] = [];
      streams.forEach((s: any) => {
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

async function tryVidNest(tmdbId: number, mediaType = "movie", season = 1, episode = 1): Promise<any> {
  const bases = ["https://new.vidnest.fun", "https://vidnest.fun"];
  let paths: string[] = [];
  if (mediaType === "movie") {
    paths = ["movies4f/movie", "catflix/movie", "videasy/movie", "moviesapi/movie", "allmovies/movie", "flixhq/movie", "vidlink/movie"];
  } else {
    paths = ["movies4f/tv", "catflix/tv", "videasy/tv", "moviesapi/tv", "allmovies/tv", "flixhq/tv", "vidlink/tv"];
  }
  
  const urls: string[] = [];
  bases.forEach(base => {
    paths.forEach(path => {
      const url = mediaType === "movie"
        ? `${base}/${path}/${tmdbId}`
        : `${base}/${path}/${tmdbId}/${season}/${episode}`;
      urls.push(url);
    });
  });
  
  const sources: any[] = [];
  const streams: any[] = [];
  
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

async function tryVidSrcFamily(tmdbId: number, mediaType = "movie", season = 1, episode = 1): Promise<any> {
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
  const urls: { url: string; ref: string }[] = [];
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
  
  const sources: any[] = [];
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

async function tryOtherProviders(tmdbId: number, mediaType = "movie", season = 1, episode = 1): Promise<any> {
  let others: string[] = [];
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
  
  const sources: any[] = [];
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

function jsHash(s: string): string {
  let t = 0;
  for (let n = 0; n < s.length; n++) {
    t = (t << 5) - t + s.charCodeAt(n);
    t &= t;
  }
  return Math.abs(t).toString(16).padStart(8, "0");
}

async function tryCinemaOS(tmdbId: number, mediaType = "movie", season = 1, episode = 1): Promise<any> {
  const secret = "dde0443a51aed264819df2c1292e678eacf0bbaff0ed279cce0b0f2094fcabe5";
  const r = Math.floor(Date.now() / 60000);
  const hashInput = `${tmdbId}:${r}:${secret}`;
  const a = jsHash(hashInput);
  const h = `${a}-${r.toString(36)}`;
  
  const urls: { url: string; type: string }[] = [];
  
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
  
  const results: any[] = [];
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
          j.streams.forEach((s: any) => {
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
          j.results.forEach((s: any) => {
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

async function scrapeMedia(tmdbId: number, mediaType = "movie", season = 1, episode = 1): Promise<any> {
  const allResults: any[] = [];
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
    const merged: { sources: any[]; streams: any[] } = { sources: [], streams: [] };
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
    
    const seenUrls = new Set<string>();
    const dedupedSources: any[] = [];
    merged.sources.forEach(src => {
      const url = src.url || src.file;
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        dedupedSources.push(src);
      }
    });
    merged.sources = dedupedSources;
    
    const dedupedStreams: any[] = [];
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

function urlJoin(base: string, relative: string): string {
  try {
    return new URL(relative, base).toString();
  } catch (e) {
    return relative;
  }
}

function rewriteM3U8(content: string, baseUrl: string, referer?: string, origin?: string, userAgent?: string): string {
  const lines = content.split('\n');
  const rewrittenLines: string[] = [];
  
  const encodedRef = referer ? encodeURIComponent(referer) : '';
  const encodedOrig = origin ? encodeURIComponent(origin) : '';
  const encodedUa = userAgent ? encodeURIComponent(userAgent) : '';
  
  let suffix = "";
  if (encodedRef) suffix += `&referer=${encodedRef}`;
  if (encodedOrig) suffix += `&origin=${encodedOrig}`;
  if (encodedUa) suffix += `&user_agent=${encodedUa}`;
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    if (line.startsWith('#')) {
      if (line.includes('URI="')) {
        const parts = line.split('URI="');
        if (parts.length > 1) {
          const uri = parts[1].split('"')[0];
          const fullUri = urlJoin(baseUrl, uri);
          const encodedUri = encodeURIComponent(fullUri);
          const proxiedUri = `/api/proxy?url=${encodedUri}${suffix}`;
          line = line.replace(`URI="${uri}"`, `URI="${proxiedUri}"`);
        }
      }
      rewrittenLines.push(line);
    } else {
      const fullUri = urlJoin(baseUrl, line);
      const encodedUri = encodeURIComponent(fullUri);
      const proxiedUri = `/api/proxy?url=${encodedUri}${suffix}`;
      rewrittenLines.push(proxiedUri);
    }
  }
  return rewrittenLines.join('\n');
}

// Integrated native Scraper API Route
app.get("/api/scrape", async (req, res) => {
  const tmdbIdStr = (req.query.id as string) || '0';
  const mediaType = (req.query.type as string) || 'movie';
  const seasonStr = (req.query.season as string) || '1';
  const episodeStr = (req.query.episode as string) || '1';
  
  const tmdbId = parseInt(tmdbIdStr);
  const season = parseInt(seasonStr);
  const episode = parseInt(episodeStr);
  
  if (!tmdbId) {
    return res.status(400).json({ error: "Missing or invalid TMDB ID" });
  }
  
  try {
    console.log(`[API] Natively Scraping ID=${tmdbId}, Type=${mediaType}, S${season}E${episode}`);
    const data = await scrapeMedia(tmdbId, mediaType, season, episode);
    
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (data) {
      res.json(data);
    } else {
      res.status(404).json({ error: "No stream sources found" });
    }
  } catch (err: any) {
    console.error("Integrated Scraper failed:", err);
    res.status(500).json({ error: `Internal scraper error: ${err.message}` });
  }
});

// Integrated native Proxy API Route
app.get("/api/proxy", async (req, res) => {
  const targetUrl = (req.query.url as string) || '';
  const referer = req.query.referer as string;
  const origin = req.query.origin as string;
  const userAgent = req.query.user_agent as string;
  
  if (!targetUrl) {
    return res.status(400).send("Missing target URL");
  }
  
  const headers = new Headers();
  const isPeachifyGateway = targetUrl.includes('eat-peach.sbs') || targetUrl.includes('workers.dev');
  
  if (isPeachifyGateway) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');
    headers.set('Referer', 'https://peachify.top/');
    headers.set('Origin', 'https://peachify.top');
  } else {
    headers.set('User-Agent', userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');
    if (referer) headers.set('Referer', referer);
    if (origin) headers.set('Origin', origin);
  }
  
  if (req.headers.range) {
    headers.set('Range', req.headers.range as string);
  }
  
  try {
    const response = await fetch(targetUrl, {
      headers,
      redirect: 'follow'
    });
    
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const isPlaylist = contentType.toLowerCase().includes('mpegurl') || 
                       contentType.toLowerCase().includes('x-mpegurl') || 
                       targetUrl.includes('.m3u8');
                       
    res.status(response.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Forward useful headers from remote target response
    for (let hName of ['Content-Range', 'Accept-Ranges', 'ETag', 'Cache-Control']) {
      const hVal = response.headers.get(hName);
      if (hVal) res.setHeader(hName, hVal);
    }
    
    if (isPlaylist) {
      const text = await response.text();
      let rewritten = text;
      try {
        rewritten = rewriteM3U8(text, targetUrl, referer, origin, userAgent);
      } catch(e) {
        console.error("Failed to rewrite m3u8:", e);
      }
      res.setHeader('Content-Type', 'application/x-mpegURL');
      res.send(rewritten);
    } else {
      res.setHeader('Content-Type', contentType);
      const len = response.headers.get('Content-Length');
      if (len) res.setHeader('Content-Length', len);
      
      if (response.body) {
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.end();
      }
    }
  } catch(e: any) {
    console.error("Integrated Proxy connection failed:", e);
    res.status(500).send(`Proxy connection failed: ${e.message}`);
  }
});

// Setup Vite Development / Static Production Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite dev middleware attached in server.ts");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Static files configured for production serving in server.ts");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

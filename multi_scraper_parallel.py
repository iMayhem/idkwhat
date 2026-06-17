import urllib.request
import urllib.error
import urllib.parse
import json
import re
import sys
import time
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

CUSTOM_ALPHABET = "RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/="

def custom_b64_decode(encoded_str):
    char_to_idx = {char: idx for idx, char in enumerate(CUSTOM_ALPHABET)}
    encoded_str = encoded_str.replace('=', '')
    decoded = bytearray()
    for i in range(0, len(encoded_str), 4):
        chunk = encoded_str[i:i+4].ljust(4, '=')
        vals = [char_to_idx.get(c, 64) for c in chunk]
        decoded.append((vals[0] << 2) | (vals[1] >> 4))
        if vals[2] != 64:
            decoded.append(((vals[1] & 15) << 4) | (vals[2] >> 2))
        if vals[3] != 64:
            decoded.append(((vals[2] & 3) << 6) | vals[3])
    try:
        text = decoded.decode('utf-8')
        return json.loads(text) if text.strip().startswith('{') else text
    except:
        return text

def fetch_with_headers(url, referer=None, origin=None):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    if referer:
        headers['Referer'] = referer
    if origin:
        headers['Origin'] = origin
    
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return url, resp.read().decode('utf-8'), dict(resp.getheaders())
    except Exception as e:
        return url, None, None

def process_vidnest(url, data):
    if not data: return None
    try:
        j = json.loads(data)
        if j.get('encrypted') and j.get('data'):
            dec = custom_b64_decode(j['data'])
            if isinstance(dec, dict):
                print(f"  ✅ [VidNest Decrypted] {url}")
                return dec
        if any(k in j for k in ['sources', 'streams', 'stream', 'data', 'file', 'url']):
            print(f"  ✅ [VidNest Raw] {url}")
            return j
    except:
        pass
    return None

def try_vidnest(tmdb_id, media_type="movie", season=1, episode=1):
    bases = ["https://new.vidnest.fun", "https://vidnest.fun"]
    if media_type == "movie":
        paths = ["movies4f/movie", "catflix/movie", "videasy/movie", "moviesapi/movie", "allmovies/movie", "flixhq/movie", "vidlink/movie"]
        urls = [f"{base}/{path}/{tmdb_id}" for base in bases for path in paths]
    else:
        paths = ["movies4f/tv", "catflix/tv", "videasy/tv", "moviesapi/tv", "allmovies/tv", "flixhq/tv", "vidlink/tv"]
        urls = [f"{base}/{path}/{tmdb_id}/{season}/{episode}" for base in bases for path in paths]
    
    print(f"[VidNest] Testing {len(urls)} endpoints in parallel...")
    merged_results = {"sources": [], "streams": []}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(fetch_with_headers, u, referer="https://vidnest.fun"): u for u in urls}
        for fut in as_completed(futures):
            u, data, _ = fut.result()
            res = process_vidnest(u, data)
            if res and isinstance(res, dict):
                if "sources" in res and isinstance(res["sources"], list):
                    merged_results["sources"].extend(res["sources"])
                if "streams" in res and isinstance(res["streams"], list):
                    merged_results["streams"].extend(res["streams"])
                if "url" in res:
                    merged_results["sources"].append(res)
    return merged_results if (merged_results["sources"] or merged_results["streams"]) else None

def try_vidsrc_family(tmdb_id, media_type="movie", season=1, episode=1):
    domains = [
        "vidsrc.to", 
        "vidsrc.me", 
        "vidsrc.pro", 
        "vidsrc.in", 
        "vidsrc.pm", 
        "vidsrc.net", 
        "vidsrc.cc",
        "vsembed.ru", 
        "vsembed.su"
    ]
    urls = []
    for d in domains:
        if media_type == "movie":
            urls.append((f"https://{d}/embed/movie/{tmdb_id}", f"https://{d}"))
            urls.append((f"https://{d}/embed/{tmdb_id}", f"https://{d}"))
        else:
            urls.append((f"https://{d}/embed/tv/{tmdb_id}/{season}/{episode}", f"https://{d}"))
            urls.append((f"https://{d}/embed/{tmdb_id}/{season}/{episode}", f"https://{d}"))
            if d == "vidsrc.me":
                urls.append((f"https://{d}/embed?tmdb={tmdb_id}&season={season}&episode={episode}", f"https://{d}"))
                
    print(f"[VidSrc Family] Testing {len(urls)} endpoints...")
    merged_results = {"sources": []}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(fetch_with_headers, url, referer=ref): url for url, ref in urls}
        for fut in as_completed(futures):
            url, html, headers = fut.result()
            if not html: continue
            # Extract m3u8
            m3u8s = re.findall(r'https?://[^\s"\'<>\]]+\.m3u8[^\s"\'<>]*', html)
            if m3u8s:
                print(f"  ✅ [VidSrc] Found on {url}")
                domain = urllib.parse.urlparse(url).netloc
                for m in m3u8s:
                    merged_results["sources"].append({"file": m, "title": domain})
    return merged_results if merged_results["sources"] else None

def try_other_providers(tmdb_id, media_type="movie", season=1, episode=1):
    others = []
    if media_type == "movie":
        others = [
            f"https://vidsrc.pro/embed/movie/{tmdb_id}",
            f"https://2embed.to/embed/tmdb/{tmdb_id}",
            f"https://vidplay.site/embed/movie/{tmdb_id}",
            f"https://vidplay.online/embed/movie/{tmdb_id}",
            f"https://autoembed.to/movie/{tmdb_id}",
            f"https://autoembed.co/movie/{tmdb_id}",
        ]
    else:
        others = [
            f"https://vidsrc.pro/embed/tv/{tmdb_id}/{season}/{episode}",
            f"https://2embed.to/embed/series.php?db={tmdb_id}&s={season}&e={episode}",
            f"https://vidplay.site/embed/tv/{tmdb_id}/{season}/{episode}",
            f"https://vidplay.online/embed/tv/{tmdb_id}/{season}/{episode}",
            f"https://autoembed.to/tv/{tmdb_id}/{season}/{episode}",
            f"https://autoembed.co/tv/{tmdb_id}/{season}/{episode}",
        ]
    print("[Other Providers] Testing additional sites...")
    merged_results = {"sources": []}
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(fetch_with_headers, u, referer="https://vidnest.fun"): u for u in others}
        for fut in as_completed(futures):
            url, html, _ = fut.result()
            if html:
                m3u8s = re.findall(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html)
                if m3u8s:
                    print(f"  ✅ Found on {url}")
                    domain = urllib.parse.urlparse(url).netloc
                    for m in m3u8s:
                        merged_results["sources"].append({"file": m, "title": domain})
    return merged_results if merged_results["sources"] else None

def base64url_decode(s):
    s = s.replace('-', '+').replace('_', '/')
    s += '=' * (-len(s) % 4)
    return base64.b64decode(s)

def decrypt_payload(enc_str, key_hex="a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5d"):
    try:
        parts = enc_str.split('.')
        if len(parts) != 3:
            return None
        iv = base64url_decode(parts[0])
        ciphertext = base64url_decode(parts[1])
        tag = base64url_decode(parts[2])
        
        aesgcm = AESGCM(bytes.fromhex(key_hex))
        decrypted_bytes = aesgcm.decrypt(iv, ciphertext + tag, None)
        return json.loads(decrypted_bytes.decode('utf-8'))
    except Exception as e:
        print(f"Decryption failed: {e}")
        return None

def fetch_peachify_endpoint(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://peachify.top',
        'Referer': 'https://peachify.top/'
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return url, resp.read().decode('utf-8')
    except Exception as e:
        return url, None

def process_peachify(url, data, provider_label):
    if not data:
        return None
    try:
        j = json.loads(data)
        if j.get('isEncrypted') and j.get('data'):
            dec = decrypt_payload(j['data'])
            if dec:
                if 'sources' in dec and isinstance(dec['sources'], list):
                    for src in dec['sources']:
                        src['title'] = f"Peachify ({provider_label})"
                return dec
        if any(k in j for k in ['sources', 'streams', 'stream', 'data', 'file', 'url']):
            if 'sources' in j and isinstance(j['sources'], list):
                for src in j['sources']:
                    src['title'] = f"Peachify ({provider_label})"
            return j
    except Exception as e:
        pass
    return None

def try_peachify(tmdb_id, media_type="movie", season=1, episode=1):
    providers = [
        {"label": "Iron", "path": "moviebox", "apis": ["https://uwu.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"]},
        {"label": "Spider", "path": "holly", "apis": ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"]},
        {"label": "Wolf", "path": "air", "apis": ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"]},
        {"label": "Multi", "path": "multi", "apis": ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"]},
        {"label": "Dark", "path": "net", "apis": ["https://uwu.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"]},
        {"label": "Rasmalai", "path": "rasmalai", "apis": ["https://usa.eat-peach.sbs", "https://proxy-6.eat-peach.sbs"]}
    ]
    
    urls_to_fetch = []
    for prov in providers:
        for api in prov["apis"]:
            if media_type == "movie":
                url = f"{api}/{prov['path']}/movie/{tmdb_id}"
            else:
                url = f"{api}/{prov['path']}/tv/{tmdb_id}/{season}/{episode}"
            urls_to_fetch.append((url, prov["label"]))
            
    print(f"[Peachify] Testing {len(urls_to_fetch)} endpoints in parallel...")
    merged_results = {"sources": []}
    
    with ThreadPoolExecutor(max_workers=10) as ex:
        futures = {ex.submit(fetch_peachify_endpoint, url): (url, label) for url, label in urls_to_fetch}
        for fut in as_completed(futures):
            url, label = futures[fut]
            try:
                _, data = fut.result()
                if not data:
                    continue
                res = process_peachify(url, data, label)
                if res and isinstance(res, dict):
                    if "sources" in res and isinstance(res["sources"], list):
                        merged_results["sources"].extend(res["sources"])
            except Exception as e:
                print(f"Peachify fetch failed for {url}: {e}")
                
    return merged_results if merged_results["sources"] else None

def try_movish(tmdb_id, media_type="movie", season=1, episode=1):
    if media_type == "movie":
        url = f"https://movish.net/moviebox-embed/movie/{tmdb_id}"
    else:
        url = f"https://movish.net/moviebox-embed/tv/{tmdb_id}/{season}/{episode}"
        
    print(f"[Movish] Scraping {url}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Referer': 'https://movish.net/'
    }
    
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            html = resp.read().decode('utf-8')
            match = re.search(r'const\s+STREAMS\s*=\s*(\[.*?\]);', html)
            if match:
                streams = json.loads(match.group(1))
                results = {"sources": []}
                for s in streams:
                    s_url = s.get("url")
                    if s_url:
                        results["sources"].append({
                            "url": s_url,
                            "title": "Movish",
                            "quality": s.get("label") or "unknown",
                            "type": s.get("type") or "mp4",
                            "headers": {
                                "Referer": "https://movish.net/",
                                "Origin": "https://movish.net"
                            }
                        })
                print(f"  ✅ [Movish] Found {len(results['sources'])} streams")
                return results
            else:
                print("  ⚠️ [Movish] No STREAMS array found in HTML response")
    except Exception as e:
        print(f"  ❌ [Movish] Failed: {e}")
        
    return None

def try_cinemaos(tmdb_id, media_type="movie", season=1, episode=1):
    secret = "dde0443a51aed264819df2c1292e678eacf0bbaff0ed279cce0b0f2094fcabe5"
    r = int(time.time() / 60)
    
    # Generate hash
    hash_input = f"{tmdb_id}:{r}:{secret}"
    t = 0
    for char in hash_input:
        t = (t << 5) - t + ord(char)
        t = (t & 0xFFFFFFFF)
        if t >= 0x80000000:
            t -= 0x100000000
    a = hex(abs(t))[2:].zfill(8)
    
    # Base36 encode r
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    base36 = ""
    temp_r = r
    while temp_r:
        temp_r, i = divmod(temp_r, 36)
        base36 = alphabet[i] + base36
    b36_r = base36 or alphabet[0]
    
    h = f"{a}-{b36_r}"
    print(f"[CinemaOS] Scraping TMDB {tmdb_id} with h={h}...")
    
    urls = []
    # cinemaosv2
    params_v2 = {
        'tmdbId': tmdb_id,
        'type': media_type,
        'h': h,
        '_gt': '2549b22d9bf0d91847a2811baac98d0079e02dba592aea94'
    }
    if media_type == "tv":
        params_v2['season'] = season
        params_v2['episode'] = episode
    query_v2 = urllib.parse.urlencode(params_v2)
    urls.append((f"https://cinemaos.live/api/cinemaosv2?{query_v2}", "cinemaosv2"))
    
    # multi-movies
    params_multi = {
        'tmdbId': tmdb_id,
        'type': media_type,
        'h': h
    }
    if media_type == "tv":
        params_multi['season'] = season
        params_multi['episode'] = episode
    query_multi = urllib.parse.urlencode(params_multi)
    urls.append((f"https://cinemaos.live/api/multi-movies?{query_multi}", "multi-movies"))
    
    merged_results = {"sources": []}
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Referer': f'https://cinemaos.live/{media_type}/watch/{tmdb_id}'
    }
    
    for url, endpoint_type in urls:
        req = urllib.request.Request(url, headers=headers)
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = resp.read().decode('utf-8')
                    j = json.loads(data)
                    if endpoint_type == "cinemaosv2" and "streams" in j:
                        for s in j["streams"]:
                            s_url = s.get("url") or s.get("link")
                            if s_url:
                                merged_results["sources"].append({
                                    "url": s_url,
                                    "title": f"CinemaOS ({s.get('name') or 'V2'})",
                                    "quality": s.get("quality") or "unknown",
                                    "headers": s.get("headers") or {}
                                })
                    elif endpoint_type == "multi-movies" and "results" in j:
                        for s in j["results"]:
                            s_url = s.get("link")
                            if s_url:
                                source_name = s.get("source") or "MultiMovies"
                                quality = s.get("quality") or "HD"
                                merged_results["sources"].append({
                                    "url": s_url,
                                    "title": f"CinemaOS ({source_name})",
                                    "quality": quality,
                                    "headers": {}
                                })
                    break
            except Exception as e:
                if attempt < 2:
                    time.sleep(1)
                    continue
                print(f"  ❌ [CinemaOS] {endpoint_type} failed: {e}")
            
    if merged_results["sources"]:
        print(f"  ✅ [CinemaOS] Found {len(merged_results['sources'])} streams")
        return merged_results
    return None

def extract_links(data):
    links = []
    if isinstance(data, dict):
        for key in ['url', 'file', 'src']:
            val = data.get(key)
            if val and isinstance(val, str):
                is_stream = (
                    'm3u8' in val.lower() or 
                    '.mp4' in val.lower() or 
                    'stream' in val.lower() or 
                    '/get' in val.lower() or
                    data.get('type') in ['hls', 'mp4', 'direct']
                )
                if is_stream:
                    quality = data.get('quality')
                    title = data.get('title')
                    dub = data.get('dub')
                    label = ""
                    if title:
                        label += str(title)
                    if dub:
                        label += f" ({dub})"
                    if quality:
                        q_str = str(quality)
                        if not q_str.lower().endswith('p'):
                            q_str += 'p'
                        label += f" [{q_str}]" if label else q_str
                    if not label:
                        label = data.get('language') or 'unknown'
                        
                    links.append({
                        'url': val,
                        'label': label,
                        'headers': data.get('headers') or {},
                        'type': data.get('type') or ('hls' if 'm3u8' in val.lower() else 'mp4')
                    })
        for k, v in data.items():
            if isinstance(v, (dict, list)):
                links.extend(extract_links(v))
    elif isinstance(data, list):
        for item in data:
            links.extend(extract_links(item))
    elif isinstance(data, str):
        if '.m3u8' in data or '.mp4' in data:
            links.append({
                'url': data,
                'label': 'unknown',
                'headers': {},
                'type': 'hls' if '.m3u8' in data else 'mp4'
            })
    return links

def scrape_media(tmdb_id, media_type="movie", season=1, episode=1):
    print(f"\n🔍 Scraping TMDB {tmdb_id} ({media_type}, S{season}E{episode})")
    start = time.time()
    
    all_results = []
    
    # Run all providers in parallel to collect all links
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {
            executor.submit(provider, tmdb_id, media_type, season, episode): provider
            for provider in [try_peachify, try_movish, try_vidnest, try_vidsrc_family, try_other_providers, try_cinemaos]
        }
        for fut in as_completed(futures):
            provider = futures[fut]
            try:
                result = fut.result()
                if result:
                    all_results.append(result)
            except Exception as e:
                print(f"Provider {provider.__name__} failed: {e}")
            
    if all_results:
        merged = {"sources": [], "streams": []}
        for res in all_results:
            if isinstance(res, dict):
                if "sources" in res and isinstance(res["sources"], list):
                    merged["sources"].extend(res["sources"])
                if "streams" in res and isinstance(res["streams"], list):
                    merged["streams"].extend(res["streams"])
                if "url" in res:
                    # Single stream URL dictionary
                    merged["sources"].append(res)
                    
        # Deduplicate streams based on URL to keep the list clean
        seen_urls = set()
        deduped_sources = []
        for src in merged["sources"]:
            url = src.get("url") or src.get("file")
            if url and url not in seen_urls:
                seen_urls.add(url)
                deduped_sources.append(src)
        merged["sources"] = deduped_sources

        deduped_streams = []
        for stream in merged["streams"]:
            url = stream.get("url") or stream.get("file")
            if url and url not in seen_urls:
                seen_urls.add(url)
                deduped_streams.append(stream)
        merged["streams"] = deduped_streams

        print(f"✅ Aggregate Success: Found {len(merged['sources']) + len(merged['streams'])} streams in {time.time()-start:.2f}s")
        return merged
    
    print("❌ No sources found")
    return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python multi_scraper_parallel.py <TMDB_ID> [movie/tv] [season] [episode]")
        sys.exit(1)
    
    tmdb_id = int(sys.argv[1])
    media_type = sys.argv[2] if len(sys.argv) > 2 else "movie"
    season = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    episode = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    
    data = scrape_media(tmdb_id, media_type, season, episode)
    
    if data:
        print("\n🎥 RESULT:")
        print(json.dumps(data, indent=2)[:2000] + "..." if len(str(data)) > 2000 else json.dumps(data, indent=2))
        
        extracted = extract_links(data)
        if extracted:
            for s in extracted:
                print(f"\n▶ DIRECT Link ({s['label']}): {s['url']}")
                if s['headers']:
                    print(f"  Headers: {json.dumps(s['headers'])}")
        else:
            print("\n⚠️ No direct stream URLs could be extracted from result.")
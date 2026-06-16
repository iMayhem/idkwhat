import http.server
import socketserver
import json
import urllib.request
import urllib.parse
import sys
import os
from multi_scraper_parallel import scrape_media

PORT = 8000

def rewrite_m3u8(content, base_url, referer, origin, user_agent):
    lines = content.split('\n')
    rewritten_lines = []
    
    encoded_ref = urllib.parse.quote(referer) if referer else ''
    encoded_orig = urllib.parse.quote(origin) if origin else ''
    encoded_ua = urllib.parse.quote(user_agent) if user_agent else ''
    
    suffix = ""
    if encoded_ref:
        suffix += f"&referer={encoded_ref}"
    if encoded_orig:
        suffix += f"&origin={encoded_orig}"
    if encoded_ua:
        suffix += f"&user_agent={encoded_ua}"
        
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('#'):
            # Rewrite key URIs if present, e.g. #EXT-X-KEY:METHOD=AES-128,URI="keys.key"
            if 'URI="' in line:
                parts = line.split('URI="')
                if len(parts) > 1:
                    uri = parts[1].split('"')[0]
                    full_uri = urllib.parse.urljoin(base_url, uri)
                    encoded_uri = urllib.parse.quote(full_uri)
                    proxied_uri = f"/api/proxy?url={encoded_uri}{suffix}"
                    line = line.replace(f'URI="{uri}"', f'URI="{proxied_uri}"')
            rewritten_lines.append(line)
        else:
            # Absolute or relative stream segment URL
            full_uri = urllib.parse.urljoin(base_url, line)
            encoded_uri = urllib.parse.quote(full_uri)
            proxied_uri = f"/api/proxy?url={encoded_uri}{suffix}"
            rewritten_lines.append(proxied_uri)
    return '\n'.join(rewritten_lines)

class ScraperHTTPServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Override to log cleanly
        sys.stderr.write(f"[Server] {format % args}\n")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # 1. API Scrape Endpoint
        if parsed.path == '/api/scrape':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            query = urllib.parse.parse_qs(parsed.query)
            try:
                tmdb_id = int(query.get('id', [0])[0])
                media_type = query.get('type', ['movie'])[0]
                season = int(query.get('season', [1])[0])
                episode = int(query.get('episode', [1])[0])
                
                if not tmdb_id:
                    self.wfile.write(json.dumps({"error": "Missing or invalid TMDB ID"}).encode('utf-8'))
                    return
                
                print(f"[API] Scraping ID={tmdb_id}, Type={media_type}, S{season}E{episode}")
                data = scrape_media(tmdb_id, media_type, season, episode)
                
                if data:
                    self.wfile.write(json.dumps(data).encode('utf-8'))
                else:
                    self.wfile.write(json.dumps({"error": "No stream sources found"}).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({"error": f"Internal scraper error: {str(e)}"}).encode('utf-8'))
            return
            
        # 2. HLS Proxy Endpoint
        elif parsed.path == '/api/proxy':
            query = urllib.parse.parse_qs(parsed.query)
            target_url = query.get('url', [''])[0]
            referer = query.get('referer', [None])[0]
            origin = query.get('origin', [None])[0]
            user_agent = query.get('user_agent', [None])[0]
            
            if not target_url:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Missing target URL")
                return

            # Construct headers for target request
            headers = {}
            
            # Force Peachify credentials for Peachify workers and proxy domains to bypass Cloudflare
            is_peachify_gateway = ('eat-peach.sbs' in target_url) or ('workers.dev' in target_url)
            
            if is_peachify_gateway:
                headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
                headers['Referer'] = 'https://peachify.top/'
                headers['Origin'] = 'https://peachify.top'
            else:
                if user_agent:
                    headers['User-Agent'] = user_agent
                else:
                    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
                
                if referer:
                    headers['Referer'] = referer
                if origin:
                    headers['Origin'] = origin
                
            try:
                # Forward Range header if present in client request (essential for seeking and fast pings)
                client_range = self.headers.get('Range')
                if client_range:
                    headers['Range'] = client_range
                
                req = urllib.request.Request(target_url, headers=headers)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    content_type = resp.getheader('Content-Type', 'application/octet-stream')
                    
                    # If it's an HLS playlist, we read it fully to rewrite internal segment links
                    is_playlist = 'mpegurl' in content_type.lower() or 'x-mpegurl' in content_type.lower() or target_url.endswith('.m3u8')
                    
                    if is_playlist:
                        data = resp.read()
                        try:
                            text_content = data.decode('utf-8', errors='ignore')
                            rewritten = rewrite_m3u8(text_content, target_url, referer, origin, user_agent)
                            data = rewritten.encode('utf-8')
                        except Exception as rewrite_err:
                            print(f"[Proxy] Warning - failed to rewrite m3u8 playlist: {rewrite_err}")
                        content_type = 'application/x-mpegURL'
                        
                        self.send_response(resp.status)
                        self.send_header('Content-Type', content_type)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(data)
                    else:
                        # Stream the media body in chunks immediately to support fast latency checks and seeking
                        self.send_response(resp.status)
                        self.send_header('Content-Type', content_type)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        
                        # Forward remote headers like length, range, and cache
                        for h_name in ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Cache-Control']:
                            h_val = resp.getheader(h_name)
                            if h_val:
                                self.send_header(h_name, h_val)
                        self.end_headers()
                        
                        # Read and write in 64KB chunks directly
                        while True:
                            chunk = resp.read(65536)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
            except urllib.error.HTTPError as e:
                # Propagate status, headers, and body from the target error response
                self.send_response(e.code)
                content_type = e.headers.get('Content-Type', 'text/plain')
                self.send_header('Content-Type', content_type)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Proxy connection failed: {str(e)}".encode('utf-8'))
            return

        # 3. Serve Static Files
        else:
            super().do_GET()

if __name__ == '__main__':
    # Ensure working directory is the folder of this script
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Allow port reuse
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), ScraperHTTPServer) as httpd:
        print(f"[Server] Running Retroflix Server at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("[Server] Shutting down...")
            sys.exit(0)

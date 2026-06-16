# Deploying CineWave on Cloudflare Pages

CineWave has been fully prepared for serverless deployment on **Cloudflare Pages**. 

Both backend endpoints (`/api/scrape` and `/api/proxy`) have been ported to native ES Modules inside the `/functions` directory. When you deploy, Cloudflare Pages will compile these JavaScript files into high-performance Cloudflare Workers that execute at the edge.

---

## Folder Structure for Deployment
* `/index.html` (Static frontend layout)
* `/index.css` (Stylesheets & animations)
* `/app.js` (Frontend controller, routing, and player client)
* `/functions/api/scrape.js` (Serverless parallel scraper)
* `/functions/api/proxy.js` (Serverless stream proxy with preflight CORS & chunked range streaming)

---

## Local Development & Emulation
To test the serverless Workers backend locally exactly as it will run on Cloudflare Pages, you can use **Wrangler** (Cloudflare's official CLI):

1. **Initialize a Node environment** (if not already done) to use Wrangler:
   ```bash
   npm init -y
   ```

2. **Run the local emulator**:
   ```bash
   npx wrangler pages dev .
   ```
   *This command will spin up a local server, serve your static files, and hot-reload your Pages functions under `http://localhost:8788`.*

---

## Deploying to Cloudflare Pages

### Option A: Via the Cloudflare Dashboard (No CLI needed)
1. Commit and push your code to a GitHub or GitLab repository.
2. Log in to your Cloudflare Dashboard and navigate to **Workers & Pages** > **Pages** > **Create a project** > **Connect to Git**.
3. Choose your repository.
4. Set the following Build Settings:
   * **Project name**: `cinewave` (or your preferred name)
   * **Framework preset**: `None`
   * **Build command**: *Leave empty* (no build step needed!)
   * **Build output directory**: `/` (deploy from the root)
5. Click **Save and Deploy**. Cloudflare will host the frontend and edge APIs automatically on a `*.pages.dev` subdomain!

### Option B: Via Wrangler CLI (Direct Command Line Upload)
If you prefer deploying directly from your terminal:
1. Log in to your Cloudflare account:
   ```bash
   npx wrangler login
   ```
2. Deploy the project:
   ```bash
   npx wrangler pages deploy . --project-name=cinewave
   ```
   *Follow the prompts to create the project. It will be live instantly!*

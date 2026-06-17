import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

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

// Proxy route for scraping requests
app.get("/api/scrape", async (req, res) => {
  const target = `http://localhost:8000/api/scrape?${new URLSearchParams(req.query as any).toString()}`;
  try {
    const response = await fetch(target);
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy route for stream proxying (essential for CORS bypass & HLS range requests)
app.get("/api/proxy", async (req, res) => {
  const target = `http://localhost:8000/api/proxy?${new URLSearchParams(req.query as any).toString()}`;
  try {
    const headers: Record<string, string> = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }
    
    const response = await fetch(target, { headers });
    
    res.status(response.status);
    response.headers.forEach((val, name) => {
      res.setHeader(name, val);
    });
    
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err: any) {
    res.status(500).send(`Proxy failed: ${err.message}`);
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

import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit to support large base64 images/videos
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Initialize Gemini AI securely on the server side
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // API endpoint for generating prompt using Gemini
  app.post("/api/generate-prompt", async (req, res) => {
    try {
      const { systemPrompt, base64Data, mimeType, model = "gemini-3-flash-preview" } = req.body;

      if (!systemPrompt || !base64Data || !mimeType) {
        return res.status(400).json({
          error: "Missing required parameters (systemPrompt, base64Data, mimeType)",
        });
      }

      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please check your secrets panel.",
        });
      }

      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt },
              { inlineData: { mimeType, data: base64Data } },
            ],
          },
        ],
      });

      const text = response.text;
      if (!text) {
        return res.status(500).json({ error: "AI returned empty response." });
      }

      res.json({ text });
    } catch (error: any) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: error.message || "Gagal menganalisis gambar" });
    }
  });

  // Serve static assets and frontend index
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, base64Data, mimeType, model = "gemini-3-flash-preview" } = req.body;

    if (!systemPrompt || !base64Data || !mimeType) {
      return res.status(400).json({
        error: "Missing required parameters (systemPrompt, base64Data, mimeType)",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured on the server. Please add it to your Vercel Environment Variables.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

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

    return res.status(200).json({ text });
  } catch (error: any) {
    console.error("Gemini API error on Vercel Serverless:", error);
    return res.status(500).json({ error: error.message || "Gagal menganalisis gambar" });
  }
}

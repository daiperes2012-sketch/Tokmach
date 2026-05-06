import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não configurada nos segredos do AI Studio.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export async function translateText(text: string, targetLanguage: string = "Portuguese"): Promise<string> {
  try {
    const client = getGenAI();
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text to ${targetLanguage}. Return ONLY the translated text, no extra commentary:\n\n"${text}"`
    });
    
    return response.text?.trim() || "Tradução vazia.";
  } catch (error) {
    console.error("Translation error:", error);
    if (error instanceof Error && error.message.includes("GEMINI_API_KEY")) {
      return "Configuração de IA pendente.";
    }
    return "Erro na tradução.";
  }
}

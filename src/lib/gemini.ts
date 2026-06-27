import { GoogleGenerativeAI } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) _client = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  return _client;
}

export const IMAGEN_MODEL = "gemini-2.5-flash-image";
export const GEMINI_EDIT_MODEL = "gemini-2.5-flash-image";

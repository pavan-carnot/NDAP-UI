// Which LLM answers: Gemini in the cloud, or gpt-oss + Llama 3.1 running on this server
export type ModelChoice = "gemini" | "local";

export const MODEL_OPTIONS: { value: ModelChoice; label: string; hint: string }[] = [
  { value: "gemini", label: "Gemini (cloud)", hint: "Google Gemini API; prompts leave this server" },
  { value: "local", label: "On this server", hint: "gpt-oss 20B answers, Llama 3.1 8B for quick steps; nothing leaves this server" },
];

const KEY = "ndap_model";

export function loadModelChoice(): ModelChoice {
  try {
    return localStorage.getItem(KEY) === "local" ? "local" : "gemini";
  } catch {
    return "gemini";
  }
}

export function saveModelChoice(model: ModelChoice) {
  try { localStorage.setItem(KEY, model); } catch { /* storage unavailable */ }
}

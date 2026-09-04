/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GROQ_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_NVIDIA_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import type { Locale } from "./utils/locale";

export const DISCLAIMER: Record<Locale, string> = {
  uk: "Інформація має довідковий характер і не замінює консультацію лікаря.",
  ru: "Информация носит справочный характер и не заменяет консультацию врача.",
  en: "This information is for reference only and does not replace a medical consultation.",
};

export const ASK_QUESTION_PROMPT: Record<Locale, string> = {
  uk: "Будь ласка, сформулюйте питання або опишіть, що саме вас цікавить.",
  ru: "Пожалуйста, сформулируйте вопрос или опишите, что именно вас интересует.",
  en: "Please ask a question or describe what you need help with.",
};

export const ERROR_GENERIC: Record<Locale, string> = {
  uk: "Вибачте, не вдалося сформувати структуровану відповідь. Спробуйте перефразувати запит.",
  ru: "Извините, не удалось сформировать структурированный ответ. Попробуйте переформулировать вопрос.",
  en: "Sorry, I couldn't produce a structured answer. Please rephrase your question.",
};

export const NO_PROVIDER: Record<Locale, string> = {
  uk: "AI-провайдер не налаштований на цьому сервері. Додайте OPENAI_API_KEY, щоб увімкнути відповіді.",
  ru: "AI‑провайдер не настроен на этом сервере. Добавьте OPENAI_API_KEY, чтобы включить ответы.",
  en: "AI provider is not configured on this server. Add OPENAI_API_KEY to enable live responses.",
};

export const REPHRASE_PROMPT: Record<Locale, string> = {
  uk: "Вибачте, не вдалося надійно відповісти на це питання. Спробуйте перефразувати запит і повторіть.",
  ru: "Извините, не удалось надёжно ответить на этот вопрос. Переформулируйте запрос и попробуйте ещё раз.",
  en: "Sorry, I couldn't reliably answer this question. Please rephrase it and try again.",
};

export const SMOKE_TEST_RESPONSE: Record<Locale, string> = {
  uk: "Це тестовий запит. Будь ласка, поставте питання, і я допоможу.",
  ru: "Это тестовый запрос. Пожалуйста, задайте вопрос, и я помогу.",
  en: "This is a test request. Please ask a question and I'll help.",
};

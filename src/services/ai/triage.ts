export type SafetyLevel = "normal" | "caution" | "urgent";

export function maxSafety(a: SafetyLevel, b: SafetyLevel): SafetyLevel {
  const rank: Record<SafetyLevel, number> = { normal: 0, caution: 1, urgent: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Very small heuristic triage to avoid missing obvious red flags.
 * This is NOT a diagnosis; it only decides the tone and the warning banner.
 */
export function triageMessage(message: string, locale: string): { level: SafetyLevel; warnings: string[] } {
  const m = (message || "").toLowerCase();

  // Urgent: symptoms that should be directed to emergency care / doctor immediately.
  const urgentMarkers = [
    "сильное кровотечение",
    "обильное кровотечение",
    "кровотеч",
    "резкая боль",
    "сильная боль в животе",
    "потеря сознания",
    "судорог",
    "затрудненное дыхание",
    "трудно дышать",
    "боль в груди",
    "температура 39",
    "высокая температура",
    "воды отошли",
    "нет шевелений",
  ];

  // Caution: non-urgent but worth consulting a doctor soon.
  const cautionMarkers = [
    "мажет",
    "небольшое кровотечение",
    "головокружение",
    "давление",
    "отеки",
    "сильная тошнота",
    "рвота",
    "понос",
    "высокий сахар",
    "анализ",
  ];

  const isUrgent = urgentMarkers.some((k) => m.includes(k));
  const isCaution = !isUrgent && cautionMarkers.some((k) => m.includes(k));

  const warningText =
    locale === "en"
      ? "If you have severe symptoms (heavy bleeding, severe pain, shortness of breath, loss of consciousness), seek urgent medical care."
      : locale === "uk"
        ? "Якщо є сильні симптоми (рясна кровотеча, сильний біль, утруднене дихання, втрата свідомості) — негайно зверніться по медичну допомогу."
        : "Если есть сильные симптомы (обильное кровотечение, сильная боль, затруднённое дыхание, потеря сознания) — срочно обратитесь за медицинской помощью.";

  if (isUrgent) return { level: "urgent", warnings: [warningText] };
  if (isCaution) return { level: "caution", warnings: [warningText] };
  return { level: "normal", warnings: [] };
}

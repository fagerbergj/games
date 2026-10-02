import { DEFAULT_HOUSE_RULES, sanitizeHouseRules, type HouseRules } from "@game-rules/blackjack";

const KEY = "blackjack_house_rules";

export function getHouseRules(): HouseRules {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_HOUSE_RULES;
    return sanitizeHouseRules(JSON.parse(raw) as Partial<HouseRules>);
  } catch {
    return DEFAULT_HOUSE_RULES;
  }
}

export function saveHouseRules(rules: HouseRules): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizeHouseRules(rules)));
  } catch {
    // storage full or unavailable — silently skip
  }
}

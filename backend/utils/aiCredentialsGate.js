/**
 * Anthropic / AI-enablement gates from utils/aiService.js.
 * Distinct from ShopMonkey placeholder-vs-empty (#124) and Turn14
 * placeholder-vs-empty (#106): this is the Claude key plus AI_ENABLED /
 * USE_LOCAL_AI sync predicates.
 *
 * Missing, whitespace-only, or the exact .env placeholder → not configured.
 * Trim is only used for the empty check; a placeholder with trailing
 * spaces still counts as configured (current initializeAnthropic behavior).
 *
 * Sync enablement treats USE_LOCAL_AI === 'true' only — 'auto' is not
 * enough for isAIEnabledSync (the async path may still try Ollama).
 */

export const ANTHROPIC_PLACEHOLDER_API_KEY = 'your_api_key_here';

export function isAnthropicApiKeyConfigured(value) {
  const key = arguments.length > 0 ? value : process.env.ANTHROPIC_API_KEY;
  return Boolean(key) && key.trim() !== '' && key !== ANTHROPIC_PLACEHOLDER_API_KEY;
}

/** AI_ENABLED !== 'false' (undefined / '' / 'true' / '0' all stay enabled). */
export function isAiFeatureFlagEnabled(aiEnabledEnv) {
  const value = arguments.length > 0 ? aiEnabledEnv : process.env.AI_ENABLED;
  return value !== 'false';
}

/** Sync path only: exact string 'true'. 'auto' does not count. */
export function isLocalAiSyncEnabled(useLocalAiEnv) {
  const value = arguments.length > 0 ? useLocalAiEnv : process.env.USE_LOCAL_AI;
  return value === 'true';
}

/**
 * Mirrors isAIEnabledSync after the Anthropic client has already been
 * resolved to a boolean (configured vs not). Avoids importing the SDK.
 */
export function isAiEnabledSyncFromFlags({
  apiKeyConfigured = false,
  aiEnabled,
  useLocalAi,
} = {}) {
  return isAiFeatureFlagEnabled(aiEnabled) && (apiKeyConfigured || isLocalAiSyncEnabled(useLocalAi));
}

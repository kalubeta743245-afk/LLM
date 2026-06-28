/**
 * promptMerge middleware
 *
 * Implements the core requirement:
 *   "A default system prompt is always applied and is never changed. If the user
 *    adds their own system prompt, it is appended to the addition — the default
 *    system prompt stays unchanged."
 *
 * Additionally handles the /ui slash command:
 *   - If the LAST user message starts with "/ui", the prefix is stripped and
 *     the UI_UX_GENERATION_PROMPT is injected as an additional system message
 *     (after the default, before conversation).
 *   - Without "/ui", behavior is unchanged — only the default system prompt applies.
 *
 * Merge order (final messages array):
 *   [ DEFAULT_SYSTEM_PROMPT ]           <- always first, never modified
 *   [ ...client system messages ]        <- appended after default
 *   [ UI_UX_GENERATION_PROMPT ]         <- only if /ui command detected
 *   [ ...conversation messages ]         <- /ui prefix stripped from triggering msg
 */
const {
  DEFAULT_SYSTEM_PROMPT,
  UI_COMMAND,
  UI_UX_GENERATION_PROMPT,
} = require('../config');

/**
 * Merge the default system prompt (and optionally the UI/UX prompt) with a
 * client's messages array.
 * @param {Array<{role:string, content:string}>} messages
 * @returns {{ messages: Array, uiMode: boolean }}
 */
function mergeWithDefaultSystemPrompt(messages = []) {
  const safe = Array.isArray(messages) ? messages : [];

  const clientSystemMessages = safe.filter((m) => m && m.role === 'system');
  const conversationMessages = safe.filter((m) => m && m.role !== 'system');

  // Detect /ui: check if the LAST user message starts with the command prefix.
  let uiMode = false;
  const processed = conversationMessages.map((m) => {
    if (m.role === 'user' && typeof m.content === 'string') {
      const stripped = m.content.trimStart();
      if (stripped.startsWith(UI_COMMAND + ' ') || stripped === UI_COMMAND) {
        uiMode = true;
        // Strip the "/ui" prefix; keep the rest as the actual user query.
        const remaining = stripped.slice(UI_COMMAND.length).trim();
        return { ...m, content: remaining || m.content };
      }
    }
    return m;
  });

  const merged = [
    { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
    ...clientSystemMessages,
  ];

  // If /ui was detected, inject the UI/UX generation prompt.
  if (uiMode) {
    merged.push({ role: 'system', content: UI_UX_GENERATION_PROMPT });
  }

  merged.push(...processed);

  return { messages: merged, uiMode };
}

/** Express middleware: merges req.body.messages in place and sets req.uiMode. */
function promptMergeMiddleware(req, res, next) {
  if (req.body && Array.isArray(req.body.messages)) {
    const { messages, uiMode } = mergeWithDefaultSystemPrompt(req.body.messages);
    req.body.messages = messages;
    req.uiMode = uiMode;
  } else {
    req.uiMode = false;
  }
  next();
}

module.exports = {
  mergeWithDefaultSystemPrompt,
  promptMergeMiddleware,
};

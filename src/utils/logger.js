/**
 * Tiny logger wrapper so we can swap implementations later without touching
 * call sites. For the prototype it just defers to console with a prefix.
 */
const PREFIX = '[optimizedLLM]';

module.exports = {
  info: (...args) => console.log(PREFIX, ...args),
  warn: (...args) => console.warn(PREFIX, ...args),
  error: (...args) => console.error(PREFIX, ...args),
};

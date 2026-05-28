// Random password generator for the optional keydetails-file
// password-protection feature.
//
// Curated alphabet:
//   - uppercase A-Z   minus I O  (look like 1 / 0)
//   - lowercase a-z   minus l o  (look like 1 / 0)
//   - digits 2-9                (excludes 0 / 1)
//   - symbols: ! # $ % & * + - = ? @ ^
//     (excluded: quotes, backslash, currency symbols, brackets that
//      need shifted keyboard combos that vary across locales)
//
// Output: 8 characters, drawn uniformly at random from the alphabet
// above using crypto.getRandomValues + rejection sampling (so the
// distribution stays uniform — no modulo bias).

const UPPER   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';        // I, O removed
const LOWER   = 'abcdefghijkmnpqrstuvwxyz';        // l, o removed
const DIGITS  = '23456789';                        // 0, 1 removed
const SYMBOLS = '!#$%&*+-=?@^';
const ALPHABET = UPPER + LOWER + DIGITS + SYMBOLS;

function randomIndex(modulus) {
  // Rejection-sample a 16-bit value down to [0, modulus). Keeps the
  // distribution uniform when modulus doesn't evenly divide 65536.
  const buf = new Uint16Array(1);
  const cap = Math.floor(65536 / modulus) * modulus;
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < cap) return buf[0] % modulus;
  }
}

/**
 * Generates a random password of length `length` (default 8) drawn
 * from the curated alphabet. Guaranteed to contain at least one
 * character from each of upper / lower / digit / symbol families so
 * the result always passes "complexity" expectations.
 */
export function generateMemorablePassword(length = 8) {
  if (length < 4) throw new Error('Password length must be at least 4.');
  // Seed one char from each family for guaranteed coverage.
  const seeded = [
    UPPER  [randomIndex(UPPER.length)],
    LOWER  [randomIndex(LOWER.length)],
    DIGITS [randomIndex(DIGITS.length)],
    SYMBOLS[randomIndex(SYMBOLS.length)],
  ];
  const rest = [];
  for (let i = 0; i < length - 4; i++) {
    rest.push(ALPHABET[randomIndex(ALPHABET.length)]);
  }
  // Fisher-Yates shuffle the combined array so the seed chars don't
  // always land in positions 0..3.
  const all = [...seeded, ...rest];
  for (let i = all.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.join('');
}

export { ALPHABET as PASSWORD_ALPHABET };

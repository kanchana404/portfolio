/**
 * Password and passphrase generation.
 *
 * Two things separate a correct implementation from the usual one.
 *
 * **The source of randomness.** `Math.random()` is not a CSPRNG. V8's
 * implementation is xorshift128+, and its internal state can be recovered from a
 * short run of observed outputs, which means future values are predictable.
 * Every byte here comes from `crypto.getRandomValues`.
 *
 * **The selection method.** The obvious `bytes[i] % alphabet.length` is biased
 * whenever the alphabet does not divide 256 evenly: the first few characters
 * come up measurably more often. Rejection sampling removes the bias at the cost
 * of occasionally drawing another byte.
 */

export interface CharsetOption {
  id: "lower" | "upper" | "digits" | "symbols";
  label: string;
  chars: string;
  note?: string;
}

/**
 * `l`, `I`, `1`, `O` and `0` are deliberately present.
 *
 * Removing look-alikes is offered as a choice rather than imposed, because every
 * character removed shrinks the alphabet and therefore the entropy. It is worth
 * it for something a human will read off a screen and type; it is a pure loss
 * for something going straight into a password manager.
 */
export const CHARSETS: readonly CharsetOption[] = [
  { id: "lower", label: "abc", chars: "abcdefghijklmnopqrstuvwxyz" },
  { id: "upper", label: "ABC", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  { id: "digits", label: "123", chars: "0123456789" },
  {
    id: "symbols",
    label: "!@#",
    chars: "!@#$%^&*()-_=+[]{};:,.?",
    note: "Quotes, backslashes and spaces are left out — they break shell commands and connection strings often enough to be worth avoiding.",
  },
];

const AMBIGUOUS = new Set(["l", "I", "1", "O", "0", "o"]);

/**
 * Uniformly pick an index in [0, range) from cryptographic bytes.
 *
 * Rejection sampling: bytes at or above the largest exact multiple of `range`
 * are discarded and redrawn, so every index is equally likely. Taking a plain
 * modulo would over-represent the first `256 % range` characters of the
 * alphabet — a small bias, but one that is free to avoid.
 */
function uniformIndex(range: number): number {
  if (range <= 0) throw new RangeError("range must be positive");
  if (range > 256) throw new RangeError("range must fit in one byte");
  const limit = Math.floor(256 / range) * range;
  const buf = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % range;
  }
}

export interface PasswordOptions {
  length: number;
  charsets: Array<CharsetOption["id"]>;
  excludeAmbiguous: boolean;
}

export interface PasswordResult {
  password: string;
  alphabetSize: number;
  /** log2(alphabet^length), the honest measure for a randomly generated string. */
  bits: number;
}

export function buildAlphabet(options: PasswordOptions): string {
  const selected = CHARSETS.filter((c) => options.charsets.includes(c.id));
  let chars = selected.map((c) => c.chars).join("");
  if (options.excludeAmbiguous) {
    chars = [...chars].filter((c) => !AMBIGUOUS.has(c)).join("");
  }
  return chars;
}

export function generatePassword(options: PasswordOptions): PasswordResult | null {
  const alphabet = buildAlphabet(options);
  const length = Math.max(1, Math.min(256, Math.floor(options.length) || 0));
  if (alphabet.length === 0) return null;

  const chars: string[] = [];
  for (let i = 0; i < length; i++) {
    chars.push(alphabet[uniformIndex(alphabet.length)]);
  }

  return {
    password: chars.join(""),
    alphabetSize: alphabet.length,
    bits: length * Math.log2(alphabet.length),
  };
}

/**
 * A small, deliberately plain wordlist for passphrases.
 *
 * Short, unambiguous, common English words — the property that matters is that
 * they are easy to read aloud and retype, not that the list is large. Entropy
 * comes from the number of words drawn, and it is calculated from this list's
 * actual size rather than from a number copied off a blog.
 */
const WORDS = [
  "amber","anchor","apple","arrow","autumn","bacon","badge","bamboo","banjo","barley",
  "basil","beacon","beetle","birch","bishop","bison","blanket","blossom","bottle","boulder",
  "branch","bridge","bronze","bubble","bucket","buffalo","cabin","cactus","camera","candle",
  "canyon","carbon","cargo","carpet","castle","cedar","cellar","chalk","cherry","chimney",
  "cinder","circus","clover","cobalt","cocoa","comet","compass","copper","coral","cotton",
  "crane","crater","crimson","crystal","cypress","daisy","dolphin","donkey","dragon","dune",
  "eagle","ember","emerald","engine","fabric","falcon","feather","fennel","fiddle","flint",
  "forest","fossil","fountain","garden","ginger","glacier","granite","gravel","harbor","harvest",
  "hazel","helmet","hollow","honey","hornet","indigo","island","ivory","jacket","jasmine",
  "jungle","kettle","kitten","ladder","lagoon","lantern","laurel","lemon","lichen","lilac",
  "linen","lobster","locket","lumber","magnet","mango","maple","marble","meadow","melon",
  "meteor","mitten","monsoon","moss","muffin","mulberry","nectar","needle","nickel","noodle",
  "nutmeg","oasis","ocean","olive","onyx","orbit","orchid","otter","oyster","paddle",
  "pancake","panther","parcel","parsley","pebble","pelican","pepper","pewter","phoenix","pigeon",
  "pillow","pinecone","pistol","planet","plaster","plum","pocket","pollen","poppy","portal",
  "potato","prairie","pretzel","pumpkin","quartz","quiver","rabbit","radish","rafter","raven",
  "ribbon","river","rocket","rosemary","rubble","saddle","saffron","salmon","sandal","sapphire",
  "satchel","scarlet","seagull","shadow","shovel","silver","sparrow","spruce","squash","stable",
  "stallion","summit","sunset","syrup","tangerine","teapot","temple","thistle","thunder","timber",
  "tinder","toffee","tomato","topaz","torrent","tulip","tundra","turnip","turtle","umbrella",
  "valley","velvet","vinegar","violet","walnut","walrus","wander","whistle","willow","window",
  "winter","wombat","yarrow","yellow","zebra","zenith","zephyr","zigzag",
] as const;

export const WORDLIST_SIZE = WORDS.length;

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalise: boolean;
  appendNumber: boolean;
}

export function generatePassphrase(options: PassphraseOptions): PasswordResult {
  const count = Math.max(2, Math.min(12, Math.floor(options.words) || 4));
  const picked: string[] = [];

  for (let i = 0; i < count; i++) {
    // The wordlist is longer than 256, so an index needs two bytes. Same
    // rejection-sampling reasoning, widened.
    const limit = Math.floor(65536 / WORDS.length) * WORDS.length;
    const buf = new Uint16Array(1);
    let index: number;
    for (;;) {
      crypto.getRandomValues(buf);
      if (buf[0] < limit) {
        index = buf[0] % WORDS.length;
        break;
      }
    }
    const word = WORDS[index];
    picked.push(options.capitalise ? word[0].toUpperCase() + word.slice(1) : word);
  }

  let bits = count * Math.log2(WORDS.length);
  let phrase = picked.join(options.separator);

  if (options.appendNumber) {
    const digits = uniformIndex(100);
    phrase += `${options.separator}${String(digits).padStart(2, "0")}`;
    bits += Math.log2(100);
  }

  return { password: phrase, alphabetSize: WORDS.length, bits };
}

export type StrengthBand = "weak" | "fair" | "strong" | "excellent";

export interface Strength {
  band: StrengthBand;
  label: string;
  /** Plain-language estimate of offline cracking time. */
  crackTime: string;
}

/**
 * Interpret entropy.
 *
 * Bands are anchored to offline attack against a *fast* hash — the pessimistic
 * assumption, on the order of 10^11 guesses per second for unsalted SHA-1 on
 * commodity GPUs. A properly stored password behind bcrypt or Argon2 is many
 * orders of magnitude slower to attack, so these are deliberately conservative.
 */
export function describeStrength(bits: number): Strength {
  const guessesPerSecond = 1e11;
  const seconds = Math.pow(2, bits - 1) / guessesPerSecond;

  const crackTime = ((): string => {
    if (seconds < 1) return "instantly";
    if (seconds < 60) return `${Math.round(seconds)} seconds`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
    if (seconds < 31_536_000) return `${Math.round(seconds / 86400)} days`;
    const years = seconds / 31_536_000;
    if (years < 1000) return `${Math.round(years)} years`;
    if (years < 1e6) return `${Math.round(years / 1000)} thousand years`;
    if (years < 1e9) return `${Math.round(years / 1e6)} million years`;
    if (years < 1e12) return `${Math.round(years / 1e9)} billion years`;
    return "longer than the age of the universe";
  })();

  if (bits < 50) return { band: "weak", label: "Weak", crackTime };
  if (bits < 70) return { band: "fair", label: "Fair", crackTime };
  if (bits < 100) return { band: "strong", label: "Strong", crackTime };
  return { band: "excellent", label: "Excellent", crackTime };
}

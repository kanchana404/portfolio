import type { ToolDef } from "../types";

/** Developer utilities. All pure-browser, all deterministic. */
export const DEVELOPER_TOOLS: readonly ToolDef[] = [
  {
    slug: "json-formatter",
    title: "JSON Formatter and Validator",
    metaTitle: "JSON Formatter and Validator",
    description:
      "Pretty-print, minify or sort JSON, and get syntax errors reported by " +
      "line and column with the offending line shown. Runs entirely offline.",
    category: "developer",
    audience: ["developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "json formatter",
      "json validator",
      "json beautifier",
      "json minifier",
      "format json online",
      "json syntax error",
    ],
    intro:
      "Paste JSON and get it indented, minified, or with its keys sorted. When " +
      "it is broken you get a line number, a column and the offending line " +
      "printed with a marker underneath, not a character offset.",
    howToUse: [
      "Paste your JSON into the input box.",
      "Choose format, minify, or sort keys. Formatting re-serialises the parsed value, so the output is always canonical.",
      "If it fails to parse, read the line and column reported and look at the marked line below it.",
      "Use sort keys before diffing two API responses. It removes false differences caused by key order.",
      "Copy the result with the button rather than selecting it by hand.",
    ],
    faqs: [
      {
        q: "Why does my JSON fail with a trailing comma?",
        a: "The JSON specification forbids it, even though JavaScript allows it in object and array literals. It is the single most common cause of a parse failure. Remove the comma before the closing brace.",
      },
      {
        q: "Can I use comments in JSON?",
        a: "Not in standard JSON. Some parsers accept a superset called JSON5 or JSONC, but anything strictly conforming, including this page, will reject them.",
      },
      {
        q: "Why did my long ID number change?",
        a: "JSON numbers are parsed as double-precision floats, which cannot represent every integer above roughly nine quadrillion exactly. Send large identifiers as strings if they need to survive a round trip.",
      },
    ],
    related: ["base64-encoder-decoder", "csv-to-json-converter", "text-diff-checker"],
  },

  {
    slug: "base64-encoder-decoder",
    title: "Base64 Encoder and Decoder",
    metaTitle: "Base64 Encoder & Decoder (Unicode)",
    description:
      "Encode and decode Base64 in your browser, including URL-safe Base64. " +
      "Handles emoji, Sinhala and Chinese, which btoa-based tools cannot.",
    category: "developer",
    audience: ["developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "base64 encoder",
      "base64 decoder",
      "base64 to text",
      "url safe base64",
      "encode base64 online",
    ],
    intro:
      "Encodes and decodes Base64, including the URL-safe alphabet. Text is " +
      "converted to UTF-8 bytes first, so emoji, Sinhala and Chinese survive. " +
      "many online tools wrap btoa and break on all three.",
    howToUse: [
      "Choose encode or decode with the toggle.",
      "Paste your text or your Base64 string into the box.",
      "Switch on URL-safe if the value goes into a URL or a JWT. It swaps plus and slash for hyphen and underscore and drops padding.",
      "Decoding accepts either alphabet and tolerates missing padding, so you can paste a JWT segment directly.",
      "If decoding reports invalid UTF-8, the data is binary (an image or an archive) rather than text.",
    ],
    faqs: [
      {
        q: "Is Base64 encryption?",
        a: "No. It is an encoding, fully reversible by anyone, with no key involved. Never use it to protect anything. It exists to move binary data safely through text-only channels.",
      },
      {
        q: "Why do other Base64 tools break on emoji?",
        a: "Because they call btoa directly, which only accepts Latin-1 characters and throws on anything above code point 255. This page encodes to UTF-8 bytes first, which is what every server-side implementation does.",
      },
      {
        q: "What is URL-safe Base64?",
        a: "A variant using hyphen and underscore instead of plus and slash, usually with the padding removed, so the result can go into a URL or a JWT without further escaping.",
      },
    ],
    related: ["url-encoder-decoder", "jwt-decoder", "hash-generator"],
  },

  {
    slug: "hash-generator",
    title: "SHA Hash Generator",
    metaTitle: "SHA-256 Hash Generator",
    description:
      "Generate SHA-256, SHA-384, SHA-512 or SHA-1 hashes of any text in your " +
      "browser, using the Web Crypto API. Nothing is uploaded.",
    category: "developer",
    audience: ["developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "sha256 hash generator",
      "hash generator",
      "sha512 generator",
      "checksum generator",
      "generate hash online",
    ],
    intro:
      "Hashes text with SHA-256, SHA-384, SHA-512 or SHA-1 using the browser's " +
      "own Web Crypto implementation. Nothing is sent anywhere, which matters " +
      "given what people paste into hash tools.",
    howToUse: [
      "Paste the text you want to hash.",
      "Pick an algorithm. SHA-256 is the right default unless something specific requires otherwise.",
      "The hash appears immediately; copy it with the button beside it.",
      "Change a single character and watch the whole hash change. That is the property checksums rely on.",
      "Use SHA-1 only to match a legacy system. It is broken for security purposes and labelled as such.",
    ],
    faqs: [
      {
        q: "Why is MD5 not offered?",
        a: "Because it is broken. Collisions can be produced on a laptop in seconds, so it is unfit for signatures, integrity checks and certificates. SHA-1 is included only for legacy compatibility.",
      },
      {
        q: "Can a hash be reversed?",
        a: "Not directly: it is one-way. But short or common inputs can be found by brute force or a lookup table, which is why passwords must be hashed with a slow, salted algorithm like bcrypt or Argon2 instead.",
      },
      {
        q: "Is my text uploaded to hash it?",
        a: "No. Hashing uses the browser's built-in Web Crypto API and happens on your device. You can verify it with the network tab open.",
      },
    ],
    related: ["password-generator", "base64-encoder-decoder"],
  },

  {
    slug: "url-encoder-decoder",
    title: "URL Encoder and Decoder",
    metaTitle: "URL Encoder and Decoder",
    description:
      "Percent-encode or decode URLs and query parameters, and break any URL " +
      "into its parts. Handles the component and full-URL distinction correctly.",
    category: "developer",
    audience: ["developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "url encoder",
      "url decoder",
      "percent encoding",
      "encode query string",
      "urlencode online",
    ],
    intro:
      "Percent-encodes and decodes URLs, and breaks a URL into scheme, host, " +
      "path and query parameters. Handles the difference between encoding a " +
      "whole URL and encoding a single component.",
    howToUse: [
      "Paste a URL or a fragment of one into the box.",
      "Choose encode or decode.",
      "Use component encoding for a single query value. It escapes ampersands, slashes and question marks that would otherwise change the URL's structure.",
      "Use full-URL encoding when you have an entire address and want to keep its separators intact.",
      "Paste a complete URL to see it split into scheme, host, path and each query parameter separately.",
    ],
    faqs: [
      {
        q: "What is the difference between encodeURI and encodeURIComponent?",
        a: "encodeURI leaves URL separators like slash, question mark and ampersand alone, so it is for whole URLs. encodeURIComponent escapes them, which is what a single query value needs.",
      },
      {
        q: "Why does a space become %20 sometimes and + other times?",
        a: "Plus is a form-encoding convention from HTML form submissions, valid in a query string but not elsewhere. %20 is correct everywhere, which is why it is the safer choice.",
      },
      {
        q: "Why does my decode fail with a malformed URI error?",
        a: "A percent sign must be followed by two hex digits. A literal percent in text (a discount code, for instance) must itself be encoded as %25 before decoding will work.",
      },
    ],
    related: ["base64-encoder-decoder", "case-converter", "json-formatter"],
  },

  {
    slug: "jwt-decoder",
    title: "JWT Decoder",
    metaTitle: "JWT Decoder and Claims Viewer",
    description:
      "Decode a JSON Web Token in your browser and read its header, payload and " +
      "claims. Expiry is checked against your clock. Nothing is ever uploaded.",
    category: "developer",
    audience: ["developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "jwt decoder",
      "decode jwt",
      "json web token decoder",
      "jwt parser",
      "read jwt claims",
      "jwt expiry checker",
    ],
    intro:
      "Paste a JSON Web Token and read what it contains: the header, every claim, " +
      "and whether it has expired. Timestamps become real dates. The token never " +
      "leaves this tab, which matters more here than on any other page.",
    howToUse: [
      "Paste the token into the box. A leading \"Bearer \" is stripped for you.",
      "Read the algorithm and expiry status on the row underneath.",
      "Check the claims table. Registered claims are labelled and exp, nbf and iat are shown as dates.",
      "Treat the signature as informational. Verifying it needs the signing key, so no browser tool can do it.",
      "Rotate any production token you paste into any website, including this one. A JWT is a live credential.",
    ],
    faqs: [
      {
        q: "Is it safe to paste a real JWT here?",
        a: "Decoding runs entirely in your browser and the token is never sent anywhere, which you can verify with devtools open. Even so, a token from a live system is a working credential, so rotating it afterwards is the safer habit.",
      },
      {
        q: "Why can't this verify the signature?",
        a: "Verifying requires the signing key, which only the issuing server has. A page claiming to verify is either asking you to hand over a production secret or is not really checking anything.",
      },
      {
        q: "Is the payload encrypted?",
        a: "No. It is base64url-encoded, which is an encoding rather than encryption and is trivially reversible. Never put anything confidential in a JWT payload.",
      },
    ],
    related: ["base64-encoder-decoder", "hash-generator"],
  },

  {
    slug: "password-generator",
    title: "Password Generator",
    metaTitle: "Strong Password Generator",
    description:
      "Generate strong random passwords or passphrases in your browser, using " +
      "the same cryptographic randomness your bank does. Nothing is transmitted.",
    category: "developer",
    audience: ["developers", "general"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "password generator",
      "strong password generator",
      "random password",
      "passphrase generator",
      "secure password generator",
    ],
    intro:
      "Generates a random password or a word-based passphrase, with the strength " +
      "shown in bits rather than as a vague colour bar. Every character comes " +
      "from your browser's cryptographic random number generator.",
    howToUse: [
      "Choose password for something going into a password manager, or passphrase for something you will type by hand.",
      "Drag the length slider. Sixteen characters or more is comfortably beyond brute force.",
      "Toggle the character sets you need. Some sites reject symbols, which is the main reason to turn any off.",
      "Turn on \"leave out look-alikes\" only if you will read the password off a screen, since it costs entropy.",
      "Copy it straight into your password manager, then press generate again so the value on screen is not the one you kept.",
    ],
    faqs: [
      {
        q: "Are these passwords sent anywhere?",
        a: "No. Generation happens in your browser using its built-in cryptographic randomness, with no network request involved. Closing the page discards the value entirely.",
      },
      {
        q: "Is a passphrase as strong as a random password?",
        a: "It can be, given enough words. Five words carry about thirty-nine bits, weaker than sixteen random characters, but far easier to type and remember: the right trade for a password you cannot store in a manager.",
      },
      {
        q: "Should I change my passwords regularly?",
        a: "Modern guidance says no, not on a schedule. NIST recommends changing a password only on evidence of compromise, because forced rotation pushes people towards small predictable edits.",
      },
    ],
    related: ["hash-generator", "jwt-decoder"],
  },

  {
    slug: "csv-to-json-converter",
    title: "CSV to JSON Converter",
    metaTitle: "CSV to JSON Converter",
    description:
      "Convert CSV to JSON and back in your browser, with correct handling of " +
      "quoted fields, embedded commas and newlines inside cells. Nothing uploads.",
    category: "developer",
    audience: ["developers", "small-business"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "csv to json",
      "json to csv",
      "csv converter",
      "convert csv to json online",
      "csv parser",
    ],
    intro:
      "Turns a CSV into an array of objects, or an array of objects back into a " +
      "CSV. Quoted fields, escaped quotes and newlines inside cells are handled " +
      "properly: the cases that silently corrupt data elsewhere.",
    howToUse: [
      "Pick a direction, then paste your data into the left box.",
      "Leave the delimiter on automatic unless the guess is wrong. Comma, semicolon, tab and pipe are all detected.",
      "Read the row and column count underneath to confirm it parsed the way you expected.",
      "Turn off \"convert numbers and booleans\" if you want every value kept as a string.",
      "Check any warnings shown: a ragged row or a duplicate column name means something will not survive the conversion intact.",
    ],
    faqs: [
      {
        q: "Does this handle commas inside quoted fields?",
        a: "Yes, along with escaped double quotes and newlines inside cells. The parser tracks quote state character by character rather than splitting on delimiters, which is what makes those cases work.",
      },
      {
        q: "Why is my number showing as text?",
        a: "Values with a leading zero are kept as strings on purpose, because they are almost always phone numbers, postcodes or reference codes. Turning 007 into 7 is a data-loss bug, not a convenience.",
      },
      {
        q: "Is my file uploaded to a server?",
        a: "No. Parsing and conversion both run in your browser, so the data never leaves your device. That matters, since most of what people convert is customer or financial records.",
      },
    ],
    related: ["json-formatter", "text-diff-checker", "base64-encoder-decoder"],
  },

  {
    slug: "uuid-generator",
    title: "UUID Generator",
    metaTitle: "UUID Generator: v4 and v7",
    description:
      "Generate UUIDs in your browser, one at a time or five hundred at once. " +
      "Version 4 for random ids, version 7 for time-ordered database keys.",
    category: "developer",
    audience: ["developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "uuid generator",
      "guid generator",
      "uuid v4",
      "uuid v7",
      "random uuid",
      "bulk uuid generator",
    ],
    intro:
      "Pick a version, pick how many, and copy them out. Every id is generated " +
      "by your own browser's cryptographic random source, so nothing is fetched " +
      "and nothing is logged.",
    howToUse: [
      "Choose v4 for a plain random id. It is the right default.",
      "Choose v7 if the id will be a database primary key, so rows sort by creation time.",
      "Set how many you need, up to 500 in one batch.",
      "Copy one with the button beside it, or use Copy all for the whole list.",
      "Press Generate again for a fresh set. Nothing is stored between batches.",
    ],
    faqs: [
      {
        q: "What is the difference between UUID v4 and v7?",
        a: "v4 is 122 random bits. v7 replaces the top 48 with a millisecond timestamp, so the ids sort by creation time as plain text while the rest stays random.",
      },
      {
        q: "Why does v7 matter for a database?",
        a: "A random key lands anywhere in a B-tree index, so inserts write all over it and the pages fragment. A time-ordered key appends instead, which is what the index is built for.",
      },
      {
        q: "When should I not use v7?",
        a: "Anywhere the id is public and the creation time is not. A v7 id tells anyone holding it when it was made, which is fine for a row and wrong for a password-reset link.",
      },
      {
        q: "Can two of these collide?",
        a: "Not in practice. v4 has 122 random bits, so you would need billions of ids before a collision becomes worth thinking about. Both versions use crypto.getRandomValues, never Math.random.",
      },
      {
        q: "Are these generated on your server?",
        a: "No. They come from your browser's own crypto API, in your tab. A server-generated id would be identical for every visitor and cached along the way, which is the opposite of what an id is for.",
      },
    ],
    related: ["hash-generator", "password-generator"],
  },

  {
    slug: "timestamp-converter",
    title: "Unix Timestamp Converter",
    metaTitle: "Unix Timestamp Converter",
    description:
      "Convert a Unix timestamp to a readable date, or a date back to epoch " +
      "seconds. Reads seconds and milliseconds, and tells you which it assumed.",
    category: "developer",
    audience: ["developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "unix timestamp converter",
      "epoch converter",
      "timestamp to date",
      "date to timestamp",
      "epoch time",
      "milliseconds to date",
    ],
    intro:
      "Paste a timestamp or a date and get every form of it at once: ISO 8601, " +
      "UTC, your own local time, and how long ago it was. It works out whether " +
      "your number is seconds or milliseconds, and says which it chose.",
    howToUse: [
      "Paste a Unix timestamp, or a date like 2026-08-20T14:30:00Z.",
      "A whole number is read as a timestamp. Anything else is read as a date.",
      "If the number could be either unit, the one it used is highlighted. Click the other to switch.",
      "Press Now to drop in the current timestamp.",
      "Copy any row with the button beside it.",
    ],
    faqs: [
      {
        q: "Is my timestamp in seconds or milliseconds?",
        a: "Ten digits is seconds, thirteen is milliseconds. This page reads anything at or above one hundred billion as milliseconds, and shows you which unit it picked so a wrong guess is visible.",
      },
      {
        q: "Why does my timestamp show 1970?",
        a: "Milliseconds were read as seconds, or the other way round. A millisecond value divided by a thousand lands close to the epoch. Switch the unit and it will be right.",
      },
      {
        q: "Why is the local time missing for a moment on load?",
        a: "Your timezone is only known once the page runs in your browser. Guessing it on the server would show one timezone's local time to everybody, so that row waits.",
      },
      {
        q: "Does it handle dates before 1970?",
        a: "Yes. Those are negative timestamps and are treated as ordinary values, not errors. The moon landing is -14182940 in seconds.",
      },
      {
        q: "Is the date sent anywhere?",
        a: "No. The conversion is arithmetic on the Date object your browser already has. The page works offline once loaded.",
      },
    ],
    related: ["uuid-generator", "json-formatter"],
  },

  {
    slug: "cron-explainer",
    title: "Cron Expression Explainer",
    metaTitle: "Cron Expression Explainer",
    description:
      "Paste a cron expression and read what it actually does, field by field, " +
      "with the next five run times in your own timezone.",
    category: "developer",
    audience: ["developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "cron expression",
      "crontab explainer",
      "cron schedule",
      "cron syntax",
      "next cron run",
      "cron generator",
    ],
    intro:
      "Cron syntax is five fields and one rule that surprises almost everyone. " +
      "Paste an expression to see it broken down in plain English, and the next " +
      "five times it will actually fire.",
    howToUse: [
      "Paste your expression, or press one of the examples to start from it.",
      "Read the sentence at the top. That is what the schedule really does.",
      "Check the field breakdown if a value looks wrong.",
      "The next five runs are shown in your own timezone, not the server's.",
      "Try the OR trap example if you have ever written a day-and-weekday schedule.",
    ],
    faqs: [
      {
        q: "Does 0 0 13 * 5 mean Friday the 13th?",
        a: "No, and this catches nearly everyone. When day-of-month and day-of-week are both set, cron ORs them: it runs on the 13th of every month and also on every Friday, about five times more often than intended.",
      },
      {
        q: "What are the five fields?",
        a: "Minute, hour, day of month, month, day of week, in that order. A star means every value. Some systems add a seconds field at the front, which this page does not read.",
      },
      {
        q: "Is Sunday 0 or 7?",
        a: "Both. Cron accepts either for Sunday, and real crontabs use both. This page treats 7 as 0 so an expression copied from anywhere behaves the same.",
      },
      {
        q: "What does the slash mean?",
        a: "A step. Slash-15 in the minute field means every fifteenth minute from the start of the range, so 0, 15, 30 and 45. You can put a step on a range too.",
      },
      {
        q: "Why does my schedule never run?",
        a: "Usually an impossible date, such as day 30 in February. The page tells you when a schedule can never fire rather than showing an empty list without explanation.",
      },
    ],
    related: ["timestamp-converter", "uuid-generator"],
  },
];

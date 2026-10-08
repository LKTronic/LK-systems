// Damerau-Levenshtein Deep Typo Tolerance & Electronics Relevance Engine
// Supports transpositions (pluse -> pulse), insertions (pulsee -> pulse),
// deletions (puse -> pulse), phonetic / consonant matches (diplay -> display, arduno -> arduino),
// dimension normalization (2.4 -> 2.4", 2.4inch), modifier-aware filtering, and in-stock priority ranking.

export const BASELINE_ELECTRONICS_VOCABULARY = [
  // Displays & Visuals
  "display", "displays", "screen", "screens", "touch", "tft", "lcd", "oled", "oleds",
  "nextion", "segment", "matrix", "epaper", "monochrome", "backlight", "hmi",

  // Core Boards & Microcontrollers
  "arduino", "uno", "nano", "mega", "pro", "mini", "leonardo", "esp32", "esp8266",
  "nodemcu", "wemos", "d1", "raspberry", "pi", "pico", "stm32", "bluepill", "attiny",
  "pic", "avr", "arm", "microcontroller", "devboard",

  // Modules & Controllers
  "module", "modules", "board", "boards", "shield", "shields", "breakout", "relay",
  "relays", "driver", "drivers", "controller", "controllers", "converter", "converters",
  "regulator", "inverter", "buck", "boost", "stepdown", "stepup", "timer", "rtc",

  // Sensors
  "sensor", "sensors", "proximity", "inductive", "capacitive", "temperature", "humidity",
  "pressure", "optical", "ultrasonic", "infrared", "flame", "motion", "pir", "hall",
  "gyroscope", "accelerometer", "compass", "gas", "smoke", "sound", "voice", "loadcell",
  "encoder", "encoders", "current", "voltage", "voltmeter", "ammeter", "multimeter",

  // Passive & Discrete Components
  "resistor", "resistors", "capacitor", "capacitors", "diode", "diodes", "transistor",
  "transistors", "mosfet", "mosfets", "igbt", "triac", "thyristor", "led", "leds",
  "rgb", "neopixel", "ws2812b", "smd", "inductor", "choke", "potentiometer", "trimmer",
  "fuse", "fuses", "crystal", "oscillator", "optocoupler", "transformer",

  // Electromechanical & Actuators
  "motor", "motors", "stepper", "servo", "bldc", "brushless", "dc", "gear", "vibration",
  "pump", "solenoid", "valve", "switch", "switches", "pushbutton", "rocker", "toggle",
  "dip", "microswitch", "tactile", "buzzer", "buzzers", "speaker", "amplifier",

  // Power & Energy
  "power", "supply", "battery", "batteries", "lithium", "lipo", "ion", "18650", "bms",
  "charger", "charging", "solar", "panel", "smps", "adapter", "adapters", "heat", "sink",

  // Connectivity & Wireless
  "bluetooth", "wifi", "wireless", "rf", "rfid", "nfc", "lora", "zigbee", "transceiver",
  "receiver", "transmitter", "antenna", "antennas", "gsm", "gprs", "gps",

  // Wiring, Interconnects & Prototyping
  "cable", "cables", "wire", "wires", "jumper", "connector", "connectors", "header",
  "terminal", "terminals", "block", "breadboard", "pcb", "perfboard", "stripboard",
  "socket", "jack", "plug", "dupont", "jst", "molex", "chassis", "enclosure", "spacer",

  // Brands & Industry Standards
  "omron", "autonics", "creality", "meanwell", "ti", "stmicro", "microchip", "atmel"
];

// In-memory cache for dynamic database vocabulary
let cachedDbVocabulary: Set<string> | null = null;
let lastVocabFetchTime = 0;
const VOCAB_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Calculates Damerau-Levenshtein distance between two strings
 * Handles: Insertion, Deletion, Substitution, and Transposition
 */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const al = a.length;
  const bl = b.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= bl; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= al; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bl; i++) {
    for (let j = 1; j <= al; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        if (
          i > 1 &&
          j > 1 &&
          b.charAt(i - 1) === a.charAt(j - 2) &&
          b.charAt(i - 2) === a.charAt(j - 1)
        ) {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1,     // deletion
            matrix[i - 2][j - 2] + 1  // transposition (e.g., pluse -> pulse)
          );
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
  }

  return matrix[bl][al];
}

/**
 * Strips vowels to test consonant-skeleton similarity (e.g. "dsply" -> "display", "sensr" -> "sensor")
 */
/**
 * Strips vowels to test consonant-skeleton similarity (e.g. "dsply" -> "display", "sensr" -> "sensor")
 */
function getConsonantSkeleton(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/[aeiou]/g, "");
}

/**
 * Normalizes unicode curly quotes, primes, and double apostrophes to standard ASCII quotes
 */
export function normalizeTextQuotes(str: string): string {
  if (!str) return "";
  return str
    .replace(/[\u201c\u201d\u2033\u201f]/g, '"')
    .replace(/[\u2018\u2019\u2032\u201b]/g, "'")
    .replace(/''/g, '"');
}

/**
 * Common English relational connectors in electronics search queries that should not be treated as literal keywords
 */
export const STOP_WORDS = new Set(["to", "for", "with", "and", "in", "of", "a", "an", "the"]);

export function isStopWord(token: string): boolean {
  return STOP_WORDS.has(token.toLowerCase().trim());
}

/**
 * Curated Electronics Domain Semantic Synonym Map
 * Maps industry concepts, IC codes, and voltage equivalents bidirectionally
 */
export const ELECTRONICS_SEMANTIC_SYNONYMS: Record<string, string[]> = {
  // AC Mains / Power Supply equivalents (220V, 230V, 240V, AC-DC are interchangeable in power supply context)
  "220v": ["220v", "230v", "240v", "220vac", "230vac", "240vac", "ac-dc", "ac/dc", "ac dc", "smps"],
  "230v": ["220v", "230v", "240v", "220vac", "230vac", "240vac", "ac-dc", "ac/dc", "ac dc", "smps"],
  "240v": ["220v", "230v", "240v", "220vac", "230vac", "240vac", "ac-dc", "ac/dc", "ac dc", "smps"],
  "110v": ["110v", "110vac", "ac-dc", "ac/dc", "ac dc", "smps"],
  "ac-dc": ["220v", "230v", "240v", "220vac", "230vac", "ac-dc", "ac/dc", "ac dc", "smps", "power supply"],
  "ac/dc": ["220v", "230v", "240v", "220vac", "230vac", "ac-dc", "ac/dc", "ac dc", "smps", "power supply"],
  "smps": ["power supply", "smps", "adapter", "ac-dc", "ac/dc"],
  "psu": ["power supply", "smps"],

  // Converter Architectures (Step-Down / Buck, Step-Up / Boost)
  "buck": ["step-down", "step down", "buck", "dc-dc", "regulator"],
  "step-down": ["buck", "step-down", "step down", "dc-dc", "regulator"],
  "stepdown": ["buck", "step-down", "step down", "dc-dc", "regulator"],
  "boost": ["step-up", "step up", "boost", "dc-dc", "stepup"],
  "step-up": ["boost", "step-up", "step up", "dc-dc", "stepup"],
  "stepup": ["boost", "step-up", "step up", "dc-dc", "stepup"],

  // Communication, Serial & Programmers (Customers search function "ttl", products use IC chip name)
  "ttl": ["uart", "serial", "ch340", "cp2102", "ft232", "pl2303"],
  "uart": ["ttl", "serial", "ch340", "cp2102", "ft232", "pl2303"],
  "serial": ["uart", "ttl", "rs232", "rs485"],
  "rs485": ["modbus", "max485", "rs-485", "rtu"],
  "rs232": ["max3232", "db9", "serial"],
  "modbus": ["rs485", "rtu", "tcp", "modbus"],

  // Microcontroller & IoT Aliases
  "nodemcu": ["esp8266", "nodemcu", "d1 mini", "wemos"],
  "esp8266": ["nodemcu", "esp8266", "d1 mini", "wemos", "esp-12"],
  "esp32": ["esp32", "wroom", "devkit", "esp-wroom-32", "esp-wroom"],
  "bluepill": ["stm32", "stm32f103", "stm32f103c8t6", "blue pill"],
  "stm32": ["blue pill", "bluepill", "stm32f103", "stm32f401", "stm32f411"],

  // Displays & Touch
  "hmi": ["touch screen", "touch panel", "samkoon", "nextion", "hmi"],
  "oled": ["ssd1306", "sh1106", "i2c display", "0.96", "1.3"],
  "16x2": ["1602", "16x2", "hd44780"],
  "1602": ["1602", "16x2", "hd44780"],
  "20x4": ["2004", "20x4"],
  "2004": ["2004", "20x4"],
};

export interface ConverterIntent {
  isConverterQuery: boolean;
  inputVoltage?: string;
  outputVoltage?: string;
  inputVariants: string[];
  outputVariants: string[];
}

/**
 * Parses queries like "220V to 5V", "230V to 5V", "24V to 12V", "12V to 5V step down"
 */
export function parseConverterIntent(query: string): ConverterIntent {
  const clean = normalizeTextQuotes(query.trim().toLowerCase());
  const match = clean.match(/(\d+(?:\.\d+)?\s*(?:v|vac|vdc|volt|volts)?)\s+(?:to|->|-)\s+(\d+(?:\.\d+)?\s*(?:v|vac|vdc|volt|volts)?)/i);
  if (!match) {
    return { isConverterQuery: false, inputVariants: [], outputVariants: [] };
  }

  let inVolt = match[1].trim();
  let outVolt = match[2].trim();

  if (/^\d+(\.\d+)?$/.test(inVolt)) inVolt += "v";
  if (/^\d+(\.\d+)?$/.test(outVolt)) outVolt += "v";

  const inputVariants = getDimensionVariants(inVolt);
  const outputVariants = getDimensionVariants(outVolt);

  // If input is AC mains (220v, 230v, 240v, 110v), expand to AC-DC power supply concepts
  if (/^(220|230|240|110)v$/i.test(inVolt)) {
    inputVariants.push("ac-dc", "ac/dc", "ac dc", "smps", "power supply", "hi-link", "hlk");
  }

  return {
    isConverterQuery: true,
    inputVoltage: inVolt,
    outputVoltage: outVolt,
    inputVariants: Array.from(new Set(inputVariants)),
    outputVariants: Array.from(new Set(outputVariants)),
  };
}

/**
 * Expands a token into common electronic unit, dimension, and semantic equivalents.
 * Example: "7inch" -> ["7inch", "7\"", "7 inch", "7-inch", "7.0\"", "7.0 inch", "070", "7in"]
 * Example: "220v" -> ["220v", "230v", "240v", "ac-dc", "ac/dc", "220vac", ...]
 */
export function getDimensionVariants(token: string): string[] {
  const clean = normalizeTextQuotes(token.toLowerCase().trim());
  const variants = new Set<string>([clean]);

  // Check electronics semantic synonyms
  const syns = ELECTRONICS_SEMANTIC_SYNONYMS[clean];
  if (syns) {
    syns.forEach((s) => variants.add(s));
  }

  // Match inch patterns: "7inch", "7\"", "7-inch", "7in", "2.4inch", "0.96inch", "2.4\""
  const inchMatch = clean.match(/^(\d+(\.\d+)?)\s*(inch|inches|"|in|-inch)?$/i);
  if (inchMatch) {
    const num = inchMatch[1];
    const hasDecimal = num.includes(".");

    variants.add(`${num}"`);
    variants.add(`${num} inch`);
    variants.add(`${num}inch`);
    variants.add(`${num}-inch`);
    variants.add(`${num}in`);
    variants.add(`${num} in`);

    if (!hasDecimal) {
      variants.add(`${num}.0"`);
      variants.add(`${num}.0 inch`);
      variants.add(`${num}.0inch`);
      variants.add(`${num}.0-inch`);
      // HMI model code conventions (e.g. 7" -> 070)
      if (num === "7") {
        variants.add("070");
        variants.add("sk-070");
        variants.add("ea-070");
        variants.add("gt-070");
      } else if (num === "4") {
        variants.add("043");
      } else if (num === "10") {
        variants.add("101");
        variants.add("102");
      }
    } else {
      const strippedDot = num.replace(".", "");
      if (strippedDot.length <= 4) {
        variants.add(strippedDot);
      }
      if (num === "4.3") variants.add("043");
      if (num === "7.0") {
        variants.add("070");
        variants.add('7"');
        variants.add("7 inch");
        variants.add("7-inch");
      }
      if (num === "10.1" || num === "10.2") {
        variants.add("101");
        variants.add("102");
      }
    }
  }

  // Match resistance: "10k", "10kohm", "4.7k", "220r", "100ohm"
  const resMatch = clean.match(/^(\d+(\.\d+)?)\s*(k|kohm|k\u03a9|m|mohm|r|ohm|\u03a9)$/i);
  if (resMatch) {
    const val = resMatch[1];
    const unit = resMatch[3].toLowerCase();
    if (unit === "k" || unit === "kohm" || unit === "k\u03a9") {
      variants.add(`${val}k`);
      variants.add(`${val} k`);
      variants.add(`${val}kohm`);
      variants.add(`${val} kohm`);
    } else if (unit === "r" || unit === "ohm" || unit === "\u03a9") {
      variants.add(`${val}r`);
      variants.add(`${val} r`);
      variants.add(`${val}ohm`);
      variants.add(`${val} ohm`);
    }
  }

  // Match capacitance: "100uf", "10uf", "22pf"
  const capMatch = clean.match(/^(\d+(\.\d+)?)\s*(uf|u|mfd|nf|pf)$/i);
  if (capMatch) {
    const val = capMatch[1];
    const unit = capMatch[3].toLowerCase();
    variants.add(`${val}${unit}`);
    variants.add(`${val} ${unit}`);
    if (unit === "uf" || unit === "u") {
      variants.add(`${val}uf`);
      variants.add(`${val} uf`);
      variants.add(`${val}u`);
    }
  }

  // Match voltage: "5v", "12v", "24v", "3.3v", "220v", "230v"
  const voltMatch = clean.match(/^(\d+(\.\d+)?)\s*(v|vac|vdc|volt|volts)$/i);
  if (voltMatch) {
    const val = voltMatch[1];
    variants.add(`${val}v`);
    variants.add(`${val} v`);
    variants.add(`${val}volt`);
    variants.add(`${val} volt`);
    variants.add(`${val}vac`);
    variants.add(`${val}vdc`);
    // AC mains cross-mapping
    if (val === "220" || val === "230" || val === "240") {
      variants.add("220v");
      variants.add("230v");
      variants.add("240v");
      variants.add("220vac");
      variants.add("230vac");
      variants.add("ac-dc");
      variants.add("ac/dc");
      variants.add("ac dc");
    }
  }

  // Model codes with/without hyphens: e.g. "sk070" -> "sk-070"
  const codeMatch = clean.match(/^([a-z]+)(\d+.*)$/i);
  if (codeMatch && !clean.includes("-") && clean.length >= 4) {
    variants.add(`${codeMatch[1]}-${codeMatch[2]}`);
  }

  return Array.from(variants);
}

/**
 * Checks if a token is a dimension, number, or electrical modifier (e.g. "2.4", "7inch", "5v", "16x2", "0.96")
 */
export function isModifierToken(token: string): boolean {
  const clean = normalizeTextQuotes(token.toLowerCase().trim());
  // Pure digits: "2", "4", "7", "12", "24"
  if (/^\d+$/.test(clean)) return true;
  // Decimal or dimensions: "2.4", "0.96", "1.3", "3.5", "16x2", "20x4"
  if (/^\d+\.\d+([a-z"']*)?$/i.test(clean)) return true;
  if (/^\d+x\d+$/i.test(clean)) return true;
  // Inch variations: "7inch", "7in", "7\"", "7-inch"
  if (/^\d+(\.\d+)?\s*(inch|inches|"|in|-inch)$/i.test(clean)) return true;
  // Units: "5v", "12v", "3.3v", "10k", "100uf", "16mhz", "2a", "2.4a", "100r", "10kohm"
  if (/^\d+(\.\d+)?[a-z%\u03a9\u00b5]+$/i.test(clean)) return true;
  return false;
}

/**
 * Finds the closest matching word in the vocabulary for a misspelled token with deep typo tolerance
 */
export function findClosestWord(token: string, vocabulary: Iterable<string>): string | null {
  const clean = token.toLowerCase().trim();
  if (clean.length < 3) return null; // Don't fuzzy-correct tiny 1-2 letter acronyms
  if (isModifierToken(clean)) return null; // Preserve numbers & dimensions as-is

  let bestMatch: string | null = null;
  let lowestDistance = Infinity;

  // Adaptive edit distance:
  // length 3-4: 1 distance
  // length 5-7: 2 distance (e.g. "diplay" -> "display" is dist 1, "arduno" -> "arduino" is dist 1)
  // length 8+: 3 distance (e.g. "potentiomter" -> "potentiometer" is dist 1)
  const maxDistance = clean.length <= 4 ? 1 : clean.length <= 7 ? 2 : 3;
  const cleanSkeleton = getConsonantSkeleton(clean);

  for (const word of vocabulary) {
    if (word === clean) return word; // Exact match found

    // Fast length check: if lengths differ by more than maxDistance, skip
    if (Math.abs(word.length - clean.length) > maxDistance) {
      // Check consonant skeleton fallback for dropped vowels (e.g. "dsply" -> "display")
      if (cleanSkeleton.length >= 3 && getConsonantSkeleton(word) === cleanSkeleton) {
        return word;
      }
      continue;
    }

    // Prefix match priority (e.g. "displ" -> "display")
    if (clean.length >= 4 && word.startsWith(clean)) {
      return word;
    }

    const dist = damerauLevenshtein(clean, word);
    if (dist <= maxDistance && dist < lowestDistance) {
      lowestDistance = dist;
      bestMatch = word;
      // If distance is 1 and starts with same character, it's an immediate high-confidence match
      if (dist === 1 && clean[0] === word[0]) {
        break;
      }
    }
  }

  return bestMatch;
}

/**
 * Checks a multi-word search query for typos and suggests corrections
 */
export function getFuzzySuggestion(
  query: string,
  vocabulary: Iterable<string>
): { correctedQuery: string; hasCorrection: boolean; tokens: string[]; correctedTokens: string[] } {
  const trimmed = query.trim();
  if (!trimmed) {
    return { correctedQuery: query, hasCorrection: false, tokens: [], correctedTokens: [] };
  }

  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  let hasCorrection = false;

  const correctedTokens = rawTokens.map((token) => {
    // Preserve SKUs like PMS-0012 or modifiers like "2.4" or "7inch"
    if (/^[A-Za-z]+-\d+$/i.test(token) || isModifierToken(token)) {
      return token;
    }

    const match = findClosestWord(token, vocabulary);
    if (match && match.toLowerCase() !== token.toLowerCase()) {
      hasCorrection = true;
      return match;
    }
    return token;
  });

  return {
    correctedQuery: hasCorrection ? correctedTokens.join(" ") : trimmed,
    hasCorrection,
    tokens: rawTokens,
    correctedTokens,
  };
}

export interface ScorableProduct {
  id?: number;
  productName: string;
  modelAndName?: string | null;
  sku?: string | null;
  recordNo?: string | null;
  referenceNo?: string | null;
  categoryNames?: string | null;
  category?: { id?: number; name: string } | null;
  description?: string | null;
  supplierNote?: string | null;
  additionalNote?: string | null;
  quantity?: number;
  stockStatus?: string | null;
  shippingClass?: string | null;
}

/**
 * Determines if a product is currently available in stock.
 */
export function isProductAvailable(product: {
  quantity?: number | null;
  stockStatus?: string | null;
}): boolean {
  const qty = typeof product.quantity === "number" ? product.quantity : Number(product.quantity || 0);
  const isOutOfStock = product.stockStatus === "outofstock";
  return qty > 0 && !isOutOfStock;
}

/**
 * Tests if a specific token or dimension matches inside a target text.
 * Normalizes unicode quotes and evaluates all dimension / unit variants.
 */
export function tokenMatchesText(token: string, targetText: string): boolean {
  if (!targetText || !token) return false;
  const t = normalizeTextQuotes(token.toLowerCase().trim());
  const rawText = targetText.toLowerCase();
  const text = normalizeTextQuotes(rawText);

  // 1. Direct substring
  if (rawText.includes(t) || text.includes(t)) return true;

  // 2. Compact alphanumeric check (e.g. "sk070" matches "sk-070", "e2bm12" matches "e2b-m12ks04")
  const compactToken = t.replace(/[^a-z0-9]/g, "");
  const compactText = text.replace(/[^a-z0-9]/g, "");
  if (compactToken.length >= 3 && compactText.includes(compactToken)) {
    return true;
  }

  // 3. Dimension & Unit variants check (e.g. "7inch" matches "7\"", "7.0 inch", "070")
  const variants = getDimensionVariants(t);
  for (const v of variants) {
    const vLower = v.toLowerCase();
    if (rawText.includes(vLower) || text.includes(vLower)) {
      return true;
    }
    // Word boundary check for 3-digit model codes like "070"
    if (vLower === "070" && /(?:^|[^0-9])070(?:[^0-9]|$)/.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates a weighted relevance score for an electronic product against a search query.
 * Returns 0 if the product does not match, or a positive integer score where higher = better match.
 * Strongly boosts items that are in stock so the shop counter user sees available products first.
 */
export function scoreProductRelevance(
  query: string,
  product: ScorableProduct,
  vocabulary?: Iterable<string>
): number {
  const cleanQuery = normalizeTextQuotes(query.trim().toLowerCase());
  if (!cleanQuery) return 1;

  const sku = normalizeTextQuotes((product.sku || "").trim().toLowerCase());
  const recordNo = normalizeTextQuotes((product.recordNo || "").trim().toLowerCase());
  const refNo = normalizeTextQuotes((product.referenceNo || "").trim().toLowerCase());
  const name = normalizeTextQuotes((product.modelAndName || product.productName || "").trim().toLowerCase());
  const rawName = normalizeTextQuotes((product.productName || "").trim().toLowerCase());
  const desc = normalizeTextQuotes((product.description || "").trim().toLowerCase());
  const cat = normalizeTextQuotes((product.categoryNames || product.category?.name || "").trim().toLowerCase());
  const notes = normalizeTextQuotes(`${product.supplierNote || ""} ${product.additionalNote || ""}`.trim().toLowerCase());

  const fullText = `${sku} ${recordNo} ${refNo} ${name} ${rawName} ${cat} ${desc} ${notes}`;

  let score = 0;

  // 1. Exact SKU / Reference Match (Highest Priority: +200)
  if (sku === cleanQuery || recordNo === cleanQuery || refNo === cleanQuery) {
    score += 200;
  } else if (sku.startsWith(cleanQuery) || recordNo.startsWith(cleanQuery)) {
    score += 120;
  } else if (sku.includes(cleanQuery) || recordNo.includes(cleanQuery)) {
    score += 90;
  }

  // Compact alphanumerics check (e.g. "e2bm12" matches "e2b-m12ks04")
  const compactQuery = cleanQuery.replace(/[^a-z0-9]/g, "");
  const compactSku = sku.replace(/[^a-z0-9]/g, "");
  if (compactQuery.length >= 3 && compactSku.includes(compactQuery)) {
    score += 80;
  }

  // 2. Exact Full Name Match (+150)
  if (name === cleanQuery || rawName === cleanQuery) {
    score += 150;
  } else if (name.startsWith(cleanQuery)) {
    score += 100;
  } else if (name.includes(cleanQuery)) {
    score += 70;
  }

  // 3. Converter Intent Recognition (e.g. "220V to 5V", "230V to 5V", "24V to 12V", "12V to 5V step down")
  const converter = parseConverterIntent(cleanQuery);
  if (converter.isConverterQuery) {
    const inputMatches = converter.inputVariants.some((v) => tokenMatchesText(v, fullText));
    const outputMatches = converter.outputVariants.some((v) => tokenMatchesText(v, fullText));

    // Both input conversion and output voltage must match
    if (inputMatches && outputMatches) {
      score += 350;
      if (converter.outputVariants.some((v) => tokenMatchesText(v, name))) {
        score += 80;
      }
      if (converter.inputVariants.some((v) => tokenMatchesText(v, name))) {
        score += 60;
      }
      // Check for conversion intent keywords like "step down", "buck", "power supply", "hlk"
      if (/step[- ]down|buck|power supply|converter|smps/i.test(fullText)) {
        score += 40;
      }
      if (/step[- ]down|buck|power supply|converter|smps/i.test(name)) {
        score += 80;
      }

      // If query explicitly asked for step down / buck, enforce architecture match
      if (/step[- ]down|buck/i.test(cleanQuery)) {
        if (/step[- ]down|buck/i.test(name)) {
          score += 150;
        } else if (!/step[- ]down|buck/i.test(fullText)) {
          return 0;
        }
      }
      // If query explicitly asked for step up / boost, enforce architecture match
      if (/step[- ]up|boost/i.test(cleanQuery)) {
        if (/step[- ]up|boost/i.test(name)) {
          score += 150;
        } else if (!/step[- ]up|boost/i.test(fullText)) {
          return 0;
        }
      }

      if (isProductAvailable(product)) {
        score += 80;
      }
      return score;
    } else {
      // If user typed a specific converter query like "220V to 5V", do not match products missing either voltage
      return 0;
    }
  }

  // 4. Multi-token breakdown & Deep Typo Matching (Stop-words like "to", "for" filtered out)
  const vocab = vocabulary || BASELINE_ELECTRONICS_VOCABULARY;
  const fuzzy = getFuzzySuggestion(cleanQuery, vocab);
  const rawTokens = fuzzy.tokens;
  const rawCorrected = fuzzy.correctedTokens;

  // Filter out stop words so connectors like "to" do not penalize searches
  const activeTokens: string[] = [];
  const correctedTokens: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    if (!isStopWord(rawTokens[i])) {
      activeTokens.push(rawTokens[i]);
      correctedTokens.push(rawCorrected[i]);
    }
  }

  if (activeTokens.length > 0) {
    let matchedTokenCount = 0;
    let matchedCoreNounCount = 0;
    let totalCoreNounCount = 0;
    let matchedModifierCount = 0;
    let totalModifierCount = 0;

    for (let i = 0; i < activeTokens.length; i++) {
      const origToken = activeTokens[i];
      const corrToken = correctedTokens[i];
      const isModifier = isModifierToken(origToken);

      if (isModifier) {
        totalModifierCount++;
      } else {
        totalCoreNounCount++;
      }

      let tokenMatched = false;

      // Exact, semantic synonym, or dimension match on original token
      if (tokenMatchesText(origToken, fullText)) {
        tokenMatched = true;
        if (tokenMatchesText(origToken, name)) {
          score += isModifier ? 40 : 50;
        } else {
          score += isModifier ? 25 : 30;
        }
      }
      // Typo-corrected token match (e.g. "diplay" -> "display")
      else if (corrToken !== origToken && tokenMatchesText(corrToken, fullText)) {
        tokenMatched = true;
        if (tokenMatchesText(corrToken, name)) {
          score += 45;
        } else {
          score += 25;
        }
      } else {
        // Deep typo check on the token directly against product text words
        const closestWord = findClosestWord(origToken, vocab);
        if (closestWord && tokenMatchesText(closestWord, fullText)) {
          tokenMatched = true;
          score += 35;
        }
      }

      if (tokenMatched) {
        matchedTokenCount++;
        if (isModifier) {
          matchedModifierCount++;
        } else {
          matchedCoreNounCount++;
        }
      }
    }

    // STRICT NON-MATCH FILTER 1:
    // When multiple core nouns are searched (e.g. "samkoon hmi"), all core nouns must match.
    // Prevents showing unrelated Samkoon VFDs, motors, or PLC cables when searching for HMIs.
    if (totalCoreNounCount >= 2 && matchedCoreNounCount < totalCoreNounCount) {
      return 0;
    }
    if (totalCoreNounCount === 1 && matchedCoreNounCount === 0) {
      return 0;
    }

    // STRICT NON-MATCH FILTER 2:
    // If the user specified a dimension/modifier (e.g. "7inch" in "samkoon hmi 7inch"),
    // the product MUST match that dimension. Do not show 4.3" or 10.2" panels!
    if (totalModifierCount > 0 && matchedModifierCount === 0) {
      return 0;
    }

    // If query has core nouns but matched 0 core nouns, discard
    if (totalCoreNounCount > 0 && matchedCoreNounCount === 0) {
      return 0;
    }

    // All tokens matched: massive relevance boost (+250)
    if (matchedTokenCount === activeTokens.length) {
      score += 250;
    } else if (matchedTokenCount > 0 && matchedTokenCount / activeTokens.length >= 0.5) {
      score += 40;
    } else if (matchedTokenCount === 0 && score === 0) {
      return 0;
    }
  }

  // 5. In-Stock Priority Boost (+80 points)
  if (isProductAvailable(product)) {
    score += 80;
  }

  return score;
}

/**
 * Loads vocabulary dynamically from database product names and categories,
 * merged with baseline electronics terminology.
 */
export async function getDynamicVocabulary(prismaClient: any): Promise<Set<string>> {
  const now = Date.now();
  if (cachedDbVocabulary && now - lastVocabFetchTime < VOCAB_CACHE_TTL) {
    return cachedDbVocabulary;
  }

  const vocab = new Set<string>(BASELINE_ELECTRONICS_VOCABULARY);

  try {
    const products = await prismaClient.product.findMany({
      select: { productName: true, modelAndName: true },
      take: 1200,
      orderBy: { createdAt: "desc" },
    });

    for (const p of products) {
      if (p.productName) {
        p.productName.split(/[\s,./\-_()]+/).forEach((w: string) => {
          const clean = w.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (clean.length >= 3 && !isModifierToken(clean)) {
            vocab.add(clean);
          }
        });
      }
      if (p.modelAndName) {
        p.modelAndName.split(/[\s,./\-_()]+/).forEach((w: string) => {
          const clean = w.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (clean.length >= 3 && !isModifierToken(clean)) {
            vocab.add(clean);
          }
        });
      }
    }

    cachedDbVocabulary = vocab;
    lastVocabFetchTime = now;
  } catch (err) {
    console.warn("Could not load dynamic vocabulary from DB, using baseline vocabulary:", err);
  }

  return vocab;
}

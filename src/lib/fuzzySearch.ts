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
function getConsonantSkeleton(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/[aeiou]/g, "");
}

/**
 * Checks if a token is a dimension, number, or electrical modifier (e.g. "2.4", "5v", "16x2", "0.96")
 */
export function isModifierToken(token: string): boolean {
  const clean = token.toLowerCase().trim();
  // Pure digits: "2", "4", "12", "24"
  if (/^\d+$/.test(clean)) return true;
  // Decimal or dimensions: "2.4", "0.96", "1.3", "3.5", "16x2", "20x4"
  if (/^\d+\.\d+([a-z"']*)?$/i.test(clean)) return true;
  if (/^\d+x\d+$/i.test(clean)) return true;
  // Units: "5v", "12v", "3.3v", "10k", "100uf", "16mhz", "2a", "2.4a"
  if (/^\d+(\.\d+)?[a-z%]+$/i.test(clean)) return true;
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

  const rawTokens = trimmed.split(/[\s,+/_\-:]+/).filter(Boolean);
  let hasCorrection = false;

  const correctedTokens = rawTokens.map((token) => {
    // Preserve SKUs like PMS-0012 or modifiers like "2.4"
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
    correctedQuery: correctedTokens.join(" "),
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
}

/**
 * Tests if a specific token or dimension matches inside a target text.
 * Special support for dimensions like "2.4" matching "2.4", "2.4\"", "2.4inch", "2.4-inch", "2.4 in".
 */
function tokenMatchesText(token: string, targetText: string): boolean {
  if (!targetText || !token) return false;
  const t = token.toLowerCase();
  const text = targetText.toLowerCase();

  // 1. Direct substring
  if (text.includes(t)) return true;

  // 2. Dimension normalization: if token is decimal like "2.4", check for inch notations
  if (/^\d+\.\d+$/.test(t)) {
    if (
      text.includes(`${t}"`) ||
      text.includes(`${t} inch`) ||
      text.includes(`${t}inch`) ||
      text.includes(`${t}-inch`) ||
      text.includes(`${t}in`) ||
      text.includes(`${t}'`)
    ) {
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
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return 1;

  const sku = (product.sku || "").trim().toLowerCase();
  const recordNo = (product.recordNo || "").trim().toLowerCase();
  const refNo = (product.referenceNo || "").trim().toLowerCase();
  const name = (product.modelAndName || product.productName || "").trim().toLowerCase();
  const rawName = (product.productName || "").trim().toLowerCase();
  const desc = (product.description || "").trim().toLowerCase();
  const cat = (product.categoryNames || product.category?.name || "").trim().toLowerCase();
  const notes = `${product.supplierNote || ""} ${product.additionalNote || ""}`.trim().toLowerCase();

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

  // 3. Multi-token breakdown & Deep Typo Matching
  const vocab = vocabulary || BASELINE_ELECTRONICS_VOCABULARY;
  const fuzzy = getFuzzySuggestion(cleanQuery, vocab);
  const activeTokens = fuzzy.tokens;
  const correctedTokens = fuzzy.correctedTokens;

  if (activeTokens.length > 0) {
    let matchedTokenCount = 0;
    let matchedCoreNounCount = 0;
    let totalCoreNounCount = 0;

    for (let i = 0; i < activeTokens.length; i++) {
      const origToken = activeTokens[i];
      const corrToken = correctedTokens[i];
      const isModifier = isModifierToken(origToken);

      if (!isModifier) {
        totalCoreNounCount++;
      }

      let tokenMatched = false;

      // Exact or dimension match on original token
      if (tokenMatchesText(origToken, fullText)) {
        tokenMatched = true;
        if (tokenMatchesText(origToken, name)) {
          score += isModifier ? 35 : 50;
        } else {
          score += isModifier ? 20 : 30;
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
        if (!isModifier) {
          matchedCoreNounCount++;
        }
      }
    }

    // CRITICAL FILTER:
    // If the search contains core component nouns (e.g. "display" in "diplay 2.4"),
    // but the product ONLY matched an unrelated number/modifier (e.g. "2.4" in a 2.4GHz antenna),
    // DISCARD IT COMPLETELY (score = 0)!
    if (totalCoreNounCount > 0 && matchedCoreNounCount === 0) {
      return 0;
    }

    // All tokens matched: massive relevance boost (+250)
    if (matchedTokenCount === activeTokens.length) {
      score += 250;
    } else if (matchedTokenCount > 0 && matchedTokenCount / activeTokens.length >= 0.5) {
      score += 40;
    } else if (matchedTokenCount === 0 && score === 0) {
      return 0; // No tokens matched
    }
  }

  // 4. In-Stock Priority Boost (+80 points)
  // Ensures shop attendants always see currently available stock at the very top of search results!
  const hasQuantity = typeof product.quantity === "number" && product.quantity > 0;
  const isStockAvailable = product.stockStatus !== "outofstock" && hasQuantity;

  if (isStockAvailable) {
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

// Damerau-Levenshtein Typo Tolerance and Suggestion Engine
// Supports transpositions (pluse -> pulse), insertions (pulsee -> pulse),
// deletions (puse -> pulse), and substitutions (senser -> sensor).

export const BASELINE_ELECTRONICS_VOCABULARY = [
  "pulse", "sensor", "arduino", "module", "relay", "capacitor", "resistor",
  "battery", "display", "adapter", "switch", "transistor", "transformer",
  "controller", "converter", "voltage", "current", "cable", "motor", "driver",
  "connector", "terminal", "breadboard", "jumper", "wire", "diode", "led",
  "buzzer", "potentiometer", "lcd", "oled", "tft", "esp32", "esp8266", "nodemcu",
  "stm32", "raspberry", "pi", "stepper", "servo", "power", "supply", "charger",
  "inverter", "solar", "fuse", "heat", "sink", "bluetooth", "wifi", "wireless",
  "rfid", "nfc", "ultrasonic", "infrared", "optical", "encoder", "voltmeter",
  "ammeter", "multimeter", "tester", "amplifier", "receiver", "transmitter"
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
 * Finds the closest matching word in the vocabulary for a misspelled token
 */
export function findClosestWord(token: string, vocabulary: Iterable<string>): string | null {
  const clean = token.toLowerCase().trim();
  if (clean.length < 3) return null; // Don't fuzzy-correct tiny 1-2 letter acronyms

  let bestMatch: string | null = null;
  let lowestDistance = Infinity;

  // Maximum allowed edit distance based on word length
  const maxDistance = clean.length <= 4 ? 1 : 2;

  for (const word of vocabulary) {
    // Fast length filter: if lengths differ by more than maxDistance, skip
    if (Math.abs(word.length - clean.length) > maxDistance) continue;

    if (word === clean) return word; // Exact match found

    const dist = damerauLevenshtein(clean, word);
    if (dist <= maxDistance && dist < lowestDistance) {
      lowestDistance = dist;
      bestMatch = word;
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
): { correctedQuery: string; hasCorrection: boolean } {
  const trimmed = query.trim();
  if (!trimmed) {
    return { correctedQuery: query, hasCorrection: false };
  }

  const tokens = trimmed.split(/\s+/);
  let hasCorrection = false;

  const correctedTokens = tokens.map((token) => {
    // Preserve SKUs like PMS-0012 or numbers as-is
    if (/^[A-Za-z]+-\d+$/i.test(token) || /^\d+$/.test(token)) {
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
}

/**
 * Calculates a weighted relevance score for an electronic product against a search query.
 * Returns 0 if the product does not match, or a positive integer score where higher = better match.
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

  let score = 0;

  // 1. Exact SKU / Reference Match (Highest Priority: +150)
  if (sku === cleanQuery || recordNo === cleanQuery || refNo === cleanQuery) {
    score += 150;
  } else if (sku.startsWith(cleanQuery) || recordNo.startsWith(cleanQuery)) {
    score += 90;
  } else if (sku.includes(cleanQuery) || recordNo.includes(cleanQuery)) {
    score += 70;
  }

  // Compact alphanumerics check (e.g. "e2bm12" matches "e2b-m12ks04")
  const compactQuery = cleanQuery.replace(/[^a-z0-9]/g, "");
  const compactSku = sku.replace(/[^a-z0-9]/g, "");
  if (compactQuery.length >= 3 && compactSku.includes(compactQuery)) {
    score += 65;
  }

  // 2. Exact Full Name Match (+120)
  if (name === cleanQuery || rawName === cleanQuery) {
    score += 120;
  } else if (name.startsWith(cleanQuery)) {
    score += 85;
  } else if (name.includes(cleanQuery)) {
    score += 60;
  }

  // 3. Multi-token breakdown & matching
  const tokens = cleanQuery.split(/[\s,+/_\-:]+/).filter(Boolean);
  if (tokens.length > 0) {
    let matchedTokenCount = 0;
    const vocab = vocabulary || BASELINE_ELECTRONICS_VOCABULARY;

    for (const token of tokens) {
      let tokenMatched = false;

      // Exact token in SKU
      if (sku.includes(token) || recordNo.includes(token)) {
        score += 25;
        tokenMatched = true;
      }

      // Word boundary match in name (e.g. "relay" matching "... 5V Relay Module ...")
      const wordRegex = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (wordRegex.test(name)) {
        score += 25;
        tokenMatched = true;
      } else if (name.includes(token)) {
        score += 15;
        tokenMatched = true;
      } else if (cat.includes(token)) {
        score += 10;
        tokenMatched = true;
      } else if (desc.includes(token) || notes.includes(token)) {
        score += 6;
        tokenMatched = true;
      } else {
        // Typo tolerance check for electronics words (e.g. "arduno" -> "arduino")
        const closest = findClosestWord(token, vocab);
        if (closest && (name.includes(closest) || desc.includes(closest) || cat.includes(closest))) {
          score += 14;
          tokenMatched = true;
        }
      }

      if (tokenMatched) {
        matchedTokenCount++;
      }
    }

    // Bonus for matching all search tokens
    if (matchedTokenCount === tokens.length) {
      score += 50; // All tokens found in product
    } else if (matchedTokenCount > 0 && matchedTokenCount / tokens.length >= 0.6) {
      score += 20; // Majority of tokens found
    } else if (matchedTokenCount === 0 && score === 0) {
      return 0; // No match
    }
  }

  // 4. In-Stock tie-breaker
  if (product.quantity && product.quantity > 0) {
    score += 2;
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
      take: 1000,
      orderBy: { createdAt: "desc" },
    });

    for (const p of products) {
      if (p.productName) {
        p.productName.split(/[\s,./\-_()]+/).forEach((w: string) => {
          const clean = w.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (clean.length >= 3 && !/^\d+$/.test(clean)) {
            vocab.add(clean);
          }
        });
      }
      if (p.modelAndName) {
        p.modelAndName.split(/[\s,./\-_()]+/).forEach((w: string) => {
          const clean = w.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (clean.length >= 3 && !/^\d+$/.test(clean)) {
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

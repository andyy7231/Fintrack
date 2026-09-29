import { CategoryService } from "./category.service";

/**
 * Smart Category Matcher Service
 * 
 * Provides intelligent category matching with:
 * - Built-in mapping for common Indonesian keywords
 * - Fuzzy string matching for typo tolerance
 * - Auto-creation of new categories when no match found
 */

// ─── Built-in Keyword Mapping ─────────────────────────────────────────────────
// Maps common Indonesian terms to standard category names
const CATEGORY_KEYWORD_MAP: Record<string, string> = {
  // Savings & Investment
  "nabung": "Tabungan",
  "menabung": "Tabungan",
  "tabung": "Tabungan",
  "saving": "Tabungan",
  "investasi": "Investasi",
  "invest": "Investasi",
  "saham": "Investasi",
  "reksadana": "Investasi",
  
  // Food & Beverage
  "makan": "Makanan & Minuman",
  "minum": "Makanan & Minuman",
  "makanan": "Makanan & Minuman",
  "minuman": "Makanan & Minuman",
  "kuliner": "Makanan & Minuman",
  "food": "Makanan & Minuman",
  "cafe": "Makanan & Minuman",
  "kopi": "Makanan & Minuman",
  "resto": "Makanan & Minuman",
  "restoran": "Makanan & Minuman",
  "warteg": "Makanan & Minuman",
  "jajan": "Makanan & Minuman",
  
  // Transportation
  "transport": "Transportasi",
  "transportasi": "Transportasi",
  "bensin": "Transportasi",
  "bbm": "Transportasi",
  "ojek": "Transportasi",
  "grab": "Transportasi",
  "gojek": "Transportasi",
  "taxi": "Transportasi",
  "taksi": "Transportasi",
  "parkir": "Transportasi",
  "tol": "Transportasi",
  
  // Housing
  "rumah": "Tempat Tinggal",
  "kos": "Tempat Tinggal",
  "kost": "Tempat Tinggal",
  "sewa": "Tempat Tinggal",
  "kontrakan": "Tempat Tinggal",
  "housing": "Tempat Tinggal",
  
  // Utilities & Bills
  "listrik": "Tagihan & Utilitas",
  "air": "Tagihan & Utilitas",
  "pdam": "Tagihan & Utilitas",
  "wifi": "Tagihan & Utilitas",
  "internet": "Tagihan & Utilitas",
  "pulsa": "Tagihan & Utilitas",
  "paket": "Tagihan & Utilitas",
  "kuota": "Tagihan & Utilitas",
  "token": "Tagihan & Utilitas",
  "iuran": "Tagihan & Utilitas",
  "tagihan": "Tagihan & Utilitas",
  
  // Shopping
  "belanja": "Belanja",
  "shopping": "Belanja",
  "beli": "Belanja",
  
  // Health
  "kesehatan": "Kesehatan",
  "obat": "Kesehatan",
  "dokter": "Kesehatan",
  "rumahsakit": "Kesehatan",
  "klinik": "Kesehatan",
  "apotek": "Kesehatan",
  "health": "Kesehatan",
  
  // Entertainment
  "hiburan": "Hiburan",
  "nonton": "Hiburan",
  "film": "Hiburan",
  "bioskop": "Hiburan",
  "game": "Hiburan",
  "netflix": "Hiburan",
  "spotify": "Hiburan",
  "entertainment": "Hiburan",
  
  // Education
  "pendidikan": "Pendidikan",
  "buku": "Pendidikan",
  "kursus": "Pendidikan",
  "les": "Pendidikan",
  "sekolah": "Pendidikan",
  "kuliah": "Pendidikan",
  "education": "Pendidikan",
};

// ─── Fuzzy String Matching ────────────────────────────────────────────────────
/**
 * Calculate Levenshtein distance (edit distance) between two strings
 * Used for typo tolerance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score (0-100) between two strings
 */
function similarityScore(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 100;
  
  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  const score = ((longer.length - distance) / longer.length) * 100;
  
  return Math.round(score);
}

// ─── Smart Category Matching ───────────────────────────────────────────────────
export interface SmartCategoryMatch {
  categoryId: string;
  categoryName: string;
  matchType: "exact" | "keyword" | "fuzzy" | "created";
  confidence: number; // 0-100
  isNewCategory: boolean;
}

export class SmartCategoryMatcher {
  /**
   * Find or create the best matching category for user input
   * 
   * @param userId - User ID for category lookup
   * @param inputCategoryName - Category name from user input (e.g., "nabung", "makan", "kos")
   * @param type - Transaction type ("INCOME" or "EXPENSE")
   * @returns SmartCategoryMatch with matched or newly created category
   */
  static async findOrCreateCategory(
    userId: string,
    inputCategoryName: string,
    type: "INCOME" | "EXPENSE" = "EXPENSE"
  ): Promise<SmartCategoryMatch> {
    const input = inputCategoryName.trim().toLowerCase();
    
    // Step 1: Get existing categories
    const existingCategories = await CategoryService.getCategories(userId, type);
    
    // Step 2: Try exact match (case-insensitive)
    const exactMatch = existingCategories.find(
      (cat) => cat.name.toLowerCase() === input
    );
    if (exactMatch) {
      return {
        categoryId: exactMatch.id,
        categoryName: exactMatch.name,
        matchType: "exact",
        confidence: 100,
        isNewCategory: false,
      };
    }
    
    // Step 3: Try built-in keyword mapping
    const mappedName = CATEGORY_KEYWORD_MAP[input];
    if (mappedName) {
      const keywordMatch = existingCategories.find(
        (cat) => cat.name.toLowerCase() === mappedName.toLowerCase()
      );
      if (keywordMatch) {
        return {
          categoryId: keywordMatch.id,
          categoryName: keywordMatch.name,
          matchType: "keyword",
          confidence: 95,
          isNewCategory: false,
        };
      }
    }
    
    // Step 4: Try fuzzy matching (find closest match with similarity >= 60%)
    let bestMatch: { category: typeof existingCategories[0]; score: number } | null = null;
    
    for (const cat of existingCategories) {
      const score = similarityScore(input, cat.name);
      if (score >= 60 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { category: cat, score };
      }
    }
    
    if (bestMatch) {
      return {
        categoryId: bestMatch.category.id,
        categoryName: bestMatch.category.name,
        matchType: "fuzzy",
        confidence: bestMatch.score,
        isNewCategory: false,
      };
    }
    
    // Step 5: No good match found - create new category
    const capitalizedName = this.capitalizeCategoryName(inputCategoryName);
    const newCategory = await CategoryService.createCustomCategory(userId, {
      name: capitalizedName,
      type,
      icon: this.suggestIcon(capitalizedName),
      color: this.suggestColor(),
    });
    
    return {
      categoryId: newCategory.id,
      categoryName: newCategory.name,
      matchType: "created",
      confidence: 100, // High confidence since we created exactly what user wanted
      isNewCategory: true,
    };
  }
  
  /**
   * Capitalize category name properly
   * Examples: "nabung" \u2192 "Nabung", "beli buku" \u2192 "Beli Buku"
   */
  private static capitalizeCategoryName(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }
  
  /**
   * Suggest an appropriate icon based on category name keywords
   */
  private static suggestIcon(categoryName: string): string {
    const lower = categoryName.toLowerCase();
    
    if (lower.includes("tabung") || lower.includes("saving")) return "\uD83D\uDCB0";
    if (lower.includes("makan") || lower.includes("food") || lower.includes("minum")) return "\uD83C\uDF7D\uFE0F";
    if (lower.includes("transport") || lower.includes("bensin")) return "\uD83D\uDE97";
    if (lower.includes("rumah") || lower.includes("kos")) return "\uD83C\uDFE0";
    if (lower.includes("tagihan") || lower.includes("listrik") || lower.includes("air")) return "\uD83D\uDCB3";
    if (lower.includes("belanja") || lower.includes("shop")) return "\uD83D\uDECD\uFE0F";
    if (lower.includes("kesehatan") || lower.includes("obat")) return "\u2695\uFE0F";
    if (lower.includes("hiburan") || lower.includes("game") || lower.includes("nonton")) return "\uD83C\uDFAE";
    if (lower.includes("pendidikan") || lower.includes("buku")) return "\uD83D\uDCDA";
    
    return "\uD83D\uDCCC"; // Default: pushpin emoji
  }
  
  /**
   * Generate a random pleasant color for new category
   */
  private static suggestColor(): string {
    const colors = [
      "#3b82f6", // blue
      "#10b981", // green
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // purple
      "#ec4899", // pink
      "#14b8a6", // teal
      "#f97316", // orange
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

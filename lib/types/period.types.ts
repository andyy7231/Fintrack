/**
 * Period Filter Types for Transaction Period Filter & Summary Feature
 * 
 * These types define the structure for temporal filtering capabilities
 * on the Transactions page, including period selection, date ranges,
 * and display formatting.
 */

/**
 * Period type union defining all available period filter options
 * 
 * @property ALL - "Sejak pencatatan pertama" - No date filtering
 * @property TODAY - "Hari ini" - Current day in Jakarta timezone
 * @property LAST_7_DAYS - "7 hari terakhir" - Last 7 days including today
 * @property LAST_30_DAYS - "30 hari terakhir" - Last 30 days including today
 * @property THIS_MONTH - "Bulan ini" - Current calendar month
 * @property LAST_MONTH - "Bulan lalu" - Previous calendar month
 * @property CUSTOM - "Custom" - User-defined date range
 */
export type PeriodType = 
  | "ALL"           // Sejak pencatatan pertama
  | "TODAY"         // Hari ini
  | "LAST_7_DAYS"   // 7 hari terakhir
  | "LAST_30_DAYS"  // 30 hari terakhir
  | "THIS_MONTH"    // Bulan ini
  | "LAST_MONTH"    // Bulan lalu
  | "CUSTOM";       // Custom date range

/**
 * Date range boundaries for period filtering
 * 
 * Both dates are stored as UTC timestamps and represent inclusive boundaries.
 * Date calculations are performed in Asia/Jakarta timezone and converted to UTC.
 * 
 * @property start - Inclusive start boundary (UTC timestamp)
 * @property end - Inclusive end boundary (UTC timestamp)
 */
export interface PeriodRange {
  start?: Date;  // Inclusive start boundary (UTC)
  end?: Date;    // Inclusive end boundary (UTC)
}

/**
 * Display formatting information for active period selection
 * 
 * @property type - The selected period type
 * @property label - Human-readable Indonesian label for display
 * @property dateRange - Formatted date range string (e.g., "1 Jan 2024 – 31 Jan 2024")
 */
export interface PeriodLabel {
  type: PeriodType;
  label: string;      // Human-readable Indonesian label
  dateRange?: string; // Formatted date range (e.g., "1 Jan 2024 – 31 Jan 2024")
}

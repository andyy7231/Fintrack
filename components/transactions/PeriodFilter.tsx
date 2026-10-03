"use client";

import { useState } from "react";
import { PeriodType } from "@/lib/types/period.types";

/**
 * PeriodFilter Component Props
 * 
 * Controls period selection for transaction filtering with support
 * for preset periods and custom date ranges.
 */
export interface PeriodFilterProps {
  /** Currently selected period type */
  periodType: PeriodType;
  
  /** Callback when period selection changes with valid dates */
  onPeriodChange: (type: PeriodType, start?: Date, end?: Date) => void;
  
  /** Start date for CUSTOM period type */
  startDate?: Date;
  
  /** End date for CUSTOM period type */
  endDate?: Date;
  
  /** Human-readable label showing active date range */
  periodLabel: string;
}

/**
 * Format Date object to YYYY-MM-DD for input[type="date"]
 */
function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date in YYYY-MM-DD format (Jakarta timezone)
 */
function getTodayString(): string {
  const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const year = jakartaNow.getUTCFullYear();
  const month = String(jakartaNow.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jakartaNow.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Period Filter Component
 * 
 * Displays period selection dropdown with 7 preset options and custom date range.
 * Validates custom date inputs and displays active period label.
 * 
 * Features:
 * - Dropdown with Indonesian labels for 7 period options
 * - Conditional custom date pickers (shown when CUSTOM selected)
 * - Client-side validation: end >= start, end <= today, both required
 * - Validation error messages in red text
 * - Active period label display
 * - Dark mode support
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4, 7.5, 4.1-4.7
 */
export default function PeriodFilter({
  periodType,
  onPeriodChange,
  startDate,
  endDate,
  periodLabel,
}: PeriodFilterProps) {
  // Local state for custom date inputs
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");

  // Period options with Indonesian labels
  const periodOptions: Array<{ value: PeriodType; label: string }> = [
    { value: "ALL", label: "Sejak pencatatan pertama" },
    { value: "TODAY", label: "Hari ini" },
    { value: "LAST_7_DAYS", label: "7 hari terakhir" },
    { value: "LAST_30_DAYS", label: "30 hari terakhir" },
    { value: "THIS_MONTH", label: "Bulan ini" },
    { value: "LAST_MONTH", label: "Bulan lalu" },
    { value: "CUSTOM", label: "Custom" },
  ];

  /**
   * Validate custom date range
   * Returns error message if invalid, empty string if valid
   */
  function validateCustomDates(start: string, end: string): string {
    // Both dates required
    if (!start || !end) {
      return "Harap pilih tanggal awal dan akhir";
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = getTodayString();
    const todayDate = new Date(today);

    // End date must be >= start date
    if (endDate < startDate) {
      return "Tanggal akhir harus setelah atau sama dengan tanggal awal";
    }

    // End date must be <= today
    if (endDate > todayDate) {
      return "Tanggal akhir tidak boleh melebihi hari ini";
    }

    return "";
  }

  /**
   * Handle period dropdown change
   */
  function handlePeriodTypeChange(newType: PeriodType) {
    setValidationError("");
    
    if (newType === "CUSTOM") {
      // Switch to CUSTOM mode - initialize with prop dates if available
      if (startDate) setCustomStartDate(formatDateForInput(startDate));
      if (endDate) setCustomEndDate(formatDateForInput(endDate));
      // Call onPeriodChange to update parent state, dates will be provided later
      onPeriodChange(newType);
    } else {
      // Preset period - call onPeriodChange immediately
      setCustomStartDate("");
      setCustomEndDate("");
      onPeriodChange(newType);
    }
  }

  /**
   * Handle custom start date change
   */
  function handleStartDateChange(value: string) {
    setCustomStartDate(value);
    
    // Validate immediately if both dates present
    if (value && customEndDate) {
      const error = validateCustomDates(value, customEndDate);
      setValidationError(error);
      
      // If valid, call onPeriodChange
      if (!error) {
        const start = new Date(value);
        const end = new Date(customEndDate);
        onPeriodChange("CUSTOM", start, end);
      }
    } else {
      setValidationError("");
    }
  }

  /**
   * Handle custom end date change
   */
  function handleEndDateChange(value: string) {
    setCustomEndDate(value);
    
    // Validate immediately if both dates present
    if (customStartDate && value) {
      const error = validateCustomDates(customStartDate, value);
      setValidationError(error);
      
      // If valid, call onPeriodChange
      if (!error) {
        const start = new Date(customStartDate);
        const end = new Date(value);
        onPeriodChange("CUSTOM", start, end);
      }
    } else {
      setValidationError("");
    }
  }

  return (
    <div className="space-y-4">
      {/* Period Dropdown */}
      <div>
        <label 
          htmlFor="period-select" 
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
        >
          Periode
        </label>
        <select
          id="period-select"
          value={periodType}
          onChange={(e) => handlePeriodTypeChange(e.target.value as PeriodType)}
          className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        >
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-white dark:bg-zinc-800">
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Date Pickers (shown only when CUSTOM selected) */}
      {periodType === "CUSTOM" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date Input */}
            <div>
              <label 
                htmlFor="start-date" 
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Tanggal Awal
              </label>
              <input
                type="date"
                id="start-date"
                value={customStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                max={getTodayString()}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* End Date Input */}
            <div>
              <label 
                htmlFor="end-date" 
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Tanggal Akhir
              </label>
              <input
                type="date"
                id="end-date"
                value={customEndDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                max={getTodayString()}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Validation Error Message */}
          {validationError && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              {validationError}
            </p>
          )}
        </div>
      )}

      {/* Period Label Display */}
      {periodLabel && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          {periodLabel}
        </div>
      )}
    </div>
  );
}

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
    <div className="space-y-3">
      {/* Period Dropdown & Active Label in inline flex / compact container */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3 flex-1">
          <label 
            htmlFor="period-select" 
            className="text-xs font-semibold text-slate-500 whitespace-nowrap flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Filter Periode:
          </label>
          <select
            id="period-select"
            value={periodType}
            onChange={(e) => handlePeriodTypeChange(e.target.value as PeriodType)}
            className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Period Label Display */}
        {periodLabel && (
          <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{periodLabel}</span>
          </div>
        )}
      </div>

      {/* Custom Date Pickers (shown only when CUSTOM selected) */}
      {periodType === "CUSTOM" && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date Input */}
            <div>
              <label 
                htmlFor="start-date" 
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Tanggal Awal
              </label>
              <input
                type="date"
                id="start-date"
                value={customStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                max={getTodayString()}
                className="w-full text-xs text-slate-800 bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* End Date Input */}
            <div>
              <label 
                htmlFor="end-date" 
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Tanggal Akhir
              </label>
              <input
                type="date"
                id="end-date"
                value={customEndDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                max={getTodayString()}
                className="w-full text-xs text-slate-800 bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Validation Error Message */}
          {validationError && (
            <p className="text-xs font-medium mt-1" style={{color:'#FF0A54'}}>
              {validationError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

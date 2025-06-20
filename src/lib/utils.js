import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Utility function to format thickness values to always show 2 decimal places
export function formatThickness(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return '';
  }
  return num.toFixed(2);
}

// Utility function to format width values as integers only
export function formatWidth(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return '';
  }
  return Math.round(num).toString();
}

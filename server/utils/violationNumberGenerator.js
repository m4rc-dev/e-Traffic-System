/**
 * Utility for generating Philippine-style violation numbers
 * Format: VIO-YYYYMMDD-XXXX
 * 
 * Examples:
 * - VIO-20241229-1234 (Violation on Dec 29, 2024, sequence 1234)
 * - VIO-20250101-5678 (Violation on Jan 1, 2025, sequence 5678)
 */

/**
 * Generate a formatted violation number
 * @param {Date} date - The date for the violation (defaults to now)
 * @returns {string} Formatted violation number
 */
function generateViolationNumber(date = new Date()) {
  // Format: VIO-YYYYMMDD-XXXX
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  const dateStr = `${year}${month}${day}`;
  
  // Generate a 4-digit sequence based on timestamp
  // This provides uniqueness while keeping it readable
  const timeStr = date.getTime().toString();
  const sequentialNum = timeStr.slice(-4);
  
  return `VIO-${dateStr}-${sequentialNum}`;
}

/**
 * Parse violation number to extract date information
 * @param {string} violationNumber - The violation number to parse
 * @returns {object} Parsed information
 */
function parseViolationNumber(violationNumber) {
  const match = violationNumber.match(/^VIO-(\d{4})(\d{2})(\d{2})-(\d{4})$/);
  
  if (!match) {
    return {
      isValid: false,
      error: 'Invalid violation number format'
    };
  }
  
  const [, year, month, day, sequence] = match;
  
  return {
    isValid: true,
    prefix: 'VIO',
    year: parseInt(year),
    month: parseInt(month),
    day: parseInt(day),
    sequence: sequence,
    date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
    formatted: `${year}-${month}-${day}`
  };
}

/**
 * Validate violation number format
 * @param {string} violationNumber - The violation number to validate
 * @returns {boolean} Whether the format is valid
 */
function isValidViolationNumber(violationNumber) {
  const parsed = parseViolationNumber(violationNumber);
  return parsed.isValid;
}

module.exports = {
  generateViolationNumber,
  parseViolationNumber,
  isValidViolationNumber
};
/**
 * Utility for generating auto-incremented badge numbers
 * Format: BADGE001, BADGE002, BADGE003, etc.
 */

const { getFirebaseService } = require('../config/database');

/**
 * Generate the next available badge number
 * @param {string} prefix - The prefix for badge numbers (default: 'BADGE')
 * @returns {Promise<string>} Next available badge number
 */
async function generateNextBadgeNumber(prefix = 'BADGE') {
  try {
    const firebaseService = getFirebaseService();
    
    // Get all enforcers with just the limit, no ordering (to avoid Firebase indexing issues)
    const enforcers = await firebaseService.findMany('users', { role: 'enforcer' }, { limit: 1000 });
    
    let nextNumber = 1;
    
    if (enforcers && enforcers.length > 0) {
      // Find the highest badge number with the given prefix
      const badgeNumbers = enforcers
        .filter(enforcer => enforcer && enforcer.badge_number && enforcer.badge_number.startsWith(prefix))
        .map(enforcer => enforcer.badge_number)
        .sort();
      
      if (badgeNumbers.length > 0) {
        const lastBadge = badgeNumbers[badgeNumbers.length - 1];
        // Extract number part from badge (e.g., "BADGE003" -> "003")
        const numberPart = lastBadge.substring(prefix.length);
        const lastNumber = parseInt(numberPart, 10);
        
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }
    
    // Format with leading zeros (3 digits)
    const formattedNumber = nextNumber.toString().padStart(3, '0');
    return `${prefix}${formattedNumber}`;
  } catch (error) {
    console.error('Error generating badge number:', error);
    // Fallback to timestamp-based badge if database query fails
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}${timestamp}`;
  }
}

/**
 * Check if a badge number is available
 * @param {string} badgeNumber - Badge number to check
 * @returns {Promise<boolean>} True if available, false if taken
 */
async function isBadgeNumberAvailable(badgeNumber) {
  try {
    const firebaseService = getFirebaseService();
    const existingUser = await firebaseService.findUserByBadgeNumber(badgeNumber);
    return !existingUser;
  } catch (error) {
    console.error('Error checking badge number availability:', error);
    return false;
  }
}

/**
 * Validate badge number format
 * @param {string} badgeNumber - Badge number to validate
 * @param {string} prefix - Expected prefix (default: 'BADGE')
 * @returns {boolean} True if valid format
 */
function isValidBadgeFormat(badgeNumber, prefix = 'BADGE') {
  const pattern = new RegExp(`^${prefix}\\d{3}$`);
  return pattern.test(badgeNumber);
}

/**
 * Parse badge number to extract sequence
 * @param {string} badgeNumber - Badge number to parse
 * @param {string} prefix - Badge prefix (default: 'BADGE')
 * @returns {object} Parsed information
 */
function parseBadgeNumber(badgeNumber, prefix = 'BADGE') {
  if (!isValidBadgeFormat(badgeNumber, prefix)) {
    return {
      isValid: false,
      error: 'Invalid badge number format'
    };
  }

  const sequence = parseInt(badgeNumber.substring(prefix.length), 10);
  
  return {
    isValid: true,
    prefix: prefix,
    sequence: sequence,
    formatted: badgeNumber
  };
}

module.exports = {
  generateNextBadgeNumber,
  isBadgeNumberAvailable,
  isValidBadgeFormat,
  parseBadgeNumber
};
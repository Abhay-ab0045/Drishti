/**
 * Regex patterns for PII Detection
 */

// Basic email regex
export const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Indian mobile pattern: optional +91, 10 digits, allow spaces/hyphens
export const PHONE_PATTERN = /(?<!\d)(?:\+91[\-\s]?)?[6-9]\d{2}[\-\s]?\d{3}[\-\s]?\d{4}(?!\d)/g;

// Credit card: 13-19 digits, allowing spaces and hyphens
// We use a loose pattern to extract candidates, then validate with Luhn
export const CREDIT_CARD_PATTERN = /(?<!\d)(?:\d[\-\s]*){13,19}(?!\d)/g;

export function luhnCheck(cardString: string): boolean {
  // Strip non-digits
  const digits = cardString.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return (sum % 10) === 0;
}

// Aadhaar: 12 digits, often formatted in groups of 4. Must check for digit boundaries.
export const AADHAAR_PATTERN = /(?<!\d)\d{4}[\-\s]\d{4}[\-\s]\d{4}(?!\d)/g;

// PAN: 5 letters, 4 digits, 1 letter. Case-insensitive flag used during matching.
export const PAN_PATTERN = /(?<![A-Z0-9])[A-Z]{5}[0-9]{4}[A-Z]{1}(?![A-Z0-9])/gi;

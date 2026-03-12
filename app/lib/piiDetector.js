/**
 * Local PII (Personal Identifiable Information) detection engine.
 *
 * Regex-based detector for Korean personal information types.
 * Replaces the previous external API dependency (PII_DETECT_API_URL).
 */

const PII_TYPES = {
  'resident-number': {
    label: '주민등록번호',
    labelEn: 'Resident Registration Number',
    // 6 digits + separator + 7 digits
    pattern: /\b(\d{6})\s*[-–]\s*(\d{7})\b/g,
    mask: (match) => '[주민등록번호]',
  },
  'alien-registration': {
    label: '외국인등록번호',
    labelEn: 'Alien Registration Number',
    // Same format as resident number but with specific second-half starters (5,6,7,8)
    pattern: /\b(\d{6})\s*[-–]\s*([5-8]\d{6})\b/g,
    mask: (match) => '[외국인등록번호]',
  },
  phone: {
    label: '전화번호',
    labelEn: 'Phone Number',
    // Korean phone: 010-1234-5678, 02-123-4567, 031-123-4567, etc.
    pattern:
      /\b(0(?:10|1[1-9]|2|3[1-3]|4[1-4]|5[1-5]|6[1-4]|70))\s*[-.)]\s*(\d{3,4})\s*[-.)]\s*(\d{4})\b/g,
    mask: (match) => '[전화번호]',
  },
  email: {
    label: '이메일',
    labelEn: 'Email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    mask: (match) => '[이메일]',
  },
  'credit-card': {
    label: '신용카드번호',
    labelEn: 'Credit Card Number',
    // 4 groups of 4 digits
    pattern: /\b(\d{4})\s*[-–]?\s*(\d{4})\s*[-–]?\s*(\d{4})\s*[-–]?\s*(\d{4})\b/g,
    mask: (match) => '[신용카드번호]',
  },
  passport: {
    label: '여권번호',
    labelEn: 'Passport Number',
    // Korean passport: 1 letter + 8 digits (e.g., M12345678)
    pattern: /\b[A-Za-z]\d{8}\b/g,
    mask: (match) => '[여권번호]',
  },
  'driver-license': {
    label: '운전면허번호',
    labelEn: 'Driver License Number',
    // Korean driver license: 12-34-567890-12
    pattern: /\b(\d{2})\s*[-–]\s*(\d{2})\s*[-–]\s*(\d{6})\s*[-–]\s*(\d{2})\b/g,
    mask: (match) => '[운전면허번호]',
  },
  'bank-account': {
    label: '계좌번호',
    labelEn: 'Bank Account Number',
    // Korean bank accounts: various formats (10-16 digits with dashes)
    pattern:
      /\b(\d{3,4})\s*[-–]\s*(\d{2,6})\s*[-–]\s*(\d{2,6})(?:\s*[-–]\s*(\d{1,3}))?\b/g,
    mask: (match) => '[계좌번호]',
    validate: (match) => {
      // Must be at least 10 digits total
      const digits = match.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 16;
    },
  },
  'health-insurance': {
    label: '건강보험번호',
    labelEn: 'Health Insurance Number',
    // 10-14 consecutive digits (standalone)
    pattern: /\b(\d{10,14})\b/g,
    mask: (match) => '[건강보험번호]',
    validate: (match) => {
      // Exclude numbers that look like other types
      const digits = match.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 14;
    },
    // Lower priority — only match if not already matched by other types
    priority: 10,
  },
  'ip-address': {
    label: 'IP 주소',
    labelEn: 'IP Address',
    pattern:
      /\b(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    mask: (match) => '[IP주소]',
  },
};

// Processing order: specific types first, broad types last
const TYPE_ORDER = [
  'resident-number',
  'alien-registration',
  'driver-license',
  'credit-card',
  'phone',
  'email',
  'passport',
  'bank-account',
  'ip-address',
  'health-insurance',
];

/**
 * Returns all supported PII types with labels.
 * Suitable for rendering type selectors in admin UI.
 */
export function getAllPiiTypes() {
  const result = {};
  for (const key of TYPE_ORDER) {
    const { label, labelEn } = PII_TYPES[key];
    result[key] = { label, labelEn };
  }
  return result;
}

/**
 * Detect PII in the given text.
 *
 * @param {string} text          — input text to scan
 * @param {string[]|null} enabledTypes — array of PII type keys to detect,
 *                                       or null/undefined for all types
 * @returns {{ detected: boolean, maskedText: string, detectedList: Array, detectedCnt: number }}
 */
export function detectPII(text, enabledTypes = null) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      detected: false,
      maskedText: text || '',
      detectedList: [],
      detectedCnt: 0,
    };
  }

  const enabledSet = enabledTypes ? new Set(enabledTypes) : null;

  // Track matched ranges to avoid overlapping detections
  const matchedRanges = [];
  const allDetections = [];

  for (const typeKey of TYPE_ORDER) {
    if (enabledSet && !enabledSet.has(typeKey)) continue;

    const typeConfig = PII_TYPES[typeKey];
    if (!typeConfig) continue;

    // Reset regex lastIndex for global patterns
    const regex = new RegExp(typeConfig.pattern.source, typeConfig.pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check for overlap with existing detections
      const overlaps = matchedRanges.some(
        (range) => start < range.end && end > range.start
      );
      if (overlaps) continue;

      // Run optional validation
      if (typeConfig.validate && !typeConfig.validate(match[0])) continue;

      matchedRanges.push({ start, end });
      allDetections.push({
        type: typeKey,
        label: typeConfig.label,
        original: match[0],
        masked: typeConfig.mask(match[0]),
        index: start,
      });
    }
  }

  if (allDetections.length === 0) {
    return {
      detected: false,
      maskedText: text,
      detectedList: [],
      detectedCnt: 0,
    };
  }

  // Sort detections by position (descending) for safe replacement
  allDetections.sort((a, b) => b.index - a.index);

  let maskedText = text;
  for (const detection of allDetections) {
    maskedText =
      maskedText.slice(0, detection.index) +
      detection.masked +
      maskedText.slice(detection.index + detection.original.length);
  }

  // Re-sort for output (ascending order)
  allDetections.sort((a, b) => a.index - b.index);

  return {
    detected: true,
    maskedText,
    detectedList: allDetections,
    detectedCnt: allDetections.length,
  };
}

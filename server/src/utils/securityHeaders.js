const SECURITY_HEADER_DEFINITIONS = [
  {
    key: 'content-security-policy',
    label: 'Content Security Policy',
    description: 'Locks down what the page can load'
  },
  {
    key: 'x-frame-options',
    label: 'X-Frame-Options',
    description: 'Prevents clickjacking via framing'
  },
  {
    key: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    description: 'Stops MIME sniffing'
  },
  {
    key: 'referrer-policy',
    label: 'Referrer-Policy',
    description: 'Controls referrer leakage'
  },
  {
    key: 'permissions-policy',
    label: 'Permissions-Policy',
    description: 'Restricts browser feature access'
  }
];

export function summarizeSecurityHeaders(headers = new Headers()) {
  const items = SECURITY_HEADER_DEFINITIONS.map((definition) => {
    const rawValue = getHeaderValue(headers, definition.key);
    const present = Boolean(rawValue);

    return {
      ...definition,
      present,
      value: present ? 'Present' : 'Missing',
      rawValue: rawValue || null,
      tone: present ? 'success' : 'warning'
    };
  });

  const presentCount = items.filter((item) => item.present).length;

  return {
    items,
    presentCount,
    missingCount: items.length - presentCount,
    totalCount: items.length,
    passed: presentCount === items.length
  };
}

function getHeaderValue(headers, key) {
  if (!headers || typeof headers.get !== 'function') {
    return null;
  }

  return headers.get(key) ?? null;
}

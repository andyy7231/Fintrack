# Pattern Parser Security Documentation

## Overview

The Pattern Parser implements comprehensive input sanitization to protect against malicious input patterns. All user input is validated before parsing to prevent:

- Cross-Site Scripting (XSS) attacks
- SQL Injection attempts  
- Code Injection attempts
- Other malicious patterns

## Security Implementation

### Input Validation Flow

```
User Input → Security Validation → Pattern Parsing → Entity Resolution
              ↓ (if malicious)
           INVALID_FORMAT + AI Fallback Required
```

### Security Check Location

Security validation occurs in `PatternParserService.attemptPatternParse()` at **Phase 0.1** (before any pattern matching):

```typescript
// Phase 0.1: Security validation - detect malicious patterns (Requirement 9.5)
if (!this.isSafeInput(trimmedText)) {
  // Log security event for monitoring
  console.warn('[PatternParser] Malicious input pattern detected, rejecting parse', {
    messageLength: trimmedText.length,
    timestamp: new Date().toISOString(),
  });

  return {
    success: false,
    reason: 'INVALID_FORMAT',
    fallbackRequired: true,
  };
}
```

## Malicious Patterns Detected

### 1. XSS (Cross-Site Scripting) Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `<script` | Script tag injection | `<script>alert('xss')</script>` |
| `<img` | Image tag with malicious handlers | `<img src=x onerror=alert(1)>` |
| `<iframe` | Iframe injection | `<iframe src="evil.com">` |
| `<object` | Object tag injection | `<object data="evil.swf">` |
| `javascript:` | JavaScript protocol | `javascript:void(0)` |
| `on\w+=` | Event handlers | `onclick=`, `onerror=`, `onload=` |

**Detection:** Case-insensitive regex patterns in `regex.utils.ts`

### 2. SQL Injection Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `union select` | UNION-based SQL injection | `UNION SELECT * FROM users` |
| `--` (double dash) | SQL comment injection | `'; DROP TABLE users--` |

**Detection:** Case-insensitive, detects 2+ consecutive dashes

### 3. Code Injection Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `exec(` | Code execution attempts | `exec(malicious_code)` |

**Detection:** Case-insensitive

## Security Response Strategy

### When Malicious Input Detected:

1. **Reject Immediately** - Return `INVALID_FORMAT` without parsing
2. **Log Security Event** - Record detection for monitoring (without exposing sensitive data)
3. **Require AI Fallback** - Set `fallbackRequired: true` to trigger AI parser
4. **Never Expose Details** - Don't reveal detection logic to potential attackers

### Logging Format:

```typescript
console.warn('[PatternParser] Malicious input pattern detected, rejecting parse', {
  messageLength: trimmedText.length,  // Only metadata, not actual content
  timestamp: new Date().toISOString(),
});
```

**Why AI Fallback?**  
Malicious input is treated like any other parsing failure - it requires human review before processing. The AI parser can detect context and intent, allowing legitimate false positives to be handled gracefully.

## Safe Input Handling

### Patterns Considered Safe:

- **Normal punctuation in descriptions**: `"Beli kopi-susu 25rb"` (single hyphen OK)
- **Parentheses in context**: `"Bayar parkir (motor) 5rb"`
- **Unicode characters**: `"Beli ☕ 25rb"`
- **Indonesian words with "dan"**: `"Budget hiburan dan rekreasi 800k"` (not detected as multi-action when part of category name)

### Security Test Coverage:

All security patterns have comprehensive test coverage in `pattern-parser.service.test.ts`:

- ✅ XSS Attack Patterns (4 tests)
- ✅ SQL Injection Patterns (4 tests)
- ✅ Code Injection Patterns (2 tests)
- ✅ Combined Attack Vectors (3 tests)
- ✅ Safe Input Acceptance (5 tests)
- ✅ Error Handling for Malicious Input (3 tests)
- ✅ Boundary Security Cases (3 tests)

**Total: 24 security-focused tests**

## Error Handling Guarantees

### Never Throw Exceptions

All security validation is wrapped in try-catch blocks. The pattern parser **guarantees** it will never throw exceptions on malicious input:

```typescript
try {
  // Security validation and parsing logic
} catch (error) {
  // Ultimate safety net - log error but don't expose to user
  console.error('[PatternParser] Unexpected error:', error);
  
  return {
    success: false,
    reason: 'INVALID_FORMAT',
    fallbackRequired: true,
  };
}
```

### Return Format Consistency

Malicious input always returns the same format as other parsing failures:

```typescript
{
  success: false,
  reason: 'INVALID_FORMAT',
  fallbackRequired: true
}
```

This ensures:
1. No special handling needed for malicious input
2. Consistent behavior across all failure modes
3. No information leakage about detection

## Security Best Practices

### ✅ DO:

- **Validate early** - Check security before any parsing logic
- **Log for monitoring** - Track security events with metadata only
- **Fail gracefully** - Return standardized failure format
- **Require AI fallback** - Let human review handle edge cases
- **Keep patterns updated** - Add new malicious patterns as discovered

### ❌ DON'T:

- **Don't expose detection logic** - Never reveal why input was rejected
- **Don't log full input** - Only log metadata (length, timestamp)
- **Don't throw exceptions** - Always return PatternParseFailure
- **Don't block legitimate input** - Test safe patterns thoroughly
- **Don't trust external input** - Validate everything before parsing

## Monitoring & Alerts

### Recommended Monitoring:

```typescript
// Count malicious input detections
metrics.increment('pattern_parser.security.malicious_detected', 1, {
  pattern_type: 'xss' | 'sql_injection' | 'code_injection'
});

// Alert on high rate of malicious input
if (maliciousDetectionRate > 0.1) { // 10%+
  alertSecurityTeam('High rate of malicious input detected');
}
```

### Key Metrics to Track:

1. **Malicious Detection Rate** - % of inputs flagged as malicious
2. **Pattern Distribution** - Which attack types are most common
3. **False Positive Rate** - Safe inputs incorrectly flagged (should be 0%)
4. **AI Fallback Success** - Do malicious inputs get resolved by AI?

## Future Enhancements

### Potential Additions:

1. **Rate Limiting** - Block users sending repeated malicious inputs
2. **IP Blocking** - Automatically block IPs with high malicious rate
3. **Pattern Learning** - Detect new attack patterns automatically
4. **Severity Levels** - Distinguish between low/medium/high severity
5. **User Notification** - Inform users their input looks suspicious (carefully)

### Security Audit Checklist:

- [ ] Review all regex patterns for bypasses
- [ ] Test Unicode/encoding edge cases
- [ ] Verify no information leakage in errors
- [ ] Check logging doesn't expose PII
- [ ] Confirm exception handling is complete
- [ ] Validate AI fallback handles malicious input safely

## References

- **Requirement 9.5**: Pattern Parser Security Validation
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **OWASP Input Validation**: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2024-01-20 | 1.0 | Initial security implementation with XSS, SQL, and code injection detection |

# Hybrid Parser Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the hybrid parser optimization to production safely and incrementally. The hybrid parser feature reduces message processing latency by 70-90% and AI API costs by 80%+ for common WhatsApp bot commands.

**Key Safety Features:**
- Feature flag control (instant enable/disable)
- Zero breaking changes (backward compatible)
- Gradual rollout strategy
- Comprehensive monitoring
- Instant rollback capability

---

## Feature Flag Configuration

### Environment Variable

The hybrid parser is controlled by a single environment variable:

```env
# .env.local or production environment
ENABLE_PATTERN_PARSER=false  # Disabled (AI-only mode)
ENABLE_PATTERN_PARSER=true   # Enabled (hybrid mode - pattern first, AI fallback)
```

**Default:** alse (disabled for safe rollout)

### How It Works

When enabled:
1. Simple commands → Pattern parser (fast, deterministic)
2. Complex commands → AI fallback (Gemini API)

When disabled:
- All commands → AI parser (existing behavior)

**No code deployment required** to toggle the feature!

---

## Rollout Phases

### Phase 1: Development Testing (Week 1)

**Goal:** Validate pattern parser correctness and performance

**Steps:**
1. Enable in development environment:
   ```bash
   # .env.local
   ENABLE_PATTERN_PARSER=true
   ```

2. Test all supported patterns manually:
   - Simple expenses: "Beli kopi 25rb", "Bayar parkir 5000"
   - Simple income: "Gaji 10jt", "Terima transfer 500k"
   - Budget allocation: "Budget makan 1jt"

3. Test AI fallback scenarios:
   - Multi-action: "Beli kopi 25rb dan makan siang 50rb"
   - Ambiguous: "Kemarin kayaknya habis sekitar 50rb"

4. Monitor logs for parse events:
   ```bash
   grep "ParseMetrics" logs/development.log | jq
   ```

**Success Criteria:**
- ✅ Pattern-matched commands return correct results
- ✅ AI fallback triggers for complex commands
- ✅ No exceptions or errors in logs
- ✅ Response times <50ms for pattern matches

---

### Phase 2: Staging Validation (Week 2)

**Goal:** Validate in production-like environment with real user scenarios

**Steps:**
1. Deploy to staging environment
2. Enable feature flag:
   ```bash
   # Staging environment variables
   ENABLE_PATTERN_PARSER=true
   ```

3. Run end-to-end test suite:
   ```bash
   npm test -- --run
   ```

4. Perform load testing:
   ```bash
   # Use load testing tool (k6, Apache JMeter, etc.)
   # Simulate 100+ concurrent users
   k6 run load-test.js --vus 100 --duration 10m
   ```

5. Review metrics dashboard:
   - Pattern success rate (target: 80%+)
   - Average latency by method
   - AI fallback frequency

**Success Criteria:**
- ✅ All tests passing
- ✅ Pattern success rate >80%
- ✅ No performance degradation under load
- ✅ Error rate <0.1%

---

### Phase 3: Canary Deployment (Week 3)

**Goal:** Enable for 10% of production users to validate real-world behavior

**Strategy:**
Use environment-based canary deployment or feature flag service (LaunchDarkly, Unleash, etc.):

```typescript
// services/whatsapp/message.service.ts
const isCanaryUser = await canaryService.isUserInCanary(userId);
const parser = (isCanaryUser && process.env.ENABLE_PATTERN_PARSER === 'true')
  ? new HybridParserService()
  : new FinancialParserService();
```

**Alternative:** Enable globally for 10% traffic via load balancer

**Steps:**
1. Deploy to production (feature flag OFF)
2. Enable for canary users:
   ```bash
   # Set feature flag for 10% of users
   # (via LaunchDarkly, Unleash, or custom implementation)
   ```

3. Monitor for 7 days:
   - Parse metrics (pattern success rate)
   - User feedback (support tickets)
   - Error rates
   - Latency percentiles (p50, p95, p99)

4. Compare metrics between canary and control groups:
   - Canary group: 10% using hybrid parser
   - Control group: 90% using AI-only

**Success Criteria:**
- ✅ Pattern success rate 75-85% for canary group
- ✅ Latency reduction 60-90% for pattern-matched messages
- ✅ No increase in error rate vs control group
- ✅ No increase in support tickets

---

### Phase 4: Gradual Rollout (Weeks 4-6)

**Goal:** Incrementally increase to 100% of users

**Timeline:**

| Week | Traffic % | Monitor For | Rollback If |
|------|-----------|-------------|-------------|
| Week 4 | 10% → 25% | 2-3 days | Error rate >0.5% |
| Week 5 | 25% → 50% | 3-4 days | Pattern success <70% |
| Week 6 | 50% → 100% | 5-7 days | Latency regression |

**Steps per increment:**

1. Increase traffic percentage:
   ```bash
   # Via feature flag service or load balancer
   # Update targeting rules to increase % of users
   ```

2. Monitor for observation period (2-7 days)

3. Validate metrics thresholds:
   ```bash
   # Check aggregated metrics for current rollout %
   node scripts/check-parse-metrics.js --days 7
   ```

4. If metrics good, proceed to next increment
5. If metrics degrade, pause or roll back (see Rollback section)

**Success Criteria (per increment):**
- ✅ Pattern success rate maintains 75-85%
- ✅ Average pattern processing time <50ms
- ✅ AI fallback latency unchanged from baseline
- ✅ Zero increase in user complaints

---

### Phase 5: Default Enabled (Week 7+)

**Goal:** Make hybrid parser the default behavior

**Steps:**
1. After successful 100% rollout for 2+ weeks, update default:
   ```env
   # .env.example (committed to repo)
   ENABLE_PATTERN_PARSER=true   # New default
   ```

2. Update documentation to reflect new default

3. Remove feature flag (optional, after 1-2 months of stability):
   ```typescript
   // services/whatsapp/message.service.ts
   // Remove conditional, always use HybridParserService
   const parser = parserService || new HybridParserService();
   ```

**Success Criteria:**
- ✅ Stable for 2+ weeks at 100% rollout
- ✅ No outstanding issues or degradation
- ✅ Team confident in removing feature flag

---

## Success Metrics to Monitor

### Critical Metrics (Alert on degradation)

1. **Pattern Match Success Rate**
   - Target: **80%+**
   - Alert threshold: **<70%**
   - Measurement: (patternSuccess / patternAttempts) * 100

2. **Error Rate**
   - Target: **<0.1%**
   - Alert threshold: **>0.5%**
   - Measurement: (errors / totalMessages) * 100

3. **P95 Latency (Pattern Path)**
   - Target: **<50ms**
   - Alert threshold: **>100ms**
   - Measurement: 95th percentile of pattern processing time

4. **P95 Latency (AI Path)**
   - Target: **<500ms** (unchanged from baseline)
   - Alert threshold: **>800ms**
   - Measurement: 95th percentile of AI processing time

### Performance Metrics (Track trends)

5. **Average Processing Time by Method**
   - Pattern: Target <30ms
   - AI Fallback: Target <400ms
   - Measurement: Mean processing time

6. **AI API Cost Reduction**
   - Target: **80%+ reduction**
   - Measurement: ((baseline - current) / baseline) * 100
   - Calculate: patternSuccessCount × avgAICallCost

7. **AI Fallback Rate**
   - Target: **<20%**
   - Measurement: (aiFallbacks / totalMessages) * 100

### Usage Metrics (Understand patterns)

8. **Intent Type Distribution**
   - Track: EXPENSE vs INCOME vs BUDGET_ALLOCATION
   - Use: Identify opportunities for pattern expansion

9. **Pattern Failure Reason Distribution**
   - Track: NO_MATCH, AMBIGUOUS, MULTI_ACTION, COMPLEX_DATE
   - Use: Guide pattern parser improvements

---

## Observability Dashboard Queries

### Query 1: Pattern Success Rate (Last 24h)

```sql
-- Assumes parse events are stored in observability backend
SELECT
  COUNT(*) FILTER (WHERE pattern_success = true) AS successes,
  COUNT(*) FILTER (WHERE pattern_attempted = true) AS attempts,
  (COUNT(*) FILTER (WHERE pattern_success = true)::float /
   NULLIF(COUNT(*) FILTER (WHERE pattern_attempted = true), 0)) * 100 AS success_rate
FROM parse_events
WHERE timestamp >= NOW() - INTERVAL '24 hours';
```

### Query 2: Average Latency by Method (Last 7d)

```sql
SELECT
  parse_method,
  AVG(processing_time_ms) AS avg_latency,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_time_ms) AS p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) AS p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time_ms) AS p99
FROM parse_events
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY parse_method;
```

### Query 3: Failure Reason Distribution (Last 24h)

```sql
SELECT
  pattern_failure_reason,
  COUNT(*) AS count,
  (COUNT(*)::float / (SELECT COUNT(*) FROM parse_events
                      WHERE timestamp >= NOW() - INTERVAL '24 hours'
                        AND pattern_attempted = true
                        AND pattern_success = false)) * 100 AS percentage
FROM parse_events
WHERE timestamp >= NOW() - INTERVAL '24 hours'
  AND pattern_attempted = true
  AND pattern_success = false
GROUP BY pattern_failure_reason
ORDER BY count DESC;
```

### Query 4: Cost Savings Calculation (Last 30d)

```sql
-- Assuming \.001 per AI API call
SELECT
  COUNT(*) FILTER (WHERE parse_method = 'PATTERN') AS pattern_messages,
  COUNT(*) FILTER (WHERE parse_method = 'AI_FALLBACK') AS ai_messages,
  COUNT(*) FILTER (WHERE parse_method = 'PATTERN') * 0.001 AS estimated_savings_usd
FROM parse_events
WHERE timestamp >= NOW() - INTERVAL '30 days';
```

---

## Rollback Procedure

### Instant Rollback (Emergency)

If critical issues arise, rollback instantly via feature flag:

```bash
# Set environment variable in production
ENABLE_PATTERN_PARSER=false

# Or via feature flag service (instant propagation)
launchdarkly-cli flags toggle hybrid-parser-enabled --off
```

**Zero code deployment required. Changes take effect immediately.**

### When to Roll Back

Roll back if any of these conditions occur:

1. **Pattern success rate drops below 60%** for >1 hour
2. **Error rate exceeds 1%** for >30 minutes
3. **Latency regression** (p95 >2x baseline) for >30 minutes
4. **Spike in support tickets** related to incorrect parsing
5. **Critical bug discovered** in pattern parser

### Rollback Validation

After rolling back, validate:

```bash
# Check that AI-only mode is active
grep "parseMethod" logs/production.log | grep -c "PATTERN"
# Should return 0

# Verify error rate returns to baseline
node scripts/check-error-rate.js --hours 1
# Should be <0.1%
```

### Post-Rollback Analysis

1. Review logs for root cause:
   ```bash
   grep "ERROR" logs/production.log | grep -A 10 "PatternParser"
   ```

2. Analyze failure reasons:
   ```bash
   # Query observability backend for failure distribution
   node scripts/analyze-pattern-failures.js --hours 24
   ```

3. Reproduce issue in development:
   - Identify specific message patterns that failed
   - Write regression test
   - Fix bug in pattern parser

4. Re-deploy with fix and restart rollout from Phase 2 (Staging)

---

## Pre-Deployment Checklist

Before enabling in production, verify:

### Code Readiness
- [ ] All unit tests passing (
pm test -- --run)
- [ ] All integration tests passing
- [ ] Property-based tests passing (100+ iterations each)
- [ ] Build succeeds without warnings (
pm run build)
- [ ] No TypeScript errors or warnings

### Infrastructure
- [ ] Observability backend configured for parse metrics
- [ ] Dashboard queries tested and working
- [ ] Alerting rules configured for critical metrics
- [ ] Feature flag infrastructure ready (if using canary)

### Documentation
- [ ] Deployment guide reviewed and understood
- [ ] Rollback procedure tested in staging
- [ ] On-call engineers briefed on new feature
- [ ] Runbook created for common issues

### Monitoring
- [ ] Baseline metrics captured (pre-rollout)
- [ ] Dashboard configured with target thresholds
- [ ] Alerts configured for degradation
- [ ] Log aggregation working (ParseMetrics logs)

### Safety
- [ ] Feature flag defaults to OFF
- [ ] Rollback procedure validated in staging
- [ ] No breaking changes to existing behavior
- [ ] Backward compatibility verified

---

## Post-Deployment Validation

After enabling in each phase, validate:

### Immediate (First 5 minutes)
```bash
# Check for errors
tail -f logs/production.log | grep "ERROR.*PatternParser"

# Verify parse events are logged
tail -f logs/production.log | grep "ParseMetrics"

# Check pattern match rate
grep "ParseMetrics" logs/production.log | tail -100 | \
  grep -c "patternSuccess\":true"
```

### Short-term (First Hour)
- Monitor error rate dashboard (target: <0.1%)
- Check pattern success rate (target: >80%)
- Review P95 latency (pattern: <50ms, AI: <500ms)
- Check for any user complaints in support channels

### Medium-term (First Day)
- Analyze failure reason distribution
- Compare latency percentiles to baseline
- Calculate AI API cost savings
- Review any anomalous patterns in logs

### Long-term (First Week)
- Track cost savings trend
- Identify opportunities for pattern expansion
- Gather user feedback on response times
- Plan next optimization iteration

---

## Common Issues & Troubleshooting

### Issue 1: Pattern Success Rate Lower Than Expected (<70%)

**Symptoms:**
- Parse metrics show high AI_FALLBACK rate
- Pattern failure reasons: mostly NO_MATCH

**Possible Causes:**
- Users sending more complex/conversational messages than expected
- Pattern parser too strict or missing common formats

**Resolution:**
1. Analyze NO_MATCH failure examples:
   ```bash
   grep "patternFailureReason\":\"NO_MATCH\"" logs/production.log | \
     jq '.messageLength, .intentType'
   ```

2. Identify common patterns in failed messages
3. Extend pattern parser to support new formats
4. Deploy update and monitor improvement

**Do NOT roll back unless rate <60%** – some AI fallback is expected and healthy.

---

### Issue 2: High Latency for Pattern Parsing (>100ms)

**Symptoms:**
- Pattern parser taking longer than expected
- P95 latency >100ms for parseMethod=PATTERN

**Possible Causes:**
- Regex patterns not optimized
- Entity resolution slow (database queries)
- High CPU load on servers

**Resolution:**
1. Profile pattern parser performance:
   ```bash
   # Check processing time distribution
   grep "parseMethod\":\"PATTERN\"" logs/production.log | \
     jq '.processingTimeMs' | sort -n | tail -20
   ```

2. Identify slow regex patterns or entity resolution
3. Optimize bottleneck (add indexes, cache accounts/categories)
4. Deploy optimization

**Consider rollback if P95 >200ms** – defeats purpose of optimization.

---

### Issue 3: AI Fallback Errors Increase

**Symptoms:**
- AI parser returning errors more frequently
- User complaints about "service unavailable" messages

**Possible Causes:**
- AI API quota exceeded (more fallbacks than expected)
- AI API performance degradation
- Network issues

**Resolution:**
1. Check AI API quota:
   ```bash
   # Google Cloud Console → Gemini API → Quotas
   ```

2. Review AI fallback rate:
   ```bash
   grep "parseMethod\":\"AI_FALLBACK\"" logs/production.log | wc -l
   ```

3. If quota issue:
   - Request quota increase from Google
   - Temporarily increase pattern parser strictness to reduce fallbacks

4. If API issue:
   - Check Google Cloud Status Dashboard
   - Implement retry logic with exponential backoff

**Do NOT roll back** unless AI service completely unavailable.

---

### Issue 4: Incorrect Parsing Results

**Symptoms:**
- Users reporting wrong amounts, categories, or dates
- Support tickets about transaction errors

**Possible Causes:**
- Pattern parser bug (incorrect regex or extraction logic)
- Entity resolution failing silently
- Edge case not handled

**Resolution:**
1. Collect examples of incorrect parses:
   ```bash
   # From support tickets or user reports
   ```

2. Reproduce in development:
   ```typescript
   const result = PatternParserService.attemptPatternParse("user message");
   console.log(result);
   ```

3. Write regression test for failed case
4. Fix bug in pattern parser or entity resolution
5. Deploy fix urgently

**Roll back immediately if >10 users affected** – correctness is critical.

---

## Maintenance & Iteration

### Monthly Review

Every month, review metrics and plan improvements:

1. **Analyze Pattern Expansion Opportunities**
   - Review NO_MATCH failure examples
   - Identify 2-3 new common patterns to support
   - Implement and test new patterns

2. **Optimize Performance**
   - Review P95/P99 latency trends
   - Profile slow regex patterns
   - Optimize entity resolution queries

3. **Cost Tracking**
   - Calculate total AI API cost savings
   - Present ROI to stakeholders
   - Justify continued investment in pattern expansion

4. **User Feedback Integration**
   - Review support tickets related to parsing
   - Identify pain points or confusion
   - Improve error messages and fallback behavior

---

## Security Considerations

### Input Validation

The pattern parser includes security validation:
- XSS detection (<script>, <img>, etc.)
- SQL injection detection (UNION SELECT, --)
- Code injection detection (exec(), eval())

All suspicious inputs trigger AI fallback for safety.

### Monitoring for Abuse

Watch for malicious usage patterns:
- High rate of INVALID_FORMAT failures from single user
- Repeated security pattern detections
- Unusual message lengths or formats

```bash
# Alert if >10 INVALID_FORMAT from same user in 1 hour
grep "patternFailureReason\":\"INVALID_FORMAT\"" logs/production.log | \
  jq '.userId' | sort | uniq -c | sort -rn | head -10
```

### Privacy & Compliance

Parse events contain:
- User IDs (internal)
- Phone numbers (hashed/anonymized in logs)
- Message lengths (not full content)

Ensure observability backend complies with:
- GDPR (if EU users)
- Data retention policies (auto-delete after N days)
- Access controls (only authorized engineers)

---

## Support & Escalation

### Monitoring Contacts

- **Primary:** DevOps team (monitors dashboard)
- **Secondary:** Engineering on-call (alerts)
- **Escalation:** Engineering lead (critical issues)

### Escalation Thresholds

| Severity | Condition | Response Time | Action |
|----------|-----------|---------------|--------|
| **Critical** | Error rate >2% or service down | 5 minutes | Immediate rollback |
| **High** | Pattern success <60% for >1h | 15 minutes | Investigate + decision |
| **Medium** | Latency regression >2x baseline | 30 minutes | Optimize or rollback |
| **Low** | Pattern success 60-70% | 1 hour | Monitor and plan fix |

### Communication Channels

- Slack: #fintrack-alerts (automated alerts)
- Slack: #fintrack-eng (team discussion)
- PagerDuty: Engineering on-call rotation
- Status Page: User-facing status updates

---

## Success Story Template

After successful rollout, document the impact:

### Hybrid Parser Optimization — Production Results

**Rollout Timeline:** [Start Date] to [End Date]

**Performance Improvements:**
- Pattern match success rate: **[X]%** (target: 80%+)
- Average latency reduction: **[X]%** (target: 70-90%)
- P95 latency (pattern path): **[X]ms** (target: <50ms)
- AI API cost reduction: **$[X]/month** (target: 80%+)

**User Impact:**
- Faster response times for **[X]%** of messages
- Reduced AI service dependency
- No increase in error rate or user complaints

**Lessons Learned:**
- [Key insight 1]
- [Key insight 2]
- [Key insight 3]

**Next Steps:**
- Expand pattern support for [new command types]
- Further optimize entity resolution latency
- Explore pattern learning from AI fallback messages

---

## References

- **Requirements:** .kiro/specs/hybrid-parser-optimization/requirements.md
- **Design:** .kiro/specs/hybrid-parser-optimization/design.md
- **Tasks:** .kiro/specs/hybrid-parser-optimization/tasks.md
- **Code Documentation:** HYBRID_PARSER.md

---

**Last Updated:** [Date]  
**Version:** 1.0.0  
**Status:** Production Ready

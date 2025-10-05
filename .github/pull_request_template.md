## Delivery Standards Checklist

Before requesting review, confirm each item below to comply with the [Delivery Standards](../doc/requirement.md#constitution-delivery-standards).

### Code Quality
- [ ] Scoped the change to avoid leaking concerns across modules or layers.
- [ ] Removed or flagged dead code and documented any new dependencies with owners.

### Testing Standards
- [ ] Added or updated automated tests (unit/integration/e2e) for impacted flows and ensured deterministic test data.
- [ ] Confirmed the full test suite passes locally or in CI and coverage metrics did not regress.

### User Experience Consistency
- [ ] Applied the shared design system components/tokens and kept accessibility (keyboard, ARIA, contrast) intact.
- [ ] Captured stakeholder or user validation for notable UX changes.

### Performance Requirements
- [ ] Evaluated latency or load impact; any P95 > 500 ms backend or > 16 ms/frame frontend regressions are addressed or justified.
- [ ] Documented caching/data-movement adjustments to control redundant calls and infra cost.

### Release Notes
- [ ] Highlighted user-facing changes and new risks for release notes.

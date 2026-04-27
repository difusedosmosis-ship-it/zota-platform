# Zota v1.1.0 Backlog

## Goal

The `v1.1.0` cycle should move Zota from a strong `v1.0.0` launch state into a more mature operational and growth-ready platform.

## Priority 1

### Shared authentication and session continuity

- unify login flow across website, consumer, vendor, and office where appropriate
- reduce repeated sign-in friction across surfaces
- formalize token refresh and session expiry behavior

### Monitoring and alerting

- add centralized error monitoring
- add deploy health checks
- add request failure dashboards
- add wallet/payment failure alerts

### Production analytics

- track conversion from discovery to request
- track vendor KYC funnel
- track catalog approval funnel
- track job acceptance and completion funnel
- track wallet top-up success rate

### Office governance maturity

- stronger audit filtering by user, route, action, and date
- exportable audit logs
- clearer office role templates
- user suspension/reactivation workflow in addition to permanent removal

## Priority 2

### Marketplace experience

- richer vendor profiles
- better service/asset filtering
- improved search relevance
- review and trust surfaces

### Messaging and call maturity

- persistent unread read-state on backend
- better conversation routing and pinning
- call history detail and support review tools

### Vendor tooling

- richer service editing controls
- clearer listing lifecycle states
- vendor business performance analytics

### Consumer wallet and payments

- stronger transaction history detail
- clearer payment and settlement receipts
- payout and refund handling rules where required

## Priority 3

### Admin workflow polish

- batch approval tools
- advanced catalog moderation filters
- saved office views
- queue prioritization tools

### Documentation and support

- operator playbooks for incident handling
- vendor support scripts
- release management templates

## Suggested Versioning Approach

### `v1.0.x`

- hotfixes
- performance corrections
- payment or request-flow bugfixes
- app store review-driven corrections

### `v1.1.0`

- cross-surface auth maturity
- analytics
- admin governance expansion
- deeper operational tooling

# Zota Release Notes

## Version

- `v1.0.0`
- Release stage: production live
- Release date: `2026-04-27`

## Surfaces in Scope

- `Zota` consumer app
- `Zota Business` vendor app
- `Zota Office` admin console
- `beautifulmind.com.ng` public website
- shared backend and realtime services

## Release Summary

`v1.0.0` is the first full production release of the Zota ecosystem. This release establishes the complete marketplace loop across consumer discovery, vendor onboarding and fulfillment, and office governance.

## Included Capabilities

### Consumer

- browse vendors and booking inventory
- discover services and assets without forced login
- view vendor detail pages
- send service requests
- receive request and completion notifications
- message vendors
- use AI assistant
- top up wallet
- track request status to completion

### Zota Business

- sign in and stay authenticated
- complete KYC onboarding
- upload compliance documents
- publish services
- publish assets/listings
- accept, start, and complete jobs
- receive wallet settlement on completed jobs
- manage notifications and request activity

### Zota Office

- internal-only office authentication
- super admin user control
- office team creation and removal
- role and permission-based access control
- KYC review and approval
- catalog review and publish/unpublish flow
- finance monitoring
- communications and notification monitoring
- office activity and presence monitoring

### Website

- public consumer-facing entry
- live API-backed search and discovery
- login gateway into Zota surfaces
- privacy policy
- terms of service
- support page

## Core Business Flow

1. vendor signs up in `Zota Business`
2. vendor submits KYC
3. office reviews and approves KYC
4. vendor creates service or asset
5. office reviews and publishes listing
6. consumer discovers listing
7. consumer sends request
8. vendor accepts request
9. vendor starts job
10. vendor completes job with final amount
11. consumer wallet is debited
12. vendor wallet is credited net of commission

## Operational Notes

- office accounts are not public signup accounts
- office staff are created internally by a super admin
- settlement is wallet-based
- live activity is visible in office
- legal URLs are available on the website for app-store and compliance use

## Known Next Focus

- production monitoring maturity
- deeper analytics
- richer unread/read state persistence
- stronger SSO across surfaces
- post-launch bugfixes and support workflow

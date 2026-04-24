# Zota Handover Guide

## Product Surfaces

- `Zota` consumer app
  - browse vendors and booking inventory
  - send requests
  - message vendors
  - track jobs
  - use wallet
- `Zota Business`
  - complete KYC
  - publish services and assets
  - accept/start/complete jobs
  - receive wallet earnings
- `Zota Office`
  - approve KYC
  - publish or unpublish catalog entries
  - monitor requests, calls, conversations, finance, and office staff

## Core Workflow

1. Vendor registers in `Zota Business`
2. Vendor completes KYC
3. `Zota Office` reviews and approves KYC
4. Vendor publishes service or asset
5. `Zota Office` reviews and publishes listing
6. Consumer discovers listing in `Zota`
7. Consumer sends request
8. Vendor accepts, starts, and completes the job
9. Consumer wallet is debited on completion
10. Vendor wallet is credited net of commission

## Office Governance

### Super Admin

- creates office users
- assigns job positions
- assigns access permissions
- removes office access for fired or inactive staff
- sees all office areas

### Office Permissions

- `OVERVIEW`
- `KYC`
- `CATALOG`
- `FINANCE`
- `TEAM`
- `MESSAGES`
- `NOTIFICATIONS`

## Office User Monitoring

`Zota Office` now tracks:

- last login time
- last logout time
- last seen time
- current online/offline state
- last route visited
- recent office actions
- API activity inside office

## Required Infrastructure

### Backend env

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_CALLBACK_URL`

### Deployment surfaces

- backend on Render
- consumer on Vercel
- vendor on Vercel
- admin on Vercel
- public website on Vercel

## Release Smoke Test

### Consumer

1. browse without login
2. log in
3. top up wallet
4. send request
5. receive completion notification

### Vendor

1. log in
2. submit KYC
3. publish service
4. accept request
5. start job
6. complete job

### Office

1. log in as super admin
2. create office user
3. verify office permission visibility
4. approve KYC
5. publish service
6. inspect request movement
7. inspect calls/messages
8. remove office user access

## Operational Notes

- Removing an office user disables their access immediately.
- Office permissions are enforced in the office UI and backend.
- Chat/call schema is bootstrapped at runtime for production resilience.
- Wallet settlement is wallet-based, not direct card escrow.

## Suggested Handover Meeting Structure

1. Product overview
2. Office governance walkthrough
3. Vendor onboarding and approval flow
4. Consumer request-to-completion flow
5. Finance and wallet settlement flow
6. Deployment and support ownership

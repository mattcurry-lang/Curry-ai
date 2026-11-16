# ADR 0006: Payments sit behind a provider interface

Status: accepted (implemented in Phase 7)

## Context
The target market is Kenya, where mobile money (M-Pesa) is the dominant way to pay. Stripe availability for Kenyan businesses runs through an "extended network" arrangement rather than a standard direct account, and what the owner can actually receive depends on how the account was opened.

## Decision
- Billing code depends on a small `PaymentProvider` interface (create checkout, handle webhook, cancel subscription), not on Stripe directly.
- Stripe is the first implementation. A Kenya-capable provider (for example Paystack, Flutterwave, or direct M-Pesa Daraja) can be added as a second implementation without touching Curry Core.
- Webhooks are verified by signature and are idempotent.
- Plan limits are enforced from the usage ledger, independent of the payment provider.

## Open question for the owner
Confirm that the Stripe account can be paid out in Kenya, and which currencies and methods (card, M-Pesa) it can collect.

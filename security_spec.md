# Security Specification — SALVAFRICA Firestore Rules

## 1. Data Invariants
1. Access is scoped exclusively to the single shared couple vault (`/vaults/salvafrica-viaggio`); `list` on `/vaults` and `delete` on `/vaults` are forbidden.
2. Subcollections (`/categories`, `/contributions`) enforce path variable validation (`isValidId`) and parent existence (`parentVaultExists`) via `exists()`.
3. Categories (`/vaults/salvafrica-viaggio/categories/{categoryId}`) validate strict schemas (`isValidCategory`), enforce `name` length `1..50`, forbid deletion (`allow delete: if false`) so historical movements remain valid, and partition updates strictly into rename (`['name', 'updatedAt']`), archive/reactivate (`['archived', 'updatedAt']`), and usage tracking (`['lastUsedAt', 'updatedAt']` with `lastUsedAt == request.time`).
4. Contributions (`/vaults/salvafrica-viaggio/contributions/{contributionId}`) enforce positive `amount` (`> 0 && <= 100000`), valid `partnerKey` (`'A'` or `'B'`), `sourceTag` (`1..50`), and optional validated `categoryId` (`1..64`, alphanumeric/`_`/`-`) for backwards compatibility with pre-existing historical records.
5. Server timestamps (`request.time`) are mandatory on `createdAt` (create) and `updatedAt` (create/update); `id` and `createdAt` are immutable.

## 2. Adversarial "Dirty Dozen" Payloads
1. Access to another vault ID (`/vaults/other-vault`) -> `PERMISSION_DENIED`.
2. Unscoped `/vaults` `list` query -> `PERMISSION_DENIED`.
3. Shadow field injection (`{ extraField: true }`) on Vault, Category, or Contribution -> `PERMISSION_DENIED` (`hasOnly`).
4. Empty or oversized category name (`name: ""` or `> 50` chars) -> `PERMISSION_DENIED`.
5. Deleting a category document -> `PERMISSION_DENIED` (`allow delete: if false`).
6. Client-spoofed `lastUsedAt` or `updatedAt` != `request.time` on category update -> `PERMISSION_DENIED`.
7. Invalid `categoryId` with special characters (`../../x`) -> `PERMISSION_DENIED` (`isValidId`).
8. Negative or zero contribution `amount` (`amount: 0` or `-10`) -> `PERMISSION_DENIED`.
9. Oversized contribution `amount` (`amount: 200000`) -> `PERMISSION_DENIED`.
10. Spoofed `createdAt` modification during contribution or category update -> `PERMISSION_DENIED`.
11. Unallowed field mix in contribution update (e.g. modifying `amount` with `reactionHeart` only branch) -> `PERMISSION_DENIED`.
12. Deleting the parent vault document -> `PERMISSION_DENIED`.

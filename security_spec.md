# Security Specification — Marechiaro Firestore Rules

## 1. Data Invariants
1. Every document in `/vaults/{vaultId}` is owned by `ownerUid` and strictly bounded to at most 2 authenticated `memberUids` with verified email (`email_verified == true`).
2. All subcollections (`/contributions`, `/wishlist`, `/challenges`) inherit membership strictly via Master Gate `get()` on the parent `/vaults/{vaultId}` document.
3. Joining a vault requires proving possession of the secret `inviteCode` (`incoming().joinedInviteCode == existing().inviteCode`) while `memberUids.size() == 1`.
4. All contributions must carry a positive `amount` (`> 0 && <= 100000`), a valid `partnerKey` (`'A'` or `'B'`), and an explicit external `sourceTag`.
5. Server timestamps (`request.time`) are mandatory on all `createdAt` (on create) and `updatedAt` (on create and update) fields; `createdAt`, `ownerUid`, `authorUid`, and `inviteCode` are immutable.
6. No blanket `allow read: if isSignedIn()` or `allow list: if isSignedIn()` is permitted anywhere. `/vaultInvites` has `allow list: if false` so invite codes cannot be enumerated.

## 2. "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated read/write**: Request with `auth == null` on `/vaults/v1` -> `PERMISSION_DENIED`.
2. **Unverified email write**: Request with `auth.token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Shadow field injection on Vault create**: Including `{ extraAdmin: true }` in payload -> `PERMISSION_DENIED` (`hasOnly` check).
4. **Privilege escalation on Vault join**: Third user attempting to join when `memberUids.size() == 2` -> `PERMISSION_DENIED`.
5. **Invite code bypass on Vault join**: Joining `/vaults/v1` with wrong `joinedInviteCode` -> `PERMISSION_DENIED`.
6. **Non-member reading parent Vault**: Authenticated outsider calling `get` on `/vaults/v1` -> `PERMISSION_DENIED`.
7. **Unscoped Vault list query**: Calling `list` on `/vaults` without `where('memberUids', 'array-contains', uid)` -> `PERMISSION_DENIED`.
8. **Invite enumeration attack**: Calling `list` on `/vaultInvites` -> `PERMISSION_DENIED`.
9. **Negative or zero deposit**: Creating contribution with `amount: -50` or `amount: 0` -> `PERMISSION_DENIED`.
10. **Identity spoofing on Contribution**: Creating contribution with `authorUid != request.auth.uid` -> `PERMISSION_DENIED`.
11. **Timestamp spoofing**: Creating contribution with backdated client `createdAt` != `request.time` -> `PERMISSION_DENIED`.
12. **Resource poisoning**: Sending a 2KB string in `vaultId` or `note` (`> 200` chars) -> `PERMISSION_DENIED`.

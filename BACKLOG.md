# MyRoots — product backlog and sprints

Plan of record: the "MyRoots: Data Model & Build Plan" doc. This file tracks
delivery. Goal of the whole backlog: first paid orders for memorial
programmes and plaques, produced by outside suppliers, paid by manual proof.

## Definition of done

- `npm run typecheck` and `npm test` pass.
- Migrations are idempotent and were run against a scratch database first.
- Every screen works on a 360 px phone and asks one plain-language question.
- No production migration runs without the owner's go-ahead.

## Sprint 1 — every user has exactly one family

Goal: strangers can sign up and each gets a private family; nobody shares one tree.

- [x] `users.tree_id` NOT NULL and `users.role`; `tree_members` retired (0006)
- [x] `requireMember()` reads the user's own family
- [x] Signup, Google and Facebook all go through `createUserWithFamily`
- [x] Invitation matched by email at first sign-in joins the inviter's family
- [x] Admin members list and role changes read `users`
- [x] Seed scripts updated
- [ ] Run 0006 on a scratch database, then on production (needs go-ahead)
- [ ] Manual test: two new signups cannot see each other's people

Known gap: an invitation only works for an address that has not signed up yet.
An existing user with their own family cannot be moved into another family.

## Sprint 2 — every user is linked to a person

- `users.person_id` NOT NULL UNIQUE, composite FK so the person is in the user's family
- Signup creates the person from the profile name; `/welcome` confirms it and adds first-degree family
- Drop `people.claimed_by_user_id`; rework the claim pages
- Facebook sign-in without an email: ask for email or phone instead of failing

## Sprint 3 — sellable Remembered slice

- QR code for the public memorial page (`/eulogy/[token]`), downloadable
- Public page links to parents, spouse and children (dates and names only)
- Product catalogue, order form, payment methods, proof upload
- Admin queue: verify proof, move order through production

## Sprint 4 — guided configurator and Living slice

- Focus-person tree layout with wrap and density limits; layout snapshot at approval
- Guest draft under a session token, converted to family, person and user at the account step
- Tombstone, tile plaque, wall tree and poster product schemas

## Deferred

- Rename `trees` to `families` and `families` to `unions` (cosmetic, touches ~30 files)
- Drop `tree_members`
- Welfare contributions, subscriptions, partner portal, research service

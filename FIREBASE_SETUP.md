# Publish before testing

In Firebase Console, open the messenger-ni-kat project, then Firestore Database > Rules. Replace the rules with this repository's firestore.rules and click Publish. The rules have not been deployed by this coding session.

Rule changes:
- users/{uid}: only the owner can read. Owners can update only avatar, with the five existing keys and allowed values validated. Other fields are preserved by the update restriction. Registration creation rules remain in place.
- publicProfiles/{uid}: verified users can get individual email-free profiles. Owners can create/update only fullName, customNumber, and avatar, matching their private account document after the write. Collection listing and deletes are denied.
- friendRequests: verified senders may create only pending requests with their own fromUid, a different existing toUid, a server timestamp, and the required document ID. Only participants can read existing requests. A verified client may check a missing document to test availability. Only the receiver can update a pending request status to accepted or declined. All other fields are immutable. Acceptance requires both contact records in the same atomic operation. Deletes are denied.
- friendRequestLocks: two immutable directional records are created atomically with each request. Both must reference that same request, preventing concurrent reverse requests or forged duplicate requests. Client reads, updates, and deletes are denied.
- numbers: existing signup/number-lookup rules are unchanged.

New registrations create publicProfiles automatically. Existing users publish their email-free profile on their next verified login or avatar save. Until then they will not appear in search. For accounts that cannot log in, an administrator must backfill publicProfiles/{uid} using only fullName, customNumber, and avatar from users/{uid}; never copy email. An absent avatar uses {character: 0, hoodieColor: 'rose', skinTone: 0, glasses: true, badge: 'sparkle'} in the public profile.

Avatar saves batch-update users/{uid}.avatar and the public profile. A permission-denied message means the deployed rules must be checked; local code cannot change deployed Firebase permissions.

Validation completed: Vite production build and mocked signup, verification/profile loading, number search, and friend-request tests. These do not validate deployed rules or replace Firebase Emulator security-rule tests. No live Firebase writes or rule deployment were performed.

## Incoming requests and contacts

Publish the entire current firestore.rules file in Firebase Console > Firestore Database > Rules before testing Accept/Decline.

New contacts live at users/{ownerUid}/contacts/{contactUid}, with uid and requestId. Document IDs prevent duplicates. Only the owner can read their contacts. Creation is permitted only as part of the receiver accepting a matching pending request; unrelated users and the sender cannot accept or create the relationship. Contact updates/deletes are not enabled.

The existing friendRequests read rules remain participant-only for existing documents and queries. Only the recipient can change pending to accepted/declined; fromUid, toUid, and createdAt cannot change. Request locks remain unchanged. Declined requests are retained, and sending a fresh request for that pair is not implemented.

Incoming requests use a real-time query for toUid == currentUser.uid and status == pending. Contacts use a real-time listener on the owner's contacts collection. Public profiles are loaded for each snapshot; emails are never read for these cards.

An index configuration is provided in firestore.indexes.json. In Firebase Console > Firestore Database > Indexes > Composite > Add index, use collection ID friendRequests, query scope Collection, toUid Ascending and status Ascending. If Firebase serves the equality query through existing indexes, no additional index is needed; otherwise create this index and wait until enabled.

Existing accounts still need publicProfiles populated (next verified login, or an admin backfill). A missing public profile shows Profile unavailable without preventing a response.

Validation: incoming response tests cover acceptance, decline, duplicate processing, sender rejection, and missing requests. Existing mocked suites and production build also pass. Rules have not been emulator-tested or published by this session.

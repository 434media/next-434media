# Owned Meta publisher

Status: implementation under review, disabled by default. No live-account, IAM,
credential, deployment or publishing setup is performed by this code change.

## Boundaries

- Existing four-brand configuration; strict resolver, no TXMX fallback.
- Existing ContentDetailDrawer review and Firestore content records.
- Stills, IG ordered carousels / FB organic multi-photo, and video.
- Operator-triggered actions. No scheduler, worker, lease or automatic takeover.
- One transaction claim per post and one-way final intent per destination.
- Retry preparation; never blindly retry final publication. A published photo,
  feed call and ordinary video call are final operations too.
- Exact revision/hash approval, retained batch/attempt history, archive instead
  of deletion, and distinct API-verified versus operator-confirmed results.
- Preview routes cannot mutate publisher records. No tests use real credentials,
  Firestore, public uploads or Meta calls.

## Configuration before separately approved activation

Production alone is insufficient: OWNED_META_PUBLISHING_ENABLED and each
OWNED_META_ENABLED_TXMX/VEMOS/MILCITY/AMPD must explicitly equal true. Default is
false. Do not set them as part of deploying a review PR.

Use existing INSTAGRAM_ACCESS_TOKEN_{brand}, FACEBOOK_PAGE_ID_{brand} and
INSTAGRAM_BUSINESS_ACCOUNT_ID_{brand}. Vemos uses INSTAGRAM_APP_ID_VEMOS; other
brands may supply INSTAGRAM_APP_ID_{brand} or the existing shared app ID.
OWNED_META_API_VERSION_{brand} defaults to the existing v23.0, but that default
is not evidence of capability. Explicit capability evidence must match it.

OWNED_META_EVIDENCE_{brand} is a server-only JSON record with verifiedAt,
credentialKind system_user_page, appId, pageId, instagramId, apiVersion and
format-specific limits under formats. Keys are instagram:still:feed,
instagram:carousel:feed, instagram:video:reels, facebook:still:feed,
facebook:carousel:feed, facebook:video:video and facebook:video:reels. Each entry
requires mimeTypes, maxBytes, maxItems, minAspect, maxAspect, maxDuration and
aiLabel. These are actual verified endpoint limits, never copied product guesses.
An AI Facebook Reel also requires facebookReelAiPhase finish verified for the
chosen version. Missing evidence holds that destination. Check permissions before
first live use per brand and after a permission failure; no periodic audit loop.
A permission failure writes its timestamp in existing crm_meta and blocks use
until evidence has been reverified after that failure.

All credentials must originate from the approved System User/Page chain. This
module neither creates nor proves grants. Setup and first live test remain human
authorization gates. No personal-token fallback.

## Private review and public media

Approved export references must already be saved on the content post. The server
accepts only HTTPS origins explicitly listed in OWNED_META_SOURCE_ORIGINS, follows
no redirects, and does not assume private Drive authentication. It measures
PNG/JPEG/MP4 metadata from bytes and hashes the exact export. The drawer preview
is served through a checksum-verifying authenticated streaming response. Mutable
source changes fail rather than silently updating the approved export.

A 64 MiB per-export memory safety ceiling is an implementation bound, not a Meta
platform limit. Larger exports or inaccessible private sources require an
approved durable source/streaming path. No new public draft store is created.

Only approved bytes become public in
`groovy-ego-462522-v2.firebasestorage.app`, under `owned-meta/434/approved/`.
The prefix is a code convention, NOT an IAM security boundary. The bucket remains
fine-grained. The separately approved setup is the dedicated
`meta-media-uploader-434` identity with bucket-level Storage Object Creator,
without a condition, following the existing media-pipeline precedent. Its role
adds no read/list/delete/overwrite rights; inherited/public access still applies.
Never use the retiring broad Google key for these uploads or change bucket ACLs.

Production-only Vercel OIDC/WIF supplies short-lived credentials to
`meta-media-uploader-434@groovy-ego-462522-v2.iam.gserviceaccount.com`.
OWNED_META_WIF_AUDIENCE must identify the dedicated meta-publisher-434 pool and
vercel-production provider. Exact trust/identity setup is separately approved.
No ADC or GOOGLE_SERVICE_ACCOUNT_KEY fallback is present in the uploader.

Use ifGenerationMatch=0. A lost successful upload response is recovered by
verifying exact public bytes and reusing the existing object, never overwriting.
No object deletion or lifecycle policy is introduced. A failed post does not
revoke approved public exposure. All bytes/provenance are preserved, without
metadata stripping or invented C2PA claims.

## Disclosure and recovery

AI flags are sent only for reviewed AI-generated posts. IG carousel labeling is
on the parent. Facebook photos/feed have no verified equivalent parameter in
the inspected official SDK, so affected AI still/multi-photo jobs require manual
platform handling. The ordinary video and Reel paths support a conditional AI
flag, gated by verified version/phase capability. Metadata is retained but does
not guarantee an automatic label.

API verification requires the exact saved remote ID in the intended account's
published collection, a trusted permalink and required disclosure readback.
Only the first 100 returned published items are checked; absence remains unknown,
not proof of non-publication. Explicit super-admin manual evidence can close an
unknown/label-held job, with an exact-content attestation and actor/time/hash.
It is labeled operator-confirmed, never API-verified. Neither closure reopens
final publication. Claims interrupted before final intent can be released by an
operator; known unused preparation may be reset with its IDs retained in history.
A claim interrupted after final intent needs explicit super-admin evidence that
the exact run terminated/cancelled, never elapsed-time inference. That recovery
retains final intents and allows read-only reconciliation. A delayed response can
append an ID only to its exact final attempt; it cannot dispatch another job or
overwrite conflicting/operator evidence. Without termination evidence, stay held.

Share-to-feed is an explicit reviewed/hash-bound IG video choice. No automatic
crop, placement substitution, standalone Story fallback or fabricated tagging.
Analytics join on account and remote ID; missing metrics are not zero. Automated
optimization and Facebook analytics expansion are outside this patch.

## Verification

Focused tests: `tsx --test lib/__tests__/owned-meta-publisher.test.ts`.
Tests use injected fake transport and transaction-style memory stores. Run these
with the repository's existing required checks. Typecheck, build and UI review
must be reported separately; an offline core pass is not a full application pass.

Primary references checked 2026-10-09:
- https://github.com/facebook/facebook-python-business-sdk/tree/main/facebook_business/adobjects
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- https://www.postman.com/meta/facebook/request/juhnm3q/4-publish-reel
- https://vercel.com/docs/oidc/gcp
- https://docs.cloud.google.com/storage/docs/request-preconditions
- https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions

SDK shape is not account/version verification. Exact permissions, format limits,
visible labels, keyless access and end-to-end publication remain activation gates.

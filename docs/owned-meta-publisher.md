# Optional owned Meta publisher

Status: draft PR, disabled until separately approved setup and activation. This is
an optional API adapter. Audrey's existing Canva, export/import and native/manual
publishing workflow is not replaced. The existing manual mark-posted endpoint,
generation engine, Blob upload routes and analytics credentials remain unchanged.

## Four review corrections

1. Reuse the public UUID-named Vercel Blob exports the app already creates. No
   GCS copy, upload identity, WIF setup, bucket/ACL change or added OIDC dependency.
2. Publishing uses only OWNED_META_TOKEN_TXMX/VEMOS/MILCITY/AMPD. There is no
   fallback to INSTAGRAM_ACCESS_TOKEN_* used by analytics.
3. A fresh, uncached read of crm_meta/owned_meta_enabled controls every mutation
   boundary. Missing/unreadable state is disabled. Only production may publish.
4. API version, format rules, dated official sources and AI-label handling live in
   lib/owned-meta-formats.ts, not editable environment capability JSON.

## Existing-system boundaries

The adapter takes saved, public Blob export references. Private Canva/Drive
review does NOT automatically become a Blob asset: a human still uses the
existing approved export/upload or ingest step. No new upload bridge is claimed.

Exact public URL, SHA-256, size, measured dimensions/duration, item order, captions,
account IDs, placement and AI choice are bound to one immutable approved revision.
The authenticated preview verifies the bytes before serving them. The adapter
rechecks those exact bytes immediately before Meta handoff and fails if changed.
Only configured public Blob store origins and the existing content-posts UUID
path pattern are accepted; redirects and mutable-looking paths are rejected.

The app's existing Blob put paths use UUIDs and do not request overwrite; the SDK
rejects overwrites by default. That is the app's append-only convention, not an
absolute immutability guarantee against an authorized overwrite/delete. Source
objects must remain available while Meta processes them. There is no new copy,
cleanup, image conversion, crop or metadata stripping. A 64 MiB/export memory
safety bound is explicitly an application limit, not a Meta platform limit.

Manual posts without an opted-in publisher batch retain existing behavior. Batch
approval/history, archive protection, stopped-run recovery and exact-post manual
evidence are confined to the optional adapter. API-verified and operator-confirmed
outcomes are labeled separately. No automatic final-publish retry, worker,
scheduler, lease, unattended continuation or creative optimization is introduced.

## Separately approved first-test setup

Start with MilCityUSA only; other brand switches remain false.

- Confirm the existing app, Page and professional IG identity relationship.
- Verify a System User-origin Page publishing credential and necessary content
  tasks/scopes. The credential is entered securely as OWNED_META_TOKEN_MILCITY;
  this PR creates/installs no token and changes no grants.
- Keep existing Page/IG/app identity bindings. Vemos's separate app is preserved.
- OWNED_META_EVIDENCE_MILCITY contains only appId, pageId, instagramId,
  credentialKind system_user_page and verifiedAt. It records completed identity/
  lineage verification, not arbitrary format allowances. A permission failure
  pauses the brand until evidence has been reverified after the failure.
- Set OWNED_META_SOURCE_ORIGINS to the exact existing public Blob store origin(s),
  never a wildcard or all Vercel customer stores. These are public URLs, not secrets.
- After separate merge/activation approval, create/update the runtime switch:
  crm_meta/owned_meta_enabled with enabled true and brands.milcity true, all other
  brand booleans false. No code in this PR enables the document. A false global
  flag stops every brand; a false brand flag stops that brand. Every enabled()
  check rereads Firestore, including after slow byte verification and immediately
  before final dispatch. It cannot recall a request already sent.
- Preview endpoints cannot mutate publisher records, regardless of switch state.
  Read-only reconciliation remains possible in production while publishing is off.

No GCS or Google IAM setup is needed for this revision. Existing Firestore
infrastructure/credentials are not changed or retired by this PR.

## Reviewed API contract

Publisher-only version is pinned in code; analytics retain their existing version.
Sources were inspected on 2026-10-09. Refresh the code contract during a reviewed
version/requirement change, not through environment overrides.

- IG still: JPEG, at most 8 MB, aspect 4:5–1.91:1. Widths outside 320–1440 are
  described as automatically scaled by Meta, not automatically rejected.
- IG carousel: at most 10 images/videos/mixed. Images follow image limits. The
  adapter holds differing item aspects to avoid an unapproved first-item crop.
  Distinct carousel-video numeric limits were not established; Reel limits are
  not silently applied to a VIDEO child.
- IG Reel: MOV/MP4 supported by Meta; this parser handles MP4. At most 300 MB,
  width 1920, aspect 0.01–10, duration 3–900 s; 9:16 is recommended. Official
  encoding requirements include H.264/HEVC, 23–60 fps and audio constraints.
- FB photo: at most 10 MB. Meta supports JPEG/BMP/PNG/GIF/TIFF; this adapter
  measures JPEG/PNG. PNG at most 1 MB is a recommendation, not a rejection gate.
  Use caption on /photos; message/name are deprecated.
- FB multi-photo: unpublished /photos followed by final /feed attached_media.
  No numerical photo-count ceiling was verified; no ad-carousel limit is borrowed.
- FB Reel: documented supported subset 9:16, at least 540×960, fixed 24–60 fps,
  duration 3–90 s. No maximum file bytes was established from the current guide.
- FB ordinary video: /videos supports file_url; numerical size/duration limits
  were not established in the inspected reference. None are invented here.

The byte parser measures size, pixels, orientation and duration. It does not claim
to verify GOP/chroma/audio or every encoding parameter. For the controlled video
pilot, inspect the actual export's codec/frame-rate/audio with existing tools;
Meta processing and the authorized first-live test remain necessary evidence.

## AI and controlled pilot

Only posts explicitly marked AI-generated send the AI parameter. Official IG
June 22, 2026 changes apply to all versions: is_ai_generated on media creation,
carousel parent only, with published-media readback. The current FB Reel guide
explicitly documents is_ai_generated on finish/publish. FB photos/feed have no
verified equivalent; the SDK-only ordinary-video flag is not treated as proved
label behavior. Only those affected AI placements require manual handling.
Preserve existing C2PA/IPTC bytes; do not promise Meta auto-labeling from metadata.

After separate approvals: one plain still on both platforms, then video,
carousel and AI-video tests one at a time. For each, verify exact accounts,
content/order, captions, genuine tags, AI disclosure when required, final IDs,
permalinks and retained logs. Native account tagging is not implemented by this adapter; a caption mention is
not proof of a real account tag. Keep required native tags in the established
workflow until an actual verified tag path exists. Native Story resharing is an explicit separate
pass/fail check, never a standalone Story substitute. Run Audrey's actual
access-to-review-to-publish flow before calling the extension complete.

Tests remain mocked/offline until those approvals. Use the existing verification
workflow. Do not call a source/typecheck pass a rendered UI or live-platform pass.

## Primary sources

- https://vercel.com/docs/vercel-blob/using-blob-sdk (allowOverwrite default)
- https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media (updated 2026-09-28)
- https://developers.facebook.com/documentation/instagram-platform/content-publishing (updated 2026-06-30)
- https://developers.facebook.com/documentation/instagram-platform/changelog#ai-info-label (2026-06-22)
- https://developers.facebook.com/docs/graph-api/reference/page/photos/
- https://developers.facebook.com/documentation/video-api/guides/reels-publishing (updated 2026-07-30; Step 3 Quick Reference includes AI flag)
- https://developers.facebook.com/docs/graph-api/reference/page/videos/

## Read-only connection diagnostics

The super-admin Content drawer has **Check connection (read only)** for an existing
batch. Its production-only GET uses the configured `OWNED_META_TOKEN_*` internally,
including while switches or the permission marker block publishing. It has no
persistence or mutation capability. It observes `/me` ID, configured Page's linked
Instagram ID, the first 25 Page published posts and Instagram media, and the saved
Instagram container status. It never follows pagination or creates media.

Configured IDs are distinct from observed IDs. App identity and publishing scopes
remain unverified. A successful read does not establish publish permission; an
exact-caption candidate does not verify approved media; an empty window does not
prove absence. The check does not reconcile, clear a marker, advance evidence, or
make an uncertain final publication eligible for retry. Status is re-read after
provider checks and a changed batch is rejected.

Future provider failures retain only HTTP status, numeric code/subcode, validated
trace ID, operation, destination and timestamp. Vendor messages, response bodies,
URLs, headers and credentials are excluded. Execution failure summaries are
recorded in the existing cron log, and per-job evidence preserves the existing
claim/final-intent safeguards. Historical errors discarded before this patch
cannot be recovered by the check.

Read contracts: Meta's [Graph overview (`me`)](https://developers.facebook.com/docs/graph-api/overview/#me),
[Page fields](https://developers.facebook.com/docs/graph-api/reference/page/),
[Page published posts](https://developers.facebook.com/docs/graph-api/reference/page/published_posts/),
[PagePost fields](https://developers.facebook.com/docs/graph-api/reference/page-post/),
and [official Page-token IG-container example](https://www.postman.com/meta/instagram/request/munmruq/get-ig-container-status).
Verified against official sources on 2026-10-09. Existing graph version remains unchanged.

## Founder-only uncertain-final recovery (draft; offline verified only)

`recover-facebook` is restricted to the authenticated `marcos@434media.com`
session, in addition to the existing admin/publishing gates. The broader CRM
super-admin role is not recovery authority. This first recovery surface supports
Facebook still/feed only. Instagram uncertainty, video/Reels and carousels remain
on their existing reconciliation/manual paths; none is claimed live-verified.

The founder must inspect the exact Page/post, confirm the prior run stopped, give
20–2,000 characters of observed evidence and explicitly accept duplicate risk.
An active claim must first be settled using observed termination evidence.
The transaction checks the displayed attempt, unchanged approval/revision and
absence of known remote IDs. It retains the entire old job (including final
intent, preparation and error) under `facebookAttempts`, records the operator's
“reconciled, not found” observation and links one successor. That statement is
bounded operator evidence, never a definitive finding that publication did not
happen. The manifest/hash/approval are unchanged. At most ten recovery attempts
are allowed; history is not pruned. Unrelated Instagram state is not advanced.

Immediately before the successor's final transport request, after slow asset-byte
verification, the provider reads the Page's `published_posts` collection with
`id,message,created_time`. The window begins five minutes before the earliest
original intent and ends at the fresh read's start (rounded outward to seconds).
Intents older than seven days cannot use this surface. The scan follows returned
`after` cursors, rebuilding the same trusted endpoint/window, never following or
saving a token-bearing pagination URL. It stops closed on errors, malformed IDs,
timestamps or cursors, repeated cursors, more than ten pages (100 posts each), a
full page without continuation evidence, or a read exceeding 30 seconds. Each
request also has a 15-second transport timeout.

A whitespace-normalized exact-caption match, missing caption, or empty approved
caption blocks publication conservatively. No candidate observed means only that
this API collection/window returned no candidate. Permission filtering, eventual
consistency, modified captions and visibility restrictions mean a duplicate is
still possible; the manual Page inspection and explicit risk acceptance are
mandatory. Existing diagnostic first-25 results are never consumed as a gate.
All claim, revision, approval, runtime enablement and saved permission-block gates
are rechecked after the scan. No safety block is cleared. The scan's window,
counts and timestamp are retained; raw response bodies/cursors/tokens are not.

The ordinary execute action never prepares or publishes a recovery job. Repeated
recovery clicks race on the existing transactional claim/expected attempt. A
renewed unknown final result again needs a fresh explicit recovery action; there
is no automatic retry. A delayed original response is retained on its historical
attempt and blocks further recovery. An exact-post manual confirmation bound to
that single late remote ID allows unfinished Instagram work to continue while
Facebook remains complete. Multiple known historical outcomes stay blocked.

The UI resets acceptance/evidence on Cancel and submission, locks synchronous
repeat clicks and discards late UI updates after dismissal. Closing the drawer
once submitted does not cancel a server-side publish; reload its saved state
before taking further action. History distinguishes operator observation from
API verification.

Design references: Meta's Page `published_posts` reference and Graph API
pagination/results documentation. A fresh documentation fetch on 2026-10-09
returned HTTP 429; the implementation extends the existing adapter endpoint and
cursor convention and fails closed on unsupported response shapes. No new live
API contract or permission coverage is claimed. Recheck the references and
perform a separately authorized live test before activation:
- https://developers.facebook.com/docs/graph-api/reference/page/published_posts/
- https://developers.facebook.com/docs/graph-api/results/

Canon reviewed read-only through the GitHub connector under founder approval:
434-context commit `068cd39f1fb41ed6290ba432a13af68ec799383d`, master 2.0.30.
No governing artifacts were changed. Base: next-434media `b47a20e` (PR #176).

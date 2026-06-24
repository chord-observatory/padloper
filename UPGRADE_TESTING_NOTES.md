# Upgrade Testing Notes

Testing performed on the `100-user-permissions` branch after the security /
version-bump work (Flask 2→3, Python 3.8→3.10, gremlinpython 3.5→3.7,
aiohttp 3.8→3.10, ES 7.10→7.17, nginx pin, JDK 8→11, React 17→18, axios 0→1,
moment 1.7→2.30) plus the JanusGraph backend-wiring fix and the BJE→Cassandra
migration framework.

All endpoint testing was done in-container against a Cassandra+ES-backed
JanusGraph, using the Flask test client with an injected session to bypass the
`@before_request` auth gate, and a stub user to bypass the permission layer.

## TL;DR

- **No version bump broke a working endpoint.** The Flask 3, gremlinpython 3.7,
  and React 18 upgrades are runtime-clean for the exercised routes.
- **One genuine behavior change** from Flask 3 (`request.json` now returns
  HTTP 415 on a non-JSON `Content-Type`). Does not affect the real UI because
  the frontend always sends `application/json`, but it is a contract change for
  any other client.
- **Several pre-existing bugs surfaced during testing** (unrelated to the
  upgrades). Documented below; not fixed here to keep this branch scoped to
  version bumps + the one search-filter fix.

---

## Verified working

| Area | Routes exercised | Result |
|------|------------------|--------|
| Component list / pagination / ordering | `GET /api/component_list` (asc/desc, range windows) | ✅ correct ordering + windowing |
| Name-substring filter (the `TextP.containing` fix) | `GET /api/component_list?filters=…` | ✅ case-sensitive substring, matches pre-2026 behavior |
| Name lookup | `GET /api/components_name/<name>` (found + missing) | ✅ 200 / 400 as expected |
| Counts | `GET /api/component_count`, `component_type_count` | ✅ |
| Heavy gremlin traversal | `GET /api/components_tree/<name>/<depth>/<time>` | ✅ `withSack`/`repeat`/`union`/`sack`/`simplePath`/`emit`/`path().by(elementMap())` round-trips correctly through the gremlinpython 3.7 client against the 3.5.x server |
| Connection read | `GET /api/get_connections` | ✅ |
| Types + versions | `GET /api/component_types_and_versions` | ✅ |
| Write path (args-based POST) | `POST /api/set_component_type` (create, duplicate, readback) | ✅ creates + persists; duplicate handled gracefully |
| Migration data preservation | Cassandra→GraphSON→Cassandra round-trip | ✅ vertex/edge counts + every endpoint identical before/after |

---

## Potentially breaking changes (from the version bumps)

### 1. `request.json` now returns HTTP 415 on non-JSON Content-Type  (Flask 2.1+ behavior)

Flask 2.0.1 (the previous pin) was lenient about `Content-Type` when accessing
`request.json`. Flask 2.1+ (and therefore 3.0.3) raises
`415 Unsupported Media Type` if the request `Content-Type` is not
`application/json`.

Affected routes (the only two using a JSON body):

- **`POST /api/login`** — `request.json.get(...)` at `app.py:130`. Wrapped in a
  `try/except`, so a non-JSON request degrades to a JSON error response rather
  than a raw 415. The real frontend (`Login.js`, `Header.js`) uses
  `axios.post(url, obj)` which sets `application/json` automatically → unaffected.
- **`POST /api/bulk_input`** — `payload = request.json` at `app.py:2457`, **not**
  wrapped in `try/except`. A request without `Content-Type: application/json`
  returns a raw **415 HTML error page**. The real frontend (`BulkInput.js`)
  sets the header explicitly → unaffected in practice.

**Risk:** any non-axios client (curl, `fetch()` without headers, integration
scripts) that previously POSTed a JSON string without the header will now get
415 instead of being parsed. **Recommendation (follow-up):** use
`request.get_json(silent=True)` + explicit null check, or `request.get_json(force=True)`,
and wrap `bulk_input` in error handling.

---

## Pre-existing bugs surfaced during testing (NOT introduced by the upgrades)

### 2. `escape(None) == 'None'` makes optional substring filters return nothing  [nameSubstring case FIXED]

`escape(request.args.get('nameSubstring'))` yields the literal `Markup('None')`
(a truthy 4-char string) when `nameSubstring` is absent — not `None` or `""`.
That value is then passed to `TextP.containing(...)`, so the query filters for
names containing the literal substring **"None"** and returns an empty list
instead of "all".

Confirmed on **`GET /api/component_type_list`** (`app.py:885,897`):

| Request | Result |
|---------|--------|
| no `nameSubstring` param | **0 results** (filters on "None") ❌ |
| `nameSubstring=tnet` | 1 result ✅ |
| `nameSubstring=` (empty) | all results ✅ |

Same `escape(None)` pattern appears on the other `nameSubstring`-based list
endpoints (`component_version_list`, `flag_type_list`, `flag_list`,
`flag_severity_list`) and any `escape(request.args.get(...))` used as an
`int(...)` (e.g. `int(escape(request.args.get('time')))` → `int('None')` →
`ValueError` → 500 when the arg is missing).

Pre-existing: introduced 2026-02-04 (commit `523981e`), before this branch.
The frontend always sends `nameSubstring` (even empty), so the live UI is
unaffected — but direct/other API callers hit it.

**FIXED for the `nameSubstring` list endpoints** (`component_type_list`,
`component_version_list`, `flag_type_list`, `flag_severity_list`) by
normalizing to `escape(request.args.get('nameSubstring') or '')` — absent now
means "match all". Verified: absent param returns all rows; a real substring
filters correctly; a non-matching substring returns none.

**Still open:** the `int(escape(request.args.get('time')))` variant in the
write endpoints (`component_set_property`, etc.) still 500s with
`int('None')` when `time` is absent. Left as-is — `time` is a required param
those endpoints always receive from the UI; a malformed request producing a
500 is acceptable for now (would need proper 400 validation to fix cleanly).

### 3. `bulk_input` drops the user's `time` and `comments`, and has no error handling

- **Both `timestamp = payload.get('time')` (`app.py:2460`) and
  `comments = payload.get('comments', '')` (`app.py:2461`) are parsed and then
  never used.** The operations instead stamp `p.Timestamp(int(time.time()))`
  (`app.py:2574`, wall-clock "now") and attach no comment. So the timestamp and
  comment the user enters in the UI are silently discarded. Wiring them into the
  per-operation calls is a real change (each operation type consumes timestamps
  differently), **not** a minimal fix — left for a dedicated follow-up.
- Compounding it, the frontend (`BulkInput.js:79`) sends `comment` (singular)
  while the backend reads `comments` (plural) — moot today since the variable
  is unused, but must be aligned when the comment is actually wired in.
- No `try/except` around `request.json` / `payload.get(...)` (`app.py:2457`),
  so malformed input or any downstream error returns a raw 500 HTML page rather
  than the `{'error': ...}` JSON the frontend expects.

### 4. Write endpoints create a vertex named "None" on missing args

`POST /api/set_component_type` with no query args returned `{'result': True}`
and created a `ComponentType` named `"None"` (same `escape(None)` root cause).
Most write endpoints share this pattern. Low severity (requires a malformed
request) but means bad input is silently persisted rather than rejected.

---

## Notes for the eventual prod migration (BJE → Cassandra)

- The migration's schema-apply step (`migrations/001-bje-to-cassandra.groovy`)
  cannot fully evaluate `index_setup.groovy` in a standalone `GroovyShell`
  because that script references the server-bound `g` traversal source. The
  step is wrapped in warn-and-continue; property keys are then auto-created at
  GraphSON import time. **For real data containing LIST-cardinality properties
  (`values`, `permissions`), verify cardinality after migration** — see the
  TODO in that file. The main `janusgraph` service re-applies the schema in a
  proper Gremlin Server context post-migration, which should correct it, but
  this path was only exercised with a fixture that had no LIST properties.

## Migration hardening + rehearsal (2026-06-24) — supersedes the LIST TODO above

The LIST-cardinality risk above is now **fixed** in
`migrations/001-bje-to-cassandra.groovy`:

- Applies the schema (property keys with correct cardinality) to the Cassandra
  graph **before** the GraphSON import, with the `g`-dependent data-seed section
  stripped (it would also have duplicated the master user/group). Schema errors
  are no longer swallowed — a half-applied schema now fails the migration.
- Self-verifies **full data fidelity** and aborts (non-zero exit → main service
  blocked via `service_completed_successfully`) on any mismatch: vertex/edge
  counts, total vertex+edge property counts, per-category vertex breakdown, and
  the admin `permissions` LIST size.

Rehearsed twice locally against a synthetic BerkeleyJE graph carrying a
28-element `permissions` LIST (the exact prod risk), running the real
`run-migrations.sh` framework into Cassandra+ES:

- ✅ LIST preserved 28→28; full fingerprint matched source→target.
- ✅ Negative control (import without schema-first) collapses the list to 1,
  confirming both the failure mode and that schema-first prevents it.

Live-node findings (10.220.1.9): JanusGraph **1.1.0** already running, but on
embedded BerkeleyJE (silent `JANUS_PROPS_TEMPLATE=berkeleyje-lucene` fallback);
deployed commit `48af3a6` predates the wiring fix. Baseline 161 V / 257 E /
admin permissions 28. Cold backup taken
(`/padloper/backups/janusgraph-bje-20260624T162640Z.tgz`); prod verified healthy
after the backup stop/restart cycle. **Cutover procedure: see
`migrations/CUTOVER_RUNBOOK.md`.**

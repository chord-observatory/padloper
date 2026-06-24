# Production cutover runbook — BerkeleyJE → Cassandra+ES (JanusGraph 1.1.0)

Move the live Padloper graph off the silently-active embedded BerkeleyJE backend
onto the intended Cassandra+ES backend, staying on JanusGraph 1.1.0 (TinkerPop
3.7, which provides `TextP.regex`). Safe and reversible: the migration only
*reads* BerkeleyJE, self-verifies full data fidelity, and blocks go-live on any
mismatch.

## State at time of writing (verified on node 10.220.1.9)

- Running: JanusGraph **1.1.0**, but on embedded **BerkeleyJE+Lucene**
  (`JANUS_PROPS_TEMPLATE=berkeleyje-lucene`). Cassandra+ES run but are unused.
- Deployed commit: `48af3a6` (predates the wiring fix + migration framework).
- Data baseline: **161 vertices, 257 edges**; categories
  `component:115, sequence:19, component_type:15, user:7, user_group:5`;
  LIST `permissions` on 3 vertices (admin group = 28); `values` empty.
- Cold backup taken: `/padloper/backups/janusgraph-bje-20260624T162640Z.tgz`
  (650,786 bytes, sha256 `77ceed45721c71ffe108d74297ed7a9bcc9aea24671d7747ce8871af5891e0d0`).

## Prerequisites (do before the window)

1. **Commit + push the fixes** on `100-user-permissions`:
   - `Dockerfile.janusgraph`: `ARG JG_VERSION=1.1.0` (was hard-pinned 0.6.2).
   - `migrations/001-bje-to-cassandra.groovy`: schema-applied-before-import,
     seed stripped, full-fidelity verification (V/E counts, total vertex+edge
     property counts, per-category breakdown, admin LIST) — aborts on mismatch.
   - Validated by two local rehearsals (LIST preserved 28→28; negative control
     collapses to 1; full fingerprint matches).
2. Confirm prod is healthy now: `g.V().count()`==161, `g.E().count()`==257.
3. Pick a low-traffic maintenance window (expected downtime: a few minutes;
   migration on ~8 MB is near-instant — most of the time is Cassandra/ES warmup
   and image build).

## Cutover (run on the prod node, in /padloper/padloper)

```bash
# 0. fresh consistent backup (in addition to the one already taken)
docker compose stop flask-interface janusgraph
docker run --rm -v padloper_chord_janusgraph_data:/data:ro -v /padloper/backups:/backup alpine \
  sh -c 'tar czf /backup/janusgraph-bje-precutover-$(date -u +%Y%m%dT%H%M%SZ).tgz -C /data .'

# 1. get the fixes
git fetch origin && git checkout 100-user-permissions && git pull --ff-only

# 2. build + bring up. janusgraph-migrate runs FIRST (BJE lock is free because
#    janusgraph is stopped), migrates BJE->Cassandra, self-verifies, and only
#    on success (service_completed_successfully) does the main janusgraph start
#    on the cql-es wiring, then flask-interface.
docker compose up -d --build
```

## Verify (gate before declaring success)

```bash
# migration must have completed cleanly
docker compose logs janusgraph-migrate | grep -E 'fidelity checks OK|migration 001 complete|ERROR'
# main service must be bound to CQL, not berkeleyje
docker compose exec janusgraph sh -c 'echo $JANUS_PROPS_TEMPLATE'   # -> cql-es
# data present in Cassandra (not an empty store):
#   g.V().count()==161, g.E().count()==257, admin permissions==28
# cassandra now has the janusgraph keyspace:
docker compose exec cassandra cqlsh -e 'DESCRIBE KEYSPACES' | grep janusgraph
# app: load a component list / search endpoint through the UI
```

If `janusgraph-migrate` exited non-zero, the main `janusgraph` service will NOT
have started (by design) — investigate the migrate logs before proceeding. No
data is lost: BerkeleyJE was only read.

## Rollback (instant, data-safe)

The BerkeleyJE `.jdb` is untouched in `padloper_chord_janusgraph_data`.

```bash
git checkout 48af3a6            # pre-fix commit: 1.1.0 image, berkeleyje-lucene
docker compose up -d --build    # back on the original BerkeleyJE data
```

Or restore the tarball into a fresh volume if the volume itself is suspect.
Cassandra keyspace `janusgraph` can be dropped and the migration re-run (the
runner marker lives in the volume at `.migrations/`; clear it to re-run).

## After cutover is stable (Phase 4)

- Ship the regex change: `TextP.containing(x)` → `TextP.regex("(?i)" + re.escape(x))`
  across the ~8 list-filter sites in `flask-interface/app.py` (case-insensitive
  search — the reason for wanting 1.1.0 in the first place).
- Delete the validated `precutover` backups per your retention policy.

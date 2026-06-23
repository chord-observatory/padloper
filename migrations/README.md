# Migrations

A tiny shell-script-based migration framework that runs automatically on
`docker compose up`. Each migration is a script in this directory named
`NNN-description.sh`. The runner (`run-migrations.sh`) executes any not yet
marked as done, in numeric order, before the main `janusgraph` service starts.

## How it runs

`docker-compose.yml` defines a one-shot service `janusgraph-migrate` that
shares the `janusgraph_data` volume with the main `janusgraph` service. Its
entrypoint is `/usr/local/bin/run-migrations.sh`. The main `janusgraph`
service has `depends_on: janusgraph-migrate: condition: service_completed_successfully`,
so any migration failure prevents the main service from starting (visible
exit code, logs accessible via `docker compose logs janusgraph-migrate`).

## Marker files

Successful migrations write `/var/lib/janusgraph/.migrations/<name>.done`.
That directory is inside the persistent volume, so markers survive container
recreation. Wiping the volume re-triggers all migrations — they should each
detect their own "already-applied" state internally as a backstop.

To re-run a specific migration manually (e.g. after fixing a bug in the
script):

```bash
docker compose run --rm janusgraph-migrate sh -c \
    "rm /var/lib/janusgraph/.migrations/NNN-foo.done && /usr/local/bin/run-migrations.sh"
```

## Adding a new migration

1. Pick the next number. Today: 002, 003, ...
2. Write `migrations/NNN-description.sh`. The script must:
   - Be idempotent (re-running with the marker present must be a no-op).
   - Exit 0 on success, non-zero on failure.
   - Self-detect "nothing to do" cases (e.g. fresh install) and exit 0.
3. If you need a Groovy companion (for graph operations), name it
   `NNN-description.groovy` next to the `.sh`.
4. Rebuild: `docker compose build janusgraph-migrate`. The next `up` will
   pick up the new migration.

## Existing migrations

| # | File | Purpose |
|---|---|---|
| 001 | `001-bje-to-cassandra.sh` + `.groovy` | One-time move from the silently-active embedded BerkeleyJE backend to the intended Cassandra+ES backend, run alongside the docker-compose / Dockerfile wiring fix that switched `JANUS_PROPS_TEMPLATE` to `cql-es`. Fresh installs become no-ops. |

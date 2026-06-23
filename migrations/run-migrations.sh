#!/bin/bash
#
# Migration runner.
#
# Iterates over numbered migration scripts in /opt/migrations/ and runs any
# not yet marked as done. Each migration is one shell script named
# NNN-description.sh. A marker file at
# /var/lib/janusgraph/.migrations/NNN-description.done means "already done";
# the migration is skipped on subsequent runs.
#
# Migrations are run in numeric order. If any migration fails, the runner
# stops and exits non-zero (which, via depends_on: service_completed_successfully
# in docker-compose, prevents the main janusgraph service from starting).
#
# To add a new migration: drop NNN-description.sh in the migrations/ dir of
# the repo. It will be copied into the image and picked up on next `up`.
# Migration scripts must be idempotent — they should detect their own
# "already-applied" state and exit 0, in case the marker dir was wiped.

set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/opt/migrations}"
MARKER_DIR="${MARKER_DIR:-/var/lib/janusgraph/.migrations}"

mkdir -p "$MARKER_DIR"

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/[0-9][0-9][0-9]-*.sh)
shopt -u nullglob

if [ ${#migrations[@]} -eq 0 ]; then
    echo "[run-migrations] no migration scripts found in $MIGRATIONS_DIR"
    exit 0
fi

for migration in "${migrations[@]}"; do
    name=$(basename "$migration" .sh)
    marker="$MARKER_DIR/$name.done"

    if [ -f "$marker" ]; then
        echo "[run-migrations] $name: already done, skipping"
        continue
    fi

    echo "[run-migrations] $name: running"
    if bash "$migration"; then
        printf '%s\t%s\n' "$(date -Iseconds)" "$name" > "$marker"
        echo "[run-migrations] $name: complete"
    else
        rc=$?
        echo "[run-migrations] $name: FAILED with rc=$rc — aborting" >&2
        exit "$rc"
    fi
done

echo "[run-migrations] all migrations up to date"

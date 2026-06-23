#!/bin/bash
#
# Migration 001: move data from embedded BerkeleyJE backend to Cassandra+ES.
#
# Context: the original repo's docker-compose intended Cassandra+ES, but two
# wiring bugs (wrong props filename + missing JANUS_PROPS_TEMPLATE env) caused
# JanusGraph to silently fall back to embedded BerkeleyJE for ~5 months. The
# 2-line wiring fix lands in the same change set as this migration. Any
# existing install with BJE data needs that data moved into Cassandra before
# the app sees an empty store.
#
# Idempotency: the runner's marker file controls re-execution at the runner
# level. This script also self-detects fresh-install state (no .jdb files)
# and exits 0, so it's safe to re-run even if the marker is wiped.

set -euo pipefail

DATA_DIR="${JANUS_DATA_DIR:-/var/lib/janusgraph}/data"

# Detect: any BJE data to migrate?
if ! ls "$DATA_DIR"/*.jdb >/dev/null 2>&1; then
    echo "[001] no BJE .jdb files in $DATA_DIR — fresh install or already migrated"
    exit 0
fi

echo "[001] BJE data detected at $DATA_DIR — preparing migration"

# Wait for Cassandra and Elasticsearch (compose service names resolve via DNS)
wait_for_tcp() {
    local host="$1" port="$2" label="$3"
    echo "[001] waiting for $label ($host:$port)..."
    for i in $(seq 1 90); do
        if (exec 3<>/dev/tcp/"$host"/"$port") 2>/dev/null; then
            exec 3<&- 3>&-
            echo "[001] $label ready"
            return 0
        fi
        sleep 2
    done
    echo "[001] timed out waiting for $label" >&2
    return 1
}

wait_for_tcp cassandra 9042 cassandra
wait_for_tcp elasticsearch 9200 elasticsearch

# Sanity: refuse to overwrite a non-empty Cassandra-backed graph. The CQL
# graph being non-empty here means someone already migrated (or wrote new
# data) but the marker was wiped. Operator should review before proceeding.
if /opt/janusgraph/bin/gremlin.sh -e /opt/migrations/001-check-cql-empty.groovy 2>/dev/null | grep -q '^CQL_HAS_DATA$'; then
    echo "[001] Cassandra-backed JanusGraph already has data — refusing to overwrite" >&2
    echo "[001] If this is unexpected, inspect with: gremlin.sh and decide manually." >&2
    exit 2
fi

# Run the export/import. Pure groovy script using JanusGraphFactory directly,
# no embedded gremlin server needed.
echo "[001] running export+import groovy script"
/opt/janusgraph/bin/gremlin.sh -e /opt/migrations/001-bje-to-cassandra.groovy

echo "[001] BJE→Cassandra migration complete"
echo "[001] The original BJE .jdb files remain in $DATA_DIR for rollback."
echo "[001] They can be deleted (or the volume reset) once you've validated the migration."

#!/usr/bin/env bash
set -euo pipefail

# Bootstrap helper for JanusGraph schema seeding and admin mapping.
#
# Usage:
#   bash scripts/bootstrap_graph.sh <github_login>
#     - Default: applies schema (if missing) and maps <github_login> to admin.
#   bash scripts/bootstrap_graph.sh init <github_login>
#     - Same as default.
#   bash scripts/bootstrap_graph.sh schema
#     - Applies schema only.
#   bash scripts/bootstrap_graph.sh map-admin <github_login>
#     - Maps <github_login> to the admin group (ensuring user/group exist).

# Allow override via environment; default to 'janusgraph'
JANUS_CONTAINER="${JANUS_CONTAINER:-janusgraph}"
FLASK_CONTAINER="${FLASK_CONTAINER:-flask-interface}"

# Resolve repo root so the script can be run from any directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

wait_for_schema() {
  # Simple settle delay to allow schema commits to propagate.
  local delay="${1:-5}"
  echo "[bootstrap] Allowing schema to settle for ${delay}s …"
  sleep "$delay"
}

require_container() {
  if ! docker ps --format '{{.Names}}' | grep -qx "$JANUS_CONTAINER"; then
    echo "Error: Container '$JANUS_CONTAINER' is not running. Run 'docker compose up -d' first." >&2
    exit 1
  fi
}

require_backend() {
  if ! docker ps --format '{{.Names}}' | grep -qx "$FLASK_CONTAINER"; then
    echo "Error: Container '$FLASK_CONTAINER' is not running. Run 'docker compose up -d' first." >&2
    exit 1
  fi
}

cmd_schema() {
  require_container
  if [ ! -f "$REPO_ROOT/index_setup.txt" ]; then
    echo "Error: index_setup.txt not found at repo root." >&2
    exit 1
  fi
  echo "[bootstrap] Applying schema and seeding admin via index_setup.txt …"
  # Filter out comment lines starting with '#' which Groovy won't accept.
  sed -E '/^[[:space:]]*#/d' "$REPO_ROOT/index_setup.txt" | docker exec -i "$JANUS_CONTAINER" bin/gremlin.sh
  echo "[bootstrap] Schema applied."
  # Wait until the schema is visible on the server before proceeding.
  wait_for_schema 5
}

cmd_map_admin() {
  require_container
  local login="${1:-}"
  if [ -z "$login" ]; then
    echo "Usage: bash scripts/bootstrap_graph.sh map-admin <github_login>" >&2
    exit 1
  fi
  # Guard: ensure schema exists when running map-admin directly (skip if called from init)
  if [ "${BOOTSTRAP_INIT:-0}" != "1" ]; then
    probe=$(schema_probe)
    if [ "$probe" != "EXISTS" ]; then
      echo "Error: Schema does not appear to be applied. Run 'bootstrap_graph.sh init $login' or 'bootstrap_graph.sh schema' first." >&2
      exit 1
    fi
  fi
  echo "[bootstrap] Mapping user '$login' to admin group (creating user/group if missing) …"
  require_backend
  docker exec -i "$FLASK_CONTAINER" sh -lc "export PYTHONPATH=\$PYTHONPATH:/; python3 -m padloper.scripts.init_user-groups --skip-default-groups --ensure-admin '$login' --actor master"
  echo "[bootstrap] Admin mapping complete for '$login'."
}

main() {
  local subcmd="${1:-}"
  case "$subcmd" in
    init)
      shift
      local login="${1:-}"
      if [ -z "$login" ]; then
        echo "Usage: bash scripts/bootstrap_graph.sh init <github_login>" >&2
        exit 1
      fi
      echo "[bootstrap] Initializing schema and admin mapping for '$login' …"
      BOOTSTRAP_INIT=1
      cmd_schema
      cmd_map_admin "$login"
      ;;
    schema)
      cmd_schema
      ;;
    map-admin)
      shift
      cmd_map_admin "${1:-}"
      ;;
    "")
      cat >&2 <<USAGE
Usage:
  bash scripts/bootstrap_graph.sh <github_login>
  bash scripts/bootstrap_graph.sh init <github_login>
  bash scripts/bootstrap_graph.sh schema
  bash scripts/bootstrap_graph.sh map-admin <github_login>
USAGE
      exit 1
      ;;
    *)
      # Default: treat the first argument as the GitHub login and run init
      local login="$subcmd"
      echo "[bootstrap] Initializing schema and admin mapping for '$login' …"
      BOOTSTRAP_INIT=1
      cmd_schema
      cmd_map_admin "$login"
      ;;
  esac
}

main "$@"

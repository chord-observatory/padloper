#!/usr/bin/env python3
"""Rename padloper users, e.g. from GitHub logins to FreeIPA usernames.

Each User vertex is renamed, and so is every record of who did something
that names the old user: the properties called `uid`, ending in `_uid` or
starting with `uid_` (start_uid, end_uid, uid_added, uid_disabled, ...) on
all vertices and edges. Nothing is written unless --apply is given.

Back up the graph volumes first. In the Docker deployment:

    docker exec flask-interface sh -c "PYTHONPATH=/ python3 \\
        /padloper/scripts/rename_users.py jbmertens=jmertens s8dacost=sdacosta"

then the same with --apply.
"""
import argparse
import sys

import padloper  # noqa: F401  (puts padloper's modules on the import path)
import _global as g

USER_CATEGORY = 'user'


def uid_keys():
    """Property keys that record which user did something."""
    keys = set(g.t.V().properties().key().dedup().toList())
    keys |= set(g.t.E().properties().key().dedup().toList())
    return sorted(k for k in keys
                  if k == 'uid' or k.endswith('_uid') or k.startswith('uid_'))


def parse_renames(parser, args):
    pairs = []
    for arg in args:
        old, sep, new = arg.partition('=')
        if not sep or not old or not new:
            parser.error(f"expected OLD=NEW, got {arg!r}")
        if old != new:
            pairs.append((old, new))
    olds = [old for old, _ in pairs]
    news = [new for _, new in pairs]
    if len(set(olds)) != len(olds) or len(set(news)) != len(news):
        parser.error("each name may appear only once on each side")
    if set(olds) & set(news):
        parser.error("a name cannot be both renamed and a rename target; "
                     "run chained renames separately")
    return pairs


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('renames', nargs='+', metavar='OLD=NEW')
    parser.add_argument('--apply', action='store_true',
                        help="write the changes (default: only report them)")
    args = parser.parse_args()
    pairs = parse_renames(parser, args.renames)

    def users():
        return g.t.V().has('category', USER_CATEGORY)

    problems = []
    for old, new in pairs:
        found = users().has('name', old).count().next()
        if found != 1:
            problems.append(f"{old}: expected one User, found {found}")
        if users().has('name', new).count().next():
            problems.append(f"{new}: a User with this name already exists")
    if problems:
        print("\n".join(problems), file=sys.stderr)
        sys.exit("Nothing changed.")

    keys = uid_keys()
    print("Who-did-what properties: " + ", ".join(keys))
    for old, new in pairs:
        counts = {}
        for key in keys:
            n_vertices = g.t.V().has(key, old).count().next()
            n_edges = g.t.E().has(key, old).count().next()
            if n_vertices or n_edges:
                counts[key] = (n_vertices, n_edges)
        detail = "".join(f"; {key}: {nv} vertices, {ne} edges"
                         for key, (nv, ne) in counts.items())
        print(f"{old} -> {new}: User vertex{detail}")

        if args.apply:
            users().has('name', old).property('name', new).iterate()
            for key in counts:
                g.t.V().has(key, old).property(key, new).iterate()
                g.t.E().has(key, old).property(key, new).iterate()

    print("Applied." if args.apply else "Dry run; re-run with --apply to write.")


if __name__ == '__main__':
    main()

import argparse
import padloper as p
from padloper import _global as g


PROTECTED_PERMISSIONS = [
    'Component;add',
    'Component;replace',
    'Component;unset_property',
    'Component;replace_property',
    'Component;disable_property',
    'Component;disconnect',
    'Component;disable_connection',
    'Component;disable_subcomponent',
    'Component;subcomponent_connect',
    'ComponentType;add',
    'ComponentType;replace',
    'ComponentVersion;add',
    'ComponentVersion;replace',
    'PropertyType;add',
    'PropertyType;replace',
    # Property add
    'Property;add',
    # Flags
    'FlagSeverity;add',
    'FlagSeverity;replace',
    'Flag;replace',
]

GENERAL_PERMISSIONS = [
    'Component;connect',
    'Component;set_property',
    'Flag;add',
    'Flag;end_flag',
]


def ensure_group(name, permissions):
    try:
        grp = p.UserGroup.from_db(name)
        return grp
    except Exception:
        grp = p.UserGroup(name=name, permissions=permissions)
        grp.add(permissions=[])
        return grp


def drop_group(name):
    try:
        g.t.V().has('category', p.UserGroup.category).has('name', name).drop().iterate()
    except Exception:
        pass


def ensure_user(name):
    try:
        return p.User.from_db(name)
    except Exception:
        u = p.User(name=name)
        u.add(permissions=[])
        return u


def map_user_to_group(user_name, group_name):
    user = ensure_user(user_name)
    group = ensure_group(group_name, [])
    user.add_group(group)


def main():
    ap = argparse.ArgumentParser(description='Create default user groups and/or map a user to admin group')
    ap.add_argument('--reset-default-groups', action='store_true', help='Drop and recreate Default/Protected/General')
    ap.add_argument('--skip-default-groups', action='store_true', help='Skip ensuring Default/Protected/General groups')
    ap.add_argument('--ensure-admin', metavar='GITHUB_LOGIN', help='Ensure admin group exists and map this user to it (user auto-created if missing)')
    ap.add_argument('--actor', default='master', help='DB user to attribute writes as (default: master)')
    args = ap.parse_args()

    # Set a stub actor for write stamping immediately; then try to set a real user
    g._user = type("_Stub", (), {"name": args.actor})()
    try:
        p.set_user(args.actor)
    except Exception:
        # keep stub
        pass

    if args.reset_default_groups:
        for nm in ('Protected', 'General', 'Default'):
            drop_group(nm)

    if not args.skip_default_groups:
        ensure_group('Default', ['*'])
        ensure_group('Protected', PROTECTED_PERMISSIONS)
        ensure_group('General', GENERAL_PERMISSIONS)

    if args.ensure_admin:
        # Ensure admin group (grant all known permissions from padloper)
        ensure_group('admin', sorted(list(p.permissions_set)))
        map_user_to_group(args.ensure_admin, 'admin')


if __name__ == '__main__':
    main()

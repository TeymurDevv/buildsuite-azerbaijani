#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
umask 077
mkdir -p private
for file in private/database-password private/administrator-password; do
    if [[ ! -e "$file" ]]; then
        python3 - "$file" <<'PY'
import os, secrets, sys
with os.fdopen(os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as out:
    out.write(secrets.token_urlsafe(32) + "\n")
PY
    fi
done
compose=(docker compose -f compose.yaml)
"${compose[@]}" up -d --wait db cache queue
"${compose[@]}" build backend
export BUILDSUITE_DB_PASSWORD="$(cat private/database-password)"
export BUILDSUITE_ADMIN_PASSWORD="$(cat private/administrator-password)"
"${compose[@]}" run --rm -T --no-deps -e BUILDSUITE_DB_PASSWORD -e BUILDSUITE_ADMIN_PASSWORD backend bash -s < initialize.sh
unset BUILDSUITE_DB_PASSWORD BUILDSUITE_ADMIN_PASSWORD
"${compose[@]}" run --rm -T --no-deps backend env/bin/python - < configure_language.py
"${compose[@]}" up --no-build -d backend websocket worker scheduler web
printf '%s\n' 'Open http://localhost:8765/login?_lang=az&redirect-to=%2Fcore' 'Login: Administrator' 'Local password: local-runtime/private/administrator-password'

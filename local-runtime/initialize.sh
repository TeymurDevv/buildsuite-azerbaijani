#!/usr/bin/env bash
set -euo pipefail
site=buildsuite.localhost
# All app services share this sites volume and have the same image and checkout mount.
if [[ ! -e sites/assets ]]; then
    ln -s /home/frappe/frappe-bench/assets sites/assets
fi
printf 'frappe\nerpnext\nbuildsuite_core\n' > sites/apps.txt
bench set-config -g db_host db
bench set-config -gp db_port 3306
bench set-config -g redis_cache redis://cache:6379
bench set-config -g redis_queue redis://queue:6379
bench set-config -g redis_socketio redis://queue:6379
bench set-config -gp socketio_port 9000
# Prefer the Chromium shipped in this image when it can render and the operator
# has not configured another browser. The native PDF engine reads the common config.
packaged_chromium=/usr/lib/chromium/chromium-headless-shell
if [[ -x "$packaged_chromium" ]] && env/bin/python -c \
    'import json, sys; sys.exit("chromium_path" in json.load(open("sites/common_site_config.json")))' && \
    timeout 10 "$packaged_chromium" --no-sandbox --disable-dev-shm-usage --dump-dom \
        'data:text/html,<title>BuildSuite PDF</title>' 2>/dev/null | grep -q '<title>BuildSuite PDF</title>'; then
    bench set-config -g chromium_path "$packaged_chromium"
fi
if [[ ! -f "sites/$site/site_config.json" ]]; then
    bench new-site "$site" --db-root-username root --db-root-password "$BUILDSUITE_DB_PASSWORD" \
      --mariadb-user-host-login-scope='%' --admin-password "$BUILDSUITE_ADMIN_PASSWORD" --set-default
fi
bench --site "$site" install-app erpnext
bench --site "$site" install-app buildsuite_core
bench --site "$site" set-config host_name http://localhost:8765
bench --site "$site" enable-scheduler

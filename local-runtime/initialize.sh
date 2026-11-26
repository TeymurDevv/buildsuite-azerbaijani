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
if [[ ! -f "sites/$site/site_config.json" ]]; then
    bench new-site "$site" --db-root-username root --db-root-password "$BUILDSUITE_DB_PASSWORD" \
      --mariadb-user-host-login-scope='%' --admin-password "$BUILDSUITE_ADMIN_PASSWORD" --set-default
fi
bench --site "$site" install-app erpnext
bench --site "$site" install-app buildsuite_core
bench --site "$site" set-config host_name http://localhost:8765
bench --site "$site" enable-scheduler

#!/usr/bin/env bash
# One-time operator setup on the existing production host; does not restart the app.
set -euo pipefail
[[ $EUID == 0 && $# == 1 && -f $1 ]] || {
  echo 'Usage: sudo deploy/install-delivery-controls.sh /path/to/deploy-key.pub' >&2
  exit 2
}
public_key=$(cat -- "$1")
[[ $public_key =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] || exit 2
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
test -f /opt/arena-criolla/compose.yaml
test -f /etc/arena-criolla/release.env
test -f /workspace/arena-criolla-production/data/creator/arena.sqlite
test -f /opt/arena-criolla/backup.py
command -v python3 >/dev/null
docker compose version
account=arena-deploy
account_home=/var/lib/arena-criolla-deploy-ssh
if ! id "$account" >/dev/null 2>&1; then
  useradd --system --user-group --home-dir "$account_home" --shell /bin/bash "$account"
fi
# Root owns the home and key. The account cannot replace its forced command.
test "$(id -Gn "$account")" = "$account"
install -d -m 755 -o root -g root "$account_home" "$account_home/.ssh"
printf 'restrict,command="/usr/local/bin/arena-receive-release" %s\n' "$public_key" \
  > "$account_home/.ssh/authorized_keys"
chmod 644 "$account_home/.ssh/authorized_keys"
chown root:root "$account_home/.ssh/authorized_keys"
install -m 755 deploy/receive-release /usr/local/bin/arena-receive-release
install -m 755 deploy/install-release.py /usr/local/sbin/arena-install-release
install -d -m 755 /usr/local/lib/arena-criolla-deploy
install -m 644 scripts/security-smoke.mjs /usr/local/lib/arena-criolla-deploy/security-smoke.mjs
install -d -m 700 /var/lib/arena-criolla-deploy
sudoers=$(mktemp)
trap 'rm -f "$sudoers"' EXIT
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/arena-install-release *\n' "$account" > "$sudoers"
visudo -cf "$sudoers"
install -m 440 "$sudoers" /etc/sudoers.d/arena-criolla-deploy
install -m 644 deploy/sshd-deploy.conf /etc/ssh/sshd_config_arena_deploy
/usr/sbin/sshd -t -f /etc/ssh/sshd_config_arena_deploy
install -m 644 deploy/arena-criolla-deploy-sshd.service /etc/systemd/system/arena-criolla-deploy-sshd.service
systemctl daemon-reload
systemctl enable arena-criolla-deploy-sshd.service
systemctl restart arena-criolla-deploy-sshd.service
# Keep operator SSH on port 22 unchanged. Persist only this dedicated listener rule.
if ! iptables -C INPUT -p tcp --dport 2222 -m comment --comment arena-criolla-deploy -j ACCEPT 2>/dev/null; then
  iptables -I INPUT 1 -p tcp --dport 2222 -m comment --comment arena-criolla-deploy -j ACCEPT
fi
python3 - <<'PY'
from pathlib import Path
path = Path('/etc/iptables/rules.v4')
rule = '-A INPUT -p tcp --dport 2222 -m comment --comment arena-criolla-deploy -j ACCEPT'
value = path.read_text()
if rule not in value.splitlines():
    offset = value.index('-A INPUT ')
    path.write_text(value[:offset] + rule + '\n' + value[offset:])
PY
echo 'Delivery controls installed. The current application has not been restarted.'

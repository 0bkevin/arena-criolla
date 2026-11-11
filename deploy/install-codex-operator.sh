#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo 'Run this installer with sudo on the Oracle host.' >&2
  exit 1
fi
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
command -v docker >/dev/null

operator_image=arena-criolla:codex-operator-v6
docker build -f deploy/codex-operator.Dockerfile -t "$operator_image" .
docker run --rm --network none --entrypoint /usr/local/bin/codex \
  "$operator_image" --version

if ! getent passwd arena-codex >/dev/null; then
  useradd --system --home-dir /var/lib/arena-codex --no-create-home \
    --shell /usr/sbin/nologin arena-codex
fi
for directory in /var/lib/arena-codex /var/lib/arena-codex/.codex \
  /var/lib/arena-codex/inputs /var/lib/arena-codex/photos \
  /var/lib/arena-codex/jobs; do
  install -d -m 700 -o arena-codex -g arena-codex "$directory"
done
install -m 755 deploy/arena-codex /usr/local/bin/arena-codex
/usr/local/bin/arena-codex version
echo 'Private Codex installed: Luna High, ChatGPT subscription allowance followed by credits, no API fallback.'

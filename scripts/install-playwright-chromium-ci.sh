#!/usr/bin/env bash
set -euo pipefail

# GitHub's Ubuntu runner can occasionally resolve its generated mirror list to
# an unavailable azure.archive.ubuntu.com endpoint. Playwright --with-deps then
# waits inside apt before any browser test can start. Keep the dependency gate
# intact, but prefer Ubuntu's stable archive and bound transient network waits.
if [[ -f /etc/apt/apt-mirrors.txt ]]; then
  printf '%s\n' 'https://archive.ubuntu.com/ubuntu' | sudo tee /etc/apt/apt-mirrors.txt >/dev/null
fi

for source_file in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
  [[ -f "$source_file" ]] || continue
  sudo sed -i \
    -e 's|http://azure.archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' \
    -e 's|https://azure.archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' \
    "$source_file"
done

sudo tee /etc/apt/apt.conf.d/99wewed-ci-network >/dev/null <<'EOF'
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
Acquire::Retries "3";
EOF

export PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000
bunx playwright install --with-deps chromium

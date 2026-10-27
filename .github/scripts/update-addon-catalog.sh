#!/usr/bin/env bash
set -euo pipefail

version="${1:?version is required}"
channel="${2:?channel is required}"

case "$channel" in
  latest) addon=hamh ;;
  alpha) addon=hamh-alpha ;;
  testing) addon=hamh-testing ;;
  *)
    echo "Unsupported release channel: $channel" >&2
    exit 1
    ;;
esac

python3 - "$addon/config.yaml" "$version" <<'PY'
import re
import sys
from pathlib import Path

config = Path(sys.argv[1])
version = sys.argv[2]
if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?", version):
    raise SystemExit(f"Invalid release version: {version}")

text = config.read_text()
updated, count = re.subn(
    r"^version:.*$",
    f'version: "{version}"',
    text,
    count=1,
    flags=re.MULTILINE,
)
if count != 1:
    raise SystemExit(f"Could not find version field in {config}")
config.write_text(updated)
PY

if git diff --quiet -- "$addon/config.yaml"; then
  echo "$addon already has version $version"
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add "$addon/config.yaml"
git commit \
  -m "chore(addons): release $addon $version" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push origin HEAD:main

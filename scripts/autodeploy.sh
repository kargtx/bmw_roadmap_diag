#!/bin/sh
set -eu

INTERVAL_SECONDS="${INTERVAL_SECONDS:-3600}"
REPO_DIR="${REPO_DIR:-/repo}"
APP_SERVICE="${APP_SERVICE:-app}"

apk add --no-cache git openssh-client docker-cli docker-cli-compose >/dev/null

echo "[autodeploy] started. checking every ${INTERVAL_SECONDS}s"

while true; do
  if [ -d "${REPO_DIR}/.git" ]; then
    git config --global --add safe.directory "${REPO_DIR}" >/dev/null 2>&1 || true
    git -C "${REPO_DIR}" fetch --quiet || true
    LOCAL_REV="$(git -C "${REPO_DIR}" rev-parse HEAD 2>/dev/null || echo '')"
    REMOTE_REV="$(git -C "${REPO_DIR}" rev-parse @{u} 2>/dev/null || echo '')"

    if [ -n "${LOCAL_REV}" ] && [ -n "${REMOTE_REV}" ] && [ "${LOCAL_REV}" != "${REMOTE_REV}" ]; then
      echo "[autodeploy] update found. pulling and rebuilding..."
      git -C "${REPO_DIR}" pull --ff-only || true
      docker compose -f "${REPO_DIR}/docker-compose.yml" up -d --build "${APP_SERVICE}"
      echo "[autodeploy] deploy done"
    else
      echo "[autodeploy] no updates"
    fi
  else
    echo "[autodeploy] repo not found at ${REPO_DIR}" >&2
  fi

  sleep "${INTERVAL_SECONDS}"
done

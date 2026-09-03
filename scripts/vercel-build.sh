#!/usr/bin/env bash

set -euo pipefail

if [[ "${VERCEL_ENV:-}" == "production" ]]; then
  if [[ -z "${DATABASE_URL_UNPOOLED:-}" ]]; then
    echo 'Production Vercel builds require DATABASE_URL_UNPOOLED.' >&2
    exit 1
  fi

  if [[ "$DATABASE_URL_UNPOOLED" == *"-pooler."* ]]; then
    echo 'Production migrations require a direct, non-pooled PostgreSQL connection.' >&2
    exit 1
  fi

  pnpm db:migrate
  pnpm db:verify
fi

pnpm build

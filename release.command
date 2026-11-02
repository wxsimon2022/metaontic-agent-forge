#!/bin/bash
set -e
cd "$(dirname "$0")"
node scripts/release.mjs --interactive

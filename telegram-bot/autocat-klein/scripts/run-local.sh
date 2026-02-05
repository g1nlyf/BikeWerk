#!/bin/bash
# Run autocat locally with TS-Node
# Assumes Redis is running locally

cd "$(dirname "$0")/.."
npm run autocat -- "$@"

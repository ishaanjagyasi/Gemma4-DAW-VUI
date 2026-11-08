#!/bin/sh
# Upload the app to the Hugging Face Space (needs `hf auth login` with a token that can write to the Space):
#   sh scripts/deploy-space.sh
# Only the files the Space needs are sent (of the data, just the Assignment 3 trial pool); results never leave this machine through here.
set -e
cd "$(dirname "$0")/.."
SPACE=ishaanjagyasi/MP_AI_assist_Gemma4
dir=$(mktemp -d)
cp -R app lib server.js package.json "$dir"
mkdir "$dir/data" && cp data/study.json "$dir/data/"
cp space/Dockerfile space/start.sh space/README.md training/Modelfile "$dir"
hf upload "$SPACE" "$dir" . --repo-type space --commit-message "Deploy the app"
rm -rf "$dir"

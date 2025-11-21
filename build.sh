#!/bin/bash

# Build script for Thunderbird-Todoist Extension

set -e  # Exit on error

echo "Building Thunderbird-Todoist Extension..."

# Remove old build if exists
if [ -f "thunderbird-todoist.xpi" ]; then
    echo "Removing old build..."
    rm thunderbird-todoist.xpi
fi

# Create XPI (zip) package
echo "Packaging extension..."
zip -r thunderbird-todoist.xpi \
    manifest.json \
    background.js \
    popup.js \
    popup.html \
    compose-popup.js \
    compose-popup.html \
    config.js \
    config.html \
    styles.css \
    icons/ \
    -x "*.DS_Store" "*.git*" "*build.sh*"

echo "✓ Build complete: thunderbird-todoist.xpi"
echo ""
echo "To install:"
echo "1. Open Thunderbird"
echo "2. Go to Tools → Add-ons and Themes"
echo "3. Click gear icon → Install Add-on From File"
echo "4. Select thunderbird-todoist.xpi"

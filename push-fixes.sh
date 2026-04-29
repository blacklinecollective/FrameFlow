#!/bin/bash
# Run this once in Terminal to push all fixes to GitHub.
# Usage:  bash ~/Documents/GitHub/FrameFlow/push-fixes.sh

set -e
REPO="$HOME/Documents/GitHub/FrameFlow"
cd "$REPO"

echo "🔧 Removing stale git lock files..."
rm -f .git/index.lock .git/HEAD.lock

echo "📦 Staging changes..."
git add components/creative-platform.jsx

echo "✅ Committing..."
git commit -m "fix: gallery persistence, Media tab, useCallback import, persistGalleryNow prop"

echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "Done! Vercel will now rebuild automatically."

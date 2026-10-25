#!/bin/zsh
# Usage: .manager/make-review.sh <review-id> <sprint-id> <base-sha>
cd /Users/diaw/Downloads/agregat-back
sed -e "s/__ID__/$1/g" -e "s/__SPRINT__/$2/g" -e "s/__BASE__/$3/g" .manager/briefs/review-template.md > .manager/briefs/$1.md
echo ".manager/briefs/$1.md"

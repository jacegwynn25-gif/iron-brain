#!/bin/bash

# Script to remove (supabase as any) type assertions after regenerating types
# Run this AFTER: npx supabase gen types typescript --project-id nwqqasofqwoinzrcjivo > app/lib/supabase/types.ts

echo "🔍 Searching for type assertions in recovery-integration-service.ts..."

FILE="app/lib/intelligence/recovery-integration-service.ts"

if [ ! -f "$FILE" ]; then
    echo "❌ File not found: $FILE"
    exit 1
fi

# Count current assertions
COUNT=$(grep -c "(supabase as any)" "$FILE")
echo "Found $COUNT type assertions to remove"

if [ "$COUNT" -eq 0 ]; then
    echo "✅ No type assertions found. Already clean!"
    exit 0
fi

echo ""
echo "📝 Creating backup..."
cp "$FILE" "$FILE.backup"
echo "✅ Backup created: $FILE.backup"

echo ""
echo "🔧 Removing type assertions..."

# Remove (supabase as any) and replace with supabase
sed -i '' 's/(supabase as any)/supabase/g' "$FILE"

# Also remove the TODO comments
sed -i '' '/TODO: Regenerate database types after running migration 004/d' "$FILE"

# Count remaining assertions (should be 0)
REMAINING=$(grep -c "(supabase as any)" "$FILE")

echo ""
if [ "$REMAINING" -eq 0 ]; then
    echo "✅ Successfully removed all type assertions!"
    echo ""
    echo "Next steps:"
    echo "1. Run: npm run build"
    echo "2. If build fails with type errors, you may need to:"
    echo "   - Check that types were regenerated correctly"
    echo "   - Verify migration 016 was applied to database"
    echo "3. If successful, delete backup: rm $FILE.backup"
else
    echo "⚠️  Warning: $REMAINING assertions still remain"
    echo "Restoring from backup..."
    mv "$FILE.backup" "$FILE"
    echo "❌ Changes reverted. Please check the file manually."
    exit 1
fi

// Moves an unversioned career-ops receipt to the versioned format. Dry run by default.
// Applying needs the receipt hash printed by the dry run: --apply --plan <hash> --reviewer <name>.
// No secrets, no model, no browser; a dry run writes nothing, an applied run writes only in relay/.
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import {
  applyReviewMigration,
  planReviewMigration,
} from '../packages/career-ops/review-migration.js';

const { values } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    plan: { type: 'string' },
    reviewer: { type: 'string' },
    root: { type: 'string' },
  },
});
const root = values.root ? resolve(values.root) : new CareerWorkspace().path();
try {
  const result = values.apply
    ? applyReviewMigration(root, { reviewer: values.reviewer, plan: values.plan })
    : { ...planReviewMigration(root), applied: false };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.applied || result.applicable ? 0 : 2;
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}

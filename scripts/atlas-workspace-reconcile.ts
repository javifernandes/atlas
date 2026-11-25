import { runWorkspaceReconciliation } from './atlas-workspace-reconcile-command';

await runWorkspaceReconciliation(process.argv[2]?.trim());

import { materializeAtlasParsedRecords } from '../markdown/parsed-record-materialization';
import { atlasSourceRef, deriveAtlasSourceChangeSet } from '../sources/source-changeset';

type Input = Pick<Parameters<typeof materializeAtlasParsedRecords>[0], 'records' | 'sourceRevisions'>;
export type LocalWorkspaceMaterialization = {
  input: Input;
  materialization: Awaited<ReturnType<typeof materializeAtlasParsedRecords>>;
};

export const materializeLocalWorkspace = async (
  input: Input,
  previous?: LocalWorkspaceMaterialization,
): Promise<LocalWorkspaceMaterialization> => {
  const source = atlasSourceRef('atlas');
  const base = previous?.input.sourceRevisions.find(revision => revision.sourceId === 'atlas');
  const target = input.sourceRevisions.find(revision => revision.sourceId === 'atlas');
  const atlasRecords = (records: Input['records']) =>
    records.filter(record => (record.sourceId ?? 'atlas') === 'atlas');
  const changeSet = previous && base && target && base.id !== target.id
    ? deriveAtlasSourceChangeSet({
        baseRecords: atlasRecords(previous.input.records),
        baseRevision: { source, revisionKey: base.revision, revisionScheme: base.revisionKind },
        targetRecords: atlasRecords(input.records),
        targetRevision: { source, revisionKey: target.revision, revisionScheme: target.revisionKind },
        observedAt: target.observedAt,
      })
    : null;
  const materialization = await materializeAtlasParsedRecords({
    ...input,
    changeSet,
    initial: previous?.materialization,
  });
  return { input, materialization };
};

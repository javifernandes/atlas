export type AtlasCatchUpArguments = {
  apply: boolean;
  since: string;
};

const usage = 'Usage: atlas-catch-up.ts --since=<ISO-8601> [--dry-run|--apply]';

export const parseAtlasCatchUpArguments = (input: string[]): AtlasCatchUpArguments => {
  const argumentsList = input.filter(argument => argument !== '--');
  const argumentsSet = new Set(argumentsList);
  const sinceArguments = argumentsList.filter(argument => argument.startsWith('--since='));
  const unknownArguments = argumentsList.filter(
    argument =>
      argument !== '--apply' &&
      argument !== '--dry-run' &&
      !argument.startsWith('--since='),
  );

  if (
    unknownArguments.length > 0 ||
    sinceArguments.length !== 1 ||
    (argumentsSet.has('--apply') && argumentsSet.has('--dry-run'))
  ) {
    throw new Error(usage);
  }

  const sinceTimestamp = Date.parse(sinceArguments[0]!.slice('--since='.length));

  if (!Number.isFinite(sinceTimestamp)) {
    throw new Error('Catch-up --since must be a valid ISO-8601 timestamp.');
  }

  return {
    apply: argumentsSet.has('--apply'),
    since: new Date(sinceTimestamp).toISOString(),
  };
};

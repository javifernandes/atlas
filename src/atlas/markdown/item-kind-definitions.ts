import path from 'node:path';

import type { AtlasItemKind, AtlasItemModel } from '../model/item-kind';
import { parseEntityModel } from './entity-model';
import { parseInteractionModel } from './interaction-model';
import { parseOperationModel } from './operation-model';

type ItemModelParserContext = {
  body: string;
  getString: (key: string) => string;
  getValue: (key: string) => unknown;
  sourcePath: string;
};

type ItemKindDefinition = {
  parseModel: (context: ItemModelParserContext) => AtlasItemModel;
};

const parseOperationRealizationRefs = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value.flatMap(reference => {
    if (typeof reference !== 'object' || reference === null) return [];

    const candidate = reference as Record<string, unknown>;
    const namespace = typeof candidate.namespace === 'string' ? candidate.namespace.trim() : '';
    const kind = typeof candidate.kind === 'string' ? candidate.kind.trim() : '';
    const target = typeof candidate.target === 'string' ? candidate.target.trim() : '';
    const status = typeof candidate.status === 'string' ? candidate.status.trim() : undefined;

    if (!namespace || !kind || !target) return [];

    return [{ kind, namespace, status: status || undefined, target }];
  });
};

const specializedItemKindDefinitions: Partial<Record<AtlasItemKind, ItemKindDefinition>> = {
  package: {
    parseModel: context => ({
      kind: 'package',
      name: context.getString('packageName') || undefined,
      packageType: context.getString('packageType') || undefined,
      path: path.posix.dirname(context.sourcePath) || '.',
    }),
  },
  entity: {
    parseModel: context => ({
      kind: 'entity',
      entity: parseEntityModel(context.body),
    }),
  },
  operation: {
    parseModel: context =>
      parseOperationModel(
        context.body,
        parseOperationRealizationRefs(context.getValue('realizationRefs')),
        context.getString('parent') || undefined,
      ),
  },
  interaction: {
    parseModel: context => {
      const scope = context.getValue('scope');
      return parseInteractionModel(
        context.body,
        typeof scope === 'object' && scope !== null ? scope : {},
      );
    },
  },
};

export const parseItemKindModel = (
  kind: AtlasItemKind,
  context: ItemModelParserContext,
): AtlasItemModel | undefined => specializedItemKindDefinitions[kind]?.parseModel(context);

import path from 'node:path';

import type { AtlasItemKind, AtlasItemModel } from '../model/item-kind';
import { parseEntityModel } from './entity-model';
import { parseInteractionModel } from './interaction-model';

type ItemModelParserContext = {
  body: string;
  getString: (key: string) => string;
  getValue: (key: string) => unknown;
  sourcePath: string;
};

type ItemKindDefinition = {
  parseModel: (context: ItemModelParserContext) => AtlasItemModel;
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

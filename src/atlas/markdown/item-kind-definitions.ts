import path from 'node:path';

import type { AtlasItemKind, AtlasItemModel } from '../model/item-kind';
import { parseEntityModel } from './entity-model';

type ItemModelParserContext = {
  body: string;
  getString: (key: string) => string;
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
};

export const parseItemKindModel = (
  kind: AtlasItemKind,
  context: ItemModelParserContext,
): AtlasItemModel | undefined => specializedItemKindDefinitions[kind]?.parseModel(context);

import { field, graphSchema, type GraphSchemaValue } from '@ontahi/core/data-graph';

import { AtlasWorkspaceReferenceSchema } from './workspace-administration';

export const AtlasWorkspaceModelConnectionSchema = graphSchema.object({
  id: field.id(),
  workspaceId: field.id(),
  purpose: field.enum(['plans-assistant']),
  provider: field.enum(['openai', 'anthropic']),
  model: field.nonEmptyString({ trim: true, maxLength: 200 }),
  baseUrl: field.nullable(field.string({ maxLength: 500 })),
  secretRef: field.nonEmptyString({ trim: true }),
  secretSuffix: field.nullable(field.string({ maxLength: 12 })),
  status: field.enum(['active', 'disabled']),
  createdAt: field.nonEmptyString({ trim: true }),
  updatedAt: field.nonEmptyString({ trim: true }),
});

export const AtlasWorkspaceReadModelConnectionInputSchema = graphSchema.object({
  workspace: graphSchema.ref(AtlasWorkspaceReferenceSchema),
});
export const AtlasWorkspaceReadModelConnectionOutputSchema = graphSchema.nullable(
  AtlasWorkspaceModelConnectionSchema,
);

export const AtlasWorkspaceConfigureModelConnectionInputSchema = graphSchema.object({
  workspace: graphSchema.ref(AtlasWorkspaceReferenceSchema),
  provider: field.enum(['openai', 'anthropic']),
  model: field.nonEmptyString({ trim: true, maxLength: 200 }),
  baseUrl: field.nullable(field.string({ maxLength: 500 })),
  secretRef: field.nonEmptyString({ trim: true }),
  secretSuffix: field.nullable(field.string({ maxLength: 12 })),
});
export const AtlasWorkspaceConfigureModelConnectionOutputSchema =
  AtlasWorkspaceModelConnectionSchema;

export const AtlasWorkspaceDisableModelConnectionInputSchema = graphSchema.object({
  workspace: graphSchema.ref(AtlasWorkspaceReferenceSchema),
});
export const AtlasWorkspaceDisableModelConnectionOutputSchema =
  AtlasWorkspaceModelConnectionSchema;

export type AtlasWorkspaceModelConnection = GraphSchemaValue<
  typeof AtlasWorkspaceModelConnectionSchema
>;

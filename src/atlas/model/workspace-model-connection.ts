import { field, graphSchema, type GraphSchemaValue } from '@ontahi/core';

import { AtlasWorkspaceReferenceSchema } from './workspace-administration';

export const AtlasWorkspaceModelConnectionSchema = graphSchema.object({
  id: field.id(),
  workspaceId: field.id(),
  purpose: field.enum(['plans-assistant']),
  provider: field.enum(['openai', 'anthropic', 'deepseek']),
  model: field.nonEmptyString({ trim: true, maxLength: 200 }),
  baseUrl: field.nullable(field.string({ maxLength: 500 })),
  secretRef: field.nonEmptyString({ trim: true }),
  secretSuffix: field.nullable(field.string({ maxLength: 12 })),
  status: field.enum(['active', 'disabled']),
  createdAt: field.nonEmptyString({ trim: true }),
  updatedAt: field.nonEmptyString({ trim: true }),
});

export const AtlasWorkspaceListModelConnectionsInputSchema = graphSchema.object({
  workspace: graphSchema.ref(AtlasWorkspaceReferenceSchema),
});
export const AtlasWorkspaceListModelConnectionsOutputSchema = graphSchema.array(
  AtlasWorkspaceModelConnectionSchema,
);

export const AtlasWorkspaceConfigureModelConnectionInputSchema = graphSchema.object({
  workspace: graphSchema.ref(AtlasWorkspaceReferenceSchema),
  provider: field.enum(['openai', 'anthropic', 'deepseek']),
  model: field.nonEmptyString({ trim: true, maxLength: 200 }),
  baseUrl: field.nullable(field.string({ maxLength: 500 })),
  secretRef: field.nonEmptyString({ trim: true }),
  secretSuffix: field.nullable(field.string({ maxLength: 12 })),
});
export const AtlasWorkspaceConfigureModelConnectionOutputSchema =
  AtlasWorkspaceModelConnectionSchema;

export const AtlasWorkspaceSelectModelConnectionInputSchema = graphSchema.object({
  workspace: graphSchema.ref(AtlasWorkspaceReferenceSchema),
  connectionId: field.id(),
});
export const AtlasWorkspaceSelectModelConnectionOutputSchema =
  AtlasWorkspaceModelConnectionSchema;

export const AtlasWorkspaceDeleteModelConnectionInputSchema =
  AtlasWorkspaceSelectModelConnectionInputSchema;
export const AtlasWorkspaceDeleteModelConnectionOutputSchema =
  AtlasWorkspaceModelConnectionSchema;

export type AtlasWorkspaceModelConnection = GraphSchemaValue<
  typeof AtlasWorkspaceModelConnectionSchema
>;

import { field, graphSchema, type GraphSchemaValue } from '@ontahi/core/data-graph';

export const AtlasWorkspaceUpdateVisibilityInputSchema = graphSchema.object({
  workspace: graphSchema.object({ id: field.id() }),
  visibility: field.enum(['private', 'public']),
});

export const AtlasWorkspaceUpdateVisibilityOutputSchema = graphSchema.object({
  id: field.id(),
  visibility: field.enum(['private', 'public']),
});

export type AtlasWorkspaceUpdateVisibilityInput = GraphSchemaValue<
  typeof AtlasWorkspaceUpdateVisibilityInputSchema
>;

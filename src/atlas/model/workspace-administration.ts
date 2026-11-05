import { field, graphSchema, type GraphSchemaValue } from '@ontahi/core/data-graph';

export const AtlasWorkspaceCreateInputSchema = graphSchema.object({
  name: field.nonEmptyString({ trim: true }),
  slug: field.nonEmptyString({ trim: true }),
});

export const AtlasWorkspaceCreateOutputSchema = graphSchema.object({
  id: field.id(),
  name: field.nonEmptyString({ trim: true }),
  slug: field.nonEmptyString({ trim: true }),
  visibility: field.enum(['private', 'public']),
});

export const AtlasWorkspaceUpdateVisibilityInputSchema = graphSchema.object({
  workspace: graphSchema.object({ id: field.id() }),
  visibility: field.enum(['private', 'public']),
});

export const AtlasWorkspaceUpdateVisibilityOutputSchema = graphSchema.object({
  id: field.id(),
  visibility: field.enum(['private', 'public']),
});

export const AtlasWorkspaceDeleteInputSchema = graphSchema.object({
  workspace: graphSchema.object({ id: field.id() }),
  confirmationSlug: field.nonEmptyString({ trim: true }),
});

export const AtlasWorkspaceDeleteOutputSchema = graphSchema.object({
  id: field.id(),
  slug: field.nonEmptyString({ trim: true }),
});

export const AtlasWorkspaceRegisterSourceInputSchema = graphSchema.object({
  workspace: graphSchema.object({ id: field.id() }),
  repository: field.nonEmptyString({ trim: true }),
});

export const AtlasWorkspaceRegisterSourceOutputSchema = graphSchema.object({
  id: field.id(),
  sourceId: field.nonEmptyString({ trim: true }),
  repository: field.nonEmptyString({ trim: true }),
  ref: field.nonEmptyString({ trim: true }),
});

export const AtlasWorkspaceRepositoryChoiceSchema = graphSchema.object({
  defaultRef: field.nonEmptyString({ trim: true }),
  fullName: field.nonEmptyString({ trim: true }),
  isPrivate: field.boolean(),
});

export const AtlasWorkspaceListRepositoriesInputSchema = graphSchema.object({
  workspace: graphSchema.object({ id: field.id() }),
});

export const AtlasWorkspaceListRepositoriesOutputSchema = graphSchema.object({
  authorizationRequired: field.boolean(),
  repositories: graphSchema.array(AtlasWorkspaceRepositoryChoiceSchema),
});

export type AtlasWorkspaceUpdateVisibilityInput = GraphSchemaValue<
  typeof AtlasWorkspaceUpdateVisibilityInputSchema
>;

export const normalizeWorkspaceSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

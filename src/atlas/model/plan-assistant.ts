import { field, graphSchema, type GraphSchemaValue } from '@ontahi/core/data-graph';

export const AtlasPlanAssistantInputSchema = graphSchema.object({
  workspace: graphSchema.object({ id: field.id() }),
  question: field.nonEmptyString({ trim: true, maxLength: 2000 }),
});

export const AtlasPlanAssistantCitationSchema = graphSchema.object({
  planId: field.id(),
  path: field.nonEmptyString({ trim: true }),
  title: field.nonEmptyString({ trim: true }),
});

export const AtlasPlanAssistantOutputSchema = graphSchema.object({
  answer: field.nonEmptyString({ trim: true }),
  citations: graphSchema.array(AtlasPlanAssistantCitationSchema),
});

export type AtlasPlanAssistantInput = GraphSchemaValue<typeof AtlasPlanAssistantInputSchema>;
export type AtlasPlanAssistantOutput = GraphSchemaValue<typeof AtlasPlanAssistantOutputSchema>;

export type AtlasPlanAssistantDocument = {
  id: string;
  path: string;
  title: string;
  status: string;
  markdown: string;
};

export const boundAssistantDocuments = (
  documents: AtlasPlanAssistantDocument[],
  options: { maxDocuments?: number; maxDocumentCharacters?: number; maxTotalCharacters?: number } = {},
) => {
  const maxDocuments = options.maxDocuments ?? 8;
  const maxDocumentCharacters = options.maxDocumentCharacters ?? 6000;
  const maxTotalCharacters = options.maxTotalCharacters ?? 30_000;
  let remaining = maxTotalCharacters;

  return documents.slice(0, maxDocuments).flatMap(document => {
    if (remaining <= 0) return [];
    const markdown = document.markdown.slice(0, Math.min(maxDocumentCharacters, remaining));
    remaining -= markdown.length;
    return [{ ...document, markdown }];
  });
};

const searchTerms = (question: string) =>
  [...new Set(question.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) ?? [])].filter(
    term => !['about', 'como', 'con', 'del', 'los', 'para', 'que', 'the', 'una', 'what'].includes(term),
  );

export const retrieveRelevantPlanDocuments = (
  question: string,
  documents: AtlasPlanAssistantDocument[],
) => {
  const terms = searchTerms(question);
  return documents
    .map(document => {
      const title = `${document.title} ${document.path}`.toLowerCase();
      const markdown = document.markdown.toLowerCase();
      const score = terms.reduce(
        (total, term) =>
          total + (title.includes(term) ? 8 : 0) + (markdown.includes(term) ? 1 : 0),
        0,
      );
      return { document, score };
    })
    .filter(candidate => candidate.score > 0 || terms.length === 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.document.path.localeCompare(right.document.path),
    )
    .map(candidate => candidate.document);
};

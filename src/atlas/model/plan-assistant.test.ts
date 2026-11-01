import { describe, expect, it } from 'vitest';

import { boundAssistantDocuments, retrieveRelevantPlanDocuments } from './plan-assistant';

const document = (id: string, title: string, markdown: string) => ({
  id,
  path: `plans/current/${id}.md`,
  title,
  status: 'current',
  markdown,
});

describe('Atlas Plan assistant context', () => {
  it('retrieves lexical matches and bounds documents and total characters', () => {
    const retrieved = retrieveRelevantPlanDocuments('workspace security', [
      document('unrelated', 'Viewer polish', 'Colors and layout'),
      document('workspace', 'Workspace ownership', 'Membership security boundary'),
      document('security', 'Security follow-up', 'Workspace authorization'),
    ]);

    expect(retrieved.map(candidate => candidate.id)).toEqual(['security', 'workspace']);
    const bounded = boundAssistantDocuments(retrieved, {
      maxDocuments: 2,
      maxDocumentCharacters: 12,
      maxTotalCharacters: 18,
    });
    expect(bounded.map(candidate => candidate.markdown.length)).toEqual([12, 6]);
  });
});

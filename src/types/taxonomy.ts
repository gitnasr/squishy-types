/**
 * Categorisation.
 *
 * The preset taxonomy is a seed, not a cage — the LLM may propose a new
 * category, but only when it can justify one (spec §6.2). Keeping the seed
 * here means the rule pass, the prompt and the review queue all name categories
 * identically; three copies of this list would produce three folder trees.
 */
export type Category =
  | 'Development'
  | 'DevOps & Infra'
  | 'AI & ML'
  | 'Design & UI'
  | 'Product & Business'
  | 'Career & Jobs'
  | 'Learning & Courses'
  | 'Documentation & Reference'
  | 'Tools & Utilities'
  | 'News & Articles'
  | 'Research & Papers'
  | 'Finance'
  | 'Health'
  | 'Travel'
  | 'Shopping'
  | 'Entertainment'
  | 'Social & Community'
  | 'Personal'
  | 'Unsorted';

/** Where a classification came from. Drives whether it draws quota. */
export type ClassificationSource = 'rule' | 'llm';

export interface Classification {
  category: Category;
  /** 0–1. The rule pass never returns below `RULE_CONFIDENCE_FLOOR`. */
  confidence: number;
  source: ClassificationSource;
  /** Short human-readable "why", shown verbatim in the review queue. */
  rationale: string;
}

/** What the rule pass needs to decide. Deliberately not a full `FlatNode`. */
export interface ClassifiableBookmark {
  id: string;
  url: string;
  title: string;
}

export interface RulePassResult {
  /** Confidently classified at zero cost. These never reach an LLM. */
  classified: { id: string; classification: Classification }[];
  /** Everything the rules would only be guessing at. */
  unresolved: ClassifiableBookmark[];
}

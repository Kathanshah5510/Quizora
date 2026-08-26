/**
 * Pure Fisher-Yates shuffle for question and option order randomization.
 * Deterministic relative to the input array — caller must decide whether to shuffle.
 */
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    // crypto.getRandomValues is available in Node 18+ / browser
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface QuestionOrderInput {
  id: string;
  displayOrder: number;
  optionIds: string[];
}

export interface RandomizedOrders {
  /** Ordered list of question IDs for this attempt */
  questionOrder: string[];
  /** Map of questionId → ordered option IDs */
  optionOrders: Record<string, string[]>;
}

export function buildRandomizedOrders(
  questions: QuestionOrderInput[],
  randomizeQuestions: boolean,
  randomizeOptions: boolean
): RandomizedOrders {
  const sorted = [...questions].sort((a, b) => a.displayOrder - b.displayOrder);
  const questionOrder = randomizeQuestions
    ? shuffle(sorted.map((q) => q.id))
    : sorted.map((q) => q.id);

  const optionOrders: Record<string, string[]> = {};
  for (const q of sorted) {
    optionOrders[q.id] = randomizeOptions ? shuffle(q.optionIds) : q.optionIds;
  }

  return { questionOrder, optionOrders };
}

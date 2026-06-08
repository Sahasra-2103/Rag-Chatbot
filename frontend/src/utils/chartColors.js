export const CHART_COLORS = {
  context_precision: '#38bdf8',
  context_recall: '#22c55e',
  retrieval_relevance: '#f59e0b',
  faithfulness: '#8b5cf6',
  answer_relevance: '#ec4899',
  answer_correctness: '#14b8a6',
  conciseness: '#f97316',
  answer_relevancy: '#ec4899',
  accuracy: '#14b8a6',
  hallucination_score: '#ef4444',
  retrieval_quality: '#84cc16',
  response_completeness: '#22c55e',
  overall_score: '#06b6d4'
};

export const COLOR_PALETTE = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e'  // Green
];

export const METRIC_ORDER = [
  'context_precision',
  'context_recall',
  'retrieval_relevance',
  'faithfulness',
  'answer_relevance',
  'answer_correctness',
  'conciseness'
];

export const getMetricColor = (metricKey) => {
  return CHART_COLORS[metricKey] || '#6b7280';
};

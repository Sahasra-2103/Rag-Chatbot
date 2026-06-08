export const formatPercentage = (value, decimals = 1) => {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  return `${(value * 100).toFixed(decimals)}%`;
};

export const formatNumber = (value, decimals = 2) => {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  return value.toFixed(decimals);
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

export const formatTime = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export const formatMetricName = (key) => {
  const names = {
    faithfulness: 'Faithfulness',
    answer_relevancy: 'Answer Relevancy',
    answer_relevance: 'Answer Relevance',
    context_precision: 'Context Precision',
    context_recall: 'Context Recall',
    retrieval_relevance: 'Retrieval Relevance',
    accuracy: 'Accuracy',
    answer_correctness: 'Answer Correctness',
    conciseness: 'Conciseness',
    hallucination_score: 'Hallucination Score',
    retrieval_quality: 'Retrieval Quality',
    response_completeness: 'Response Completeness',
    overall_score: 'Overall Score'
  };
  return names[key] || key;
};

export const getScoreColor = (score) => {
  if (score >= 0.8) return '#10b981'; // Green
  if (score >= 0.6) return '#f59e0b'; // Yellow/Amber
  return '#ef4444'; // Red
};

export const getRatingColor = (rating) => {
  const colors = {
    'Excellent': '#10b981',
    'Good Performance': '#3b82f6',
    'Good': '#3b82f6',
    'Acceptable': '#f59e0b',
    'Average': '#f59e0b',
    'Needs Improvement': '#ef4444'
  };
  return colors[rating] || '#6b7280';
};

export const truncateText = (text, length = 50) => {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
};

export const getMetricShortName = (key) => {
  const names = {
    faithfulness: 'Faith',
    answer_relevancy: 'Relevancy',
    answer_relevance: 'Relevance',
    context_precision: 'Precision',
    context_recall: 'Recall',
    retrieval_relevance: 'Retrieval',
    accuracy: 'Accuracy',
    answer_correctness: 'Correctness',
    conciseness: 'Concise',
    hallucination_score: 'Hallucination',
    retrieval_quality: 'Retrieval',
    response_completeness: 'Completeness',
    overall_score: 'Overall'
  };
  return names[key] || key;
};

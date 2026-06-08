import fs from 'fs/promises';
import path from 'path';
import { runRagasEvaluation } from './ragasRunner.js';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from',
  'has', 'have', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
  'the', 'their', 'this', 'to', 'was', 'were', 'with', 'you', 'your'
]);

export const CORE_METRIC_KEYS = [
  'context_precision',
  'context_recall',
  'retrieval_relevance',
  'faithfulness',
  'answer_relevance',
  'answer_correctness',
  'conciseness'
];

const STORED_METRIC_KEYS = [
  ...CORE_METRIC_KEYS,
  'overall_score',
  'answer_relevancy',
  'accuracy',
  'hallucination_score',
  'retrieval_quality',
  'response_completeness'
];

const METRIC_LABELS = {
  context_precision: 'Context Precision',
  context_recall: 'Context Recall',
  retrieval_relevance: 'Retrieval Relevance',
  faithfulness: 'Faithfulness',
  answer_relevance: 'Answer Relevance',
  answer_correctness: 'Answer Correctness',
  conciseness: 'Conciseness',
  overall_score: 'Overall RAG Score'
};

function clamp(value) {
  if (Number.isNaN(value) || value == null) return 0;
  return Math.max(0, Math.min(1, value));
}

function tokenize(text = '') {
  return [...new Set(
    String(text)
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9-]{2,}/g)
      ?.filter((word) => !STOP_WORDS.has(word)) || []
  )];
}

function coverage(sourceTerms, targetTerms) {
  if (!sourceTerms.length) return 0;
  const target = new Set(targetTerms);
  return sourceTerms.filter((term) => target.has(term)).length / sourceTerms.length;
}

function splitSentences(text = '') {
  return String(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function scoreColor(score) {
  if (score >= 0.8) return 'green';
  if (score >= 0.6) return 'yellow';
  return 'red';
}

function metricLabel(key) {
  return METRIC_LABELS[key] || key;
}

function metricInterpretation(key, score) {
  if (key === 'faithfulness' || key === 'answer_relevance') {
    if (score >= 0.8) return 'Strong';
    if (score >= 0.6) return 'Acceptable';
    return 'Weak';
  }
  if (score >= 0.9) return 'Excellent';
  if (score >= 0.75) return 'Good';
  if (score >= 0.6) return 'Acceptable';
  return 'Poor';
}

function rating(score) {
  if (score >= 0.9) return 'Excellent';
  if (score >= 0.8) return 'Good Performance';
  if (score >= 0.7) return 'Acceptable';
  return 'Needs Improvement';
}

function grade(score) {
  if (score >= 0.93) return 'A';
  if (score >= 0.9) return 'A-';
  if (score >= 0.87) return 'B+';
  if (score >= 0.8) return 'B';
  if (score >= 0.75) return 'C+';
  if (score >= 0.7) return 'C';
  return 'D';
}

function estimateConciseness(query = '', answer = '') {
  const answerWords = answer.trim().split(/\s+/).filter(Boolean).length;
  const queryWords = query.trim().split(/\s+/).filter(Boolean).length;
  if (!answerWords) return 0;
  const repeatedPhrases = (answer.toLowerCase().match(/\b(in conclusion|to summarize|as mentioned|it is important to note)\b/g) || []).length;
  const target = Math.max(35, queryWords * 4);
  const lengthPenalty = answerWords <= target ? 0 : Math.min(0.45, (answerWords - target) / Math.max(target * 3, 1));
  const repetitionPenalty = Math.min(0.2, repeatedPhrases * 0.05);
  return clamp(1 - lengthPenalty - repetitionPenalty);
}

function getRangeCutoff(range) {
  const now = Date.now();
  if (range === '24h') return now - 24 * 60 * 60 * 1000;
  if (range === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  if (range === '30d') return now - 30 * 24 * 60 * 60 * 1000;
  return 0;
}

export class EvaluationStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async ensureStore() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, '[]');
    }
  }

  async readAll() {
    await this.ensureStore();
    const raw = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(raw || '[]');
  }

  async writeAll(records) {
    await this.ensureStore();
    await fs.writeFile(this.filePath, JSON.stringify(records, null, 2));
  }

  async save(record) {
    const records = await this.readAll();
    const normalized = { ...record, question_id: `Q${records.length + 1}` };
    records.push(normalized);
    await this.writeAll(records);
    return normalized;
  }
}

export class EvaluationService {
  constructor({ store }) {
    this.store = store;
  }

  evaluate({ query, answer, retrievedContexts = [], responseTime = 0, retrievedChunkIds = [], groundTruth = '' }) {
    const contextText = retrievedContexts.map((ctx) => ctx.text || '').join('\n\n');
    const contextTerms = tokenize(contextText);
    const answerTerms = tokenize(answer);
    const queryTerms = tokenize(query);
    const groundTruthTerms = tokenize(groundTruth);
    const answerSentences = splitSentences(answer);

    const supportedSentences = answerSentences.filter((sentence) => {
      const terms = tokenize(sentence);
      return terms.length === 0 || coverage(terms, contextTerms) >= 0.45;
    }).length;
    const unsupportedClaims = answerSentences.filter((sentence) => {
      const terms = tokenize(sentence);
      return terms.length > 0 && coverage(terms, contextTerms) < 0.45;
    });

    const retrievalScores = retrievedContexts.map((ctx) => Number(ctx.score || ctx.hybridScore || 0));
    const avgRetrievalScore = retrievalScores.length
      ? retrievalScores.reduce((sum, score) => sum + clamp(score), 0) / retrievalScores.length
      : 0;

    const queryInContext = coverage(queryTerms, contextTerms);
    const queryInAnswer = coverage(queryTerms, answerTerms);
    const answerInContext = coverage(answerTerms, contextTerms);
    const contextInAnswer = coverage(contextTerms.slice(0, 80), answerTerms);
    const truthCoverage = groundTruthTerms.length ? coverage(groundTruthTerms, answerTerms) : answerInContext;

    const faithfulness = clamp(answerSentences.length ? supportedSentences / answerSentences.length : 0);
    const answerRelevance = clamp((queryInAnswer * 0.65) + (queryInContext * 0.35));
    const contextPrecision = clamp((avgRetrievalScore * 0.45) + (answerInContext * 0.35) + (queryInContext * 0.2));
    const contextRecall = clamp((queryInContext * 0.65) + (contextInAnswer * 0.35));
    const retrievalRelevance = clamp((avgRetrievalScore * 0.6) + (queryInContext * 0.4));
    const answerCorrectness = clamp((truthCoverage * 0.4) + (faithfulness * 0.35) + (answerRelevance * 0.25));
    const conciseness = estimateConciseness(query, answer);
    const hallucinationScore = clamp(1 - (unsupportedClaims.length / Math.max(answerSentences.length, 1)));
    const retrievalQuality = clamp((contextPrecision * 0.6) + (contextRecall * 0.4));
    const responseCompleteness = clamp((contextInAnswer * 0.55) + (answerRelevance * 0.45));
    const overallScore = clamp(
      (contextPrecision + contextRecall + retrievalRelevance + faithfulness + answerRelevance + answerCorrectness + conciseness) / 7
    );

    const metrics = {
      context_precision: contextPrecision,
      context_recall: contextRecall,
      retrieval_relevance: retrievalRelevance,
      faithfulness,
      answer_relevance: answerRelevance,
      answer_correctness: answerCorrectness,
      conciseness,
      overall_score: overallScore,
      answer_relevancy: answerRelevance,
      accuracy: answerCorrectness,
      hallucination_score: hallucinationScore,
      retrieval_quality: retrievalQuality,
      response_completeness: responseCompleteness
    };

    const errorAnalysis = this.detectErrors(metrics, unsupportedClaims);
    const recommendations = this.recommendationsFor(metrics);
    const metricBreakdown = CORE_METRIC_KEYS.map((key) => ({
      metric: metricLabel(key),
      key,
      score: metrics[key],
      interpretation: metricInterpretation(key, metrics[key]),
      reason: this.metricReason(key, metrics[key])
    }));

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      question_id: null,
      query,
      question: query,
      answer,
      generated_answer: answer,
      retrieved_contexts: retrievedContexts,
      ground_truth: groundTruth,
      expected_answer: groundTruth,
      response_time: responseTime,
      retrieved_chunk_ids: retrievedChunkIds,
      retrieved_chunk_count: retrievedContexts.length,
      timestamp: new Date().toISOString(),
      ...metrics,
      rating: rating(overallScore),
      grade: grade(overallScore),
      final_remark: this.finalRemark(overallScore, metrics),
      metric_breakdown: metricBreakdown,
      error_analysis: errorAnalysis,
      hallucinations: unsupportedClaims,
      strengths: this.buildStrengths(metrics),
      weaknesses: this.buildWeaknesses(metrics),
      recommendations,
      colors: Object.fromEntries(STORED_METRIC_KEYS.map((key) => [key, scoreColor(metrics[key])])),
      details: {
        retrieved_chunks_used: retrievedContexts.map((ctx) => ({
          id: ctx.id,
          source: ctx.source,
          score: ctx.score,
          tags: ctx.tags,
          text: ctx.text
        })),
        missing_information: contextRecall < 0.7
          ? 'The retrieved context does not cover enough query terms to fully support the answer.'
          : 'No major missing information detected from the retrieved context.',
        hallucination_warnings: unsupportedClaims,
        evaluation_reasoning: [
          'Faithfulness is based on sentence-level support from retrieved chunks.',
          'Answer relevance compares query terms against the generated answer and retrieved evidence.',
          'Retrieval metrics combine search score, query coverage, and answer coverage.',
          'Overall RAG score averages the seven requested retrieval and generation metrics.'
        ],
        sources_referenced: [...new Set(retrievedContexts.map((ctx) => ctx.source).filter(Boolean))]
      }
    };
  }

  detectErrors(metrics, unsupportedClaims = []) {
    const issues = [];
    if (metrics.context_precision < 0.7) {
      issues.push({
        category: 'Irrelevant Retrieval',
        explanation: 'Retrieved documents did not directly answer the question.',
        severity: metrics.context_precision < 0.5 ? 'High' : 'Medium'
      });
    }
    if (metrics.context_recall < 0.7) {
      issues.push({
        category: 'Missing Context',
        explanation: 'Important supporting information was not retrieved.',
        severity: metrics.context_recall < 0.5 ? 'High' : 'Medium'
      });
    }
    if (metrics.faithfulness < 0.75) {
      issues.push({
        category: 'Hallucinated Information',
        explanation: 'Answer contains statements not present in retrieved context.',
        severity: metrics.faithfulness < 0.5 ? 'High' : 'Medium',
        unsupported_claims: unsupportedClaims
      });
    }
    if (metrics.conciseness < 0.7) {
      issues.push({
        category: 'Overly Long Answers',
        explanation: 'The generated answer is longer or more repetitive than needed.',
        severity: metrics.conciseness < 0.5 ? 'High' : 'Medium'
      });
    }
    return issues;
  }

  recommendationsFor(metrics) {
    const recommendations = [];
    if (metrics.context_precision < 0.75) recommendations.push('Better chunking, metadata filtering, and reranking.');
    if (metrics.context_recall < 0.75) recommendations.push('Increase top-k retrieval, parent-child retrieval, and semantic chunking.');
    if (metrics.faithfulness < 0.8) recommendations.push('Stronger grounding prompts, citation enforcement, and hallucination filtering.');
    if (metrics.retrieval_relevance < 0.75) recommendations.push('Better embeddings and hybrid search.');
    if (metrics.answer_correctness < 0.75) recommendations.push('Improved prompt engineering and better context selection.');
    if (metrics.conciseness < 0.75) recommendations.push('Set direct-answer length limits in the response prompt.');
    if (!recommendations.length) recommendations.push('Maintain current settings and monitor trend changes.');
    return recommendations;
  }

  metricReason(key, score) {
    const quality = metricInterpretation(key, score).toLowerCase();
    const reasons = {
      context_precision: `Retrieved chunks had ${quality} usefulness for answering the question.`,
      context_recall: `Retrieved evidence showed ${quality} coverage of required information.`,
      retrieval_relevance: `Question-to-context semantic overlap was ${quality}.`,
      faithfulness: `Generated answer grounding in retrieved context was ${quality}.`,
      answer_relevance: `The answer addressed the question with ${quality} directness.`,
      answer_correctness: `The answer matched available evidence or reference answer with ${quality} accuracy.`,
      conciseness: `The response was ${quality} in clarity and length.`
    };
    return reasons[key] || `Metric quality is ${quality}.`;
  }

  finalRemark(score, metrics) {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.8) return 'Good';
    if (score >= 0.7) return 'Acceptable';
    const weakest = CORE_METRIC_KEYS
      .map((key) => ({ key, score: metrics[key] }))
      .sort((a, b) => a.score - b.score)[0];
    return `Needs improvement in ${metricLabel(weakest.key).toLowerCase()}`;
  }

  buildStrengths(metricsOrAverages) {
    const strongest = CORE_METRIC_KEYS
      .map((key) => ({ key, score: metricsOrAverages[key] || 0 }))
      .sort((a, b) => b.score - a.score)[0];
    const strengths = [];
    if (strongest) {
      strengths.push(`The highest performing metric is ${metricLabel(strongest.key)} (${strongest.score.toFixed(2)}), indicating this is the strongest area.`);
    }
    if ((metricsOrAverages.faithfulness || 0) >= 0.8) strengths.push('Responses are generally grounded in retrieved documents.');
    if ((metricsOrAverages.answer_relevance || metricsOrAverages.answer_relevancy || 0) >= 0.8) strengths.push('Answers usually address the user question directly.');
    if ((metricsOrAverages.context_precision || 0) >= 0.8) strengths.push('Retrieved chunks are usually relevant to the question.');
    return strengths.length ? strengths : ['No dominant strength has emerged yet; more evaluations are needed.'];
  }

  buildWeaknesses(metricsOrAverages) {
    const weakest = CORE_METRIC_KEYS
      .map((key) => ({ key, score: metricsOrAverages[key] || 0 }))
      .sort((a, b) => a.score - b.score)[0];
    const weaknesses = [];
    if (weakest) {
      weaknesses.push(`The lowest performing metric is ${metricLabel(weakest.key)} (${weakest.score.toFixed(2)}), indicating the main improvement area.`);
    }
    if ((metricsOrAverages.context_recall || 0) < 0.75) weaknesses.push('Retrieval coverage may miss important supporting information.');
    if ((metricsOrAverages.context_precision || 0) < 0.75) weaknesses.push('Some retrieved chunks may be weakly related to the user question.');
    if ((metricsOrAverages.faithfulness || 0) < 0.8) weaknesses.push('Some generated claims may need stronger grounding in retrieved context.');
    return weaknesses.length ? weaknesses : ['No major weakness detected in the selected evaluation range.'];
  }

  async runAndSave(payload) {
    const result = this.evaluate(payload);

    try {
      const ragasResult = await runRagasEvaluation({
        query: payload.query,
        answer: payload.answer,
        retrievedContexts: payload.retrievedContexts || payload.retrieved_contexts || [],
        groundTruth: payload.groundTruth || payload.ground_truth || payload.expected_answer || ''
      });

      if (ragasResult) {
        return await this.store.save({ ...result, ...ragasResult, ragas_enabled: true });
      }
    } catch {
      // Heuristic results remain the source of truth when optional RAGAS deps are unavailable.
    }

    return this.store.save({
      ...result,
      ragas_enabled: false,
      ragas_disabled_reason: 'RAGAS dependencies not available or evaluation runner returned no result.'
    });
  }

  async latest() {
    const records = await this.store.readAll();
    return records.at(-1) || null;
  }

  async history({ range = 'all', search = '', sort = 'timestamp', order = 'desc', page = 1, limit = 10 } = {}) {
    const cutoff = getRangeCutoff(range);
    const searchText = search.toLowerCase();
    const records = (await this.store.readAll())
      .filter((record) => new Date(record.timestamp).getTime() >= cutoff)
      .filter((record) => !searchText || record.query.toLowerCase().includes(searchText));

    records.sort((a, b) => {
      const av = sort === 'timestamp' ? new Date(a.timestamp).getTime() : Number(a[sort] || 0);
      const bv = sort === 'timestamp' ? new Date(b.timestamp).getTime() : Number(b[sort] || 0);
      return order === 'asc' ? av - bv : bv - av;
    });

    const start = (Number(page) - 1) * Number(limit);
    return {
      total: records.length,
      page: Number(page),
      limit: Number(limit),
      items: records.slice(start, start + Number(limit))
    };
  }

  async analytics({ range = 'all' } = {}) {
    const cutoff = getRangeCutoff(range);
    const records = (await this.store.readAll())
      .filter((record) => new Date(record.timestamp).getTime() >= cutoff);

    const averages = Object.fromEntries(STORED_METRIC_KEYS.map((key) => {
      const avg = records.length
        ? records.reduce((sum, record) => sum + Number(record[key] || 0), 0) / records.length
        : 0;
      return [key, avg];
    }));

    const sortedByOverall = [...records].sort((a, b) => b.overall_score - a.overall_score);
    const sortedByHallucination = [...records].sort((a, b) => a.hallucination_score - b.hallucination_score);
    const sortedByCorrectness = [...records].sort((a, b) => b.answer_correctness - a.answer_correctness);
    const latest = records.at(-1) || null;

    return {
      count: records.length,
      averages,
      overall_score: averages.overall_score || 0,
      rating: rating(averages.overall_score || 0),
      grade: grade(averages.overall_score || 0),
      latest,
      best_query: sortedByOverall[0] || null,
      worst_query: sortedByOverall.at(-1) || null,
      highest_score: sortedByOverall[0]?.overall_score || 0,
      lowest_score: sortedByOverall.at(-1)?.overall_score || 0,
      most_hallucinated_query: sortedByHallucination[0] || null,
      most_accurate_query: sortedByCorrectness[0] || null,
      trends: records.slice(-30).map((record) => ({
        timestamp: record.timestamp,
        label: new Date(record.timestamp).toLocaleString(),
        overall_score: record.overall_score,
        faithfulness: record.faithfulness,
        context_recall: record.context_recall,
        context_precision: record.context_precision
      })),
      latest_metrics: latest ? CORE_METRIC_KEYS.map((key) => ({
        name: metricLabel(key),
        key,
        value: latest[key]
      })) : [],
      question_wise_table: records.map((record, index) => this.questionWiseRow(record, index)),
      detailed_examples: records.slice(-2).reverse().map((record, index) => this.detailedExample(record, records.length - index)),
      error_analysis: this.aggregateErrors(records),
      strengths: this.buildStrengths(averages),
      weaknesses: this.buildWeaknesses(averages),
      recommendations: this.recommendationsFor(averages),
      insights: this.buildInsights(averages)
    };
  }

  questionWiseRow(record, index) {
    return {
      question_id: record.question_id || `Q${index + 1}`,
      question: record.query,
      context_precision: record.context_precision,
      context_recall: record.context_recall,
      faithfulness: record.faithfulness,
      answer_relevance: record.answer_relevance ?? record.answer_relevancy,
      answer_correctness: record.answer_correctness ?? record.accuracy,
      conciseness: record.conciseness,
      final_remark: record.final_remark || record.rating
    };
  }

  detailedExample(record, questionNumber) {
    return {
      question_id: record.question_id || `Q${questionNumber}`,
      question: record.query,
      retrieved_context: record.retrieved_contexts || [],
      generated_answer: record.answer,
      expected_answer: record.expected_answer || record.ground_truth || '',
      metrics: record.metric_breakdown || CORE_METRIC_KEYS.map((key) => ({
        metric: metricLabel(key),
        key,
        score: record[key],
        reason: this.metricReason(key, record[key] || 0)
      })),
      final_remark: record.final_remark || record.rating
    };
  }

  aggregateErrors(records) {
    const counts = new Map();
    for (const record of records) {
      for (const issue of record.error_analysis || []) {
        counts.set(issue.category, {
          category: issue.category,
          count: (counts.get(issue.category)?.count || 0) + 1,
          explanation: issue.explanation
        });
      }
    }
    return [...counts.values()];
  }

  buildInsights(averages) {
    const insights = [];
    if (averages.context_recall < 0.7) insights.push('Retriever is missing relevant information. Increase retrieval depth or improve embeddings.');
    if (averages.context_precision < 0.7) insights.push('Retriever is returning irrelevant chunks. Improve chunking strategy or ranking.');
    if (averages.faithfulness < 0.8) insights.push('Some answers contain unsupported information not found in retrieved context.');
    if (averages.answer_correctness < 0.75) insights.push('Generated answers differ from reference answers or source evidence.');
    if (!insights.length) insights.push('RAG quality is healthy across the selected time range.');
    return insights;
  }

  async csv() {
    const records = await this.store.readAll();
    const headers = [
      'question_id', 'timestamp', 'question', 'generated_answer', 'expected_answer',
      'context_precision', 'context_recall', 'retrieval_relevance', 'faithfulness',
      'answer_relevance', 'answer_correctness', 'conciseness', 'overall_score',
      'rating', 'grade', 'final_remark', 'response_time', 'retrieved_chunk_count'
    ];

    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [
      headers.join(','),
      ...records.map((record, index) => {
        const row = {
          ...record,
          question_id: record.question_id || `Q${index + 1}`,
          question: record.query,
          generated_answer: record.answer
        };
        return headers.map((header) => escapeCsv(row[header])).join(',');
      })
    ].join('\n');
  }

  async pdfBuffer() {
    const analytics = await this.analytics();
    const lines = [
      'RAG Evaluation Report',
      `Generated: ${new Date().toLocaleString()}`,
      `Total Evaluations: ${analytics.count}`,
      `Overall Score: ${(analytics.overall_score || 0).toFixed(2)} / 1.00`,
      `Grade: ${analytics.grade}`,
      `Performance: ${analytics.rating}`,
      '',
      'Metric Breakdown',
      ...CORE_METRIC_KEYS.map((key) => `${metricLabel(key)}: ${(analytics.averages[key] || 0).toFixed(2)}`),
      '',
      'Question-wise Evaluation',
      ...analytics.question_wise_table.slice(-20).map((row) => `${row.question_id}: ${row.question} | Final Remark: ${row.final_remark}`),
      '',
      'Detailed Evaluation Examples',
      ...analytics.detailed_examples.flatMap((example) => [
        `${example.question_id}: ${example.question}`,
        `Generated Answer: ${example.generated_answer}`,
        `Expected Answer: ${example.expected_answer || 'Not provided'}`,
        `Final Remark: ${example.final_remark}`
      ]),
      '',
      'Error Analysis',
      ...(analytics.error_analysis.length ? analytics.error_analysis.map((issue) => `${issue.category}: ${issue.count} occurrence(s). ${issue.explanation}`) : ['No recurring errors detected.']),
      '',
      'Strengths',
      ...analytics.strengths.map((item) => `- ${item}`),
      '',
      'Weaknesses',
      ...analytics.weaknesses.map((item) => `- ${item}`),
      '',
      'Recommendations',
      ...analytics.recommendations.map((item) => `- ${item}`),
      '',
      'Final Conclusion',
      `Overall Score: ${(analytics.overall_score || 0).toFixed(2)} / 1.00`,
      `Grade: ${analytics.grade}`,
      `Performance: ${analytics.rating}`
    ];

    const pageText = lines.join('\n').slice(0, 7000).replace(/[()\\]/g, '\\$&');
    const stream = `BT /F1 10 Tf 40 760 Td 12 TL (${pageText.replace(/\n/g, ') Tj T* (')}) Tj ET`;
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const object of objects) {
      offsets.push(pdf.length);
      pdf += `${object}\n`;
    }
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf);
  }
}

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import { ChatXAI } from '@langchain/xai';
import { ChatGroq } from '@langchain/groq';
// Removed PineconeEmbeddings due to v7 SDK signature changes
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const csv = require('csv-parser');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Initialize Pinecone
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || 'fake-key'
});
const indexName = process.env.PINECONE_INDEX || 'quickstart';
const localKnowledgePath = path.join(process.cwd(), 'data', 'knowledge_base.json');
let localKnowledgeBase = [];

try {
  if (fs.existsSync(localKnowledgePath)) {
    localKnowledgeBase = JSON.parse(fs.readFileSync(localKnowledgePath, 'utf-8'));
    console.log(`Loaded ${localKnowledgeBase.length} backend knowledge documents`);
  }
} catch (error) {
  console.warn('Local knowledge base could not be loaded:', error.message);
}

// Initialize LLM (Handle both Grok and Groq based on key prefix to be safe)
let llm;
const apiKey = process.env.XAI_API_KEY || process.env.GROQ_API_KEY || '';
if (apiKey.startsWith('gsk_')) {
  llm = new ChatGroq({
    apiKey: apiKey,
    model: 'llama-3.3-70b-versatile',
    modelName: 'llama-3.3-70b-versatile',
    temperature: 0
  });
} else {
  llm = new ChatXAI({
    apiKey: apiKey,
    model: 'grok-2-latest',
    temperature: 0
  });
}

// Embeddings via Pinecone Inference (Serverless) using v7 signature
const embeddings = {
  embedQuery: async (text) => {
    const res = await pc.inference.embed({
      model: 'multilingual-e5-large',
      inputs: [text],
      parameters: { inputType: 'query', truncate: 'END' }
    });
    return res.data[0].values;
  },
  embedDocuments: async (texts) => {
    const res = await pc.inference.embed({
      model: 'multilingual-e5-large',
      inputs: texts,
      parameters: { inputType: 'passage', truncate: 'END' }
    });
    return res.data.map(d => d.values);
  }
};

// Utility to parse different file types from buffer
import { Readable } from 'stream';

async function parseFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;
  const buffer = file.buffer;
  
  if (ext === '.json' || mimeType === 'application/json') {
    const raw = buffer.toString('utf-8');
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
         return data.map(d => JSON.stringify(d)).join('\n\n');
      }
      return JSON.stringify(data);
    } catch (e) {
      throw new Error("Invalid JSON format");
    }
  } 
  
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }
  
  if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer: buffer });
    return result.value;
  }
  
  if (ext === '.csv' || mimeType === 'text/csv') {
    return new Promise((resolve, reject) => {
      const results = [];
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (data) => results.push(JSON.stringify(data)))
        .on('end', () => resolve(results.join('\n\n')))
        .on('error', reject);
    });
  }
  
  if (ext === '.txt' || mimeType === 'text/plain') {
    return buffer.toString('utf-8');
  }
  
  throw new Error("Unsupported file type");
}

function generateTags(text, maxTags = 8) {
  const stopWords = new Set([
    'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'but',
    'can', 'could', 'did', 'does', 'for', 'from', 'had', 'has', 'have', 'how',
    'into', 'its', 'more', 'not', 'our', 'out', 'over', 'should', 'that',
    'the', 'their', 'there', 'these', 'this', 'those', 'through', 'to', 'was',
    'were', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'you',
    'your'
  ]);

  const counts = new Map();
  const words = text
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{2,}/g) || [];

  for (const word of words) {
    if (stopWords.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags)
    .map(([word]) => word);

  return tags.length ? tags : ['document'];
}

function buildContextAwareFallback(query, matches) {
  const bestMatch = matches[0];
  const bestText = bestMatch?.metadata?.text || '';
  const source = bestMatch?.metadata?.source || 'the retrieved document';
  const asksForDate = /\b(when|implemented|implementation|enacted|effective|came into force|year)\b/i.test(query);
  const yearMatch = bestText.match(/\b(18|19|20)\d{2}\b/);

  if (asksForDate && yearMatch) {
    return `The knowledge base identifies this as ${bestText.split('\n')[0].trim()}, which refers to ${yearMatch[0]}. It does not state a separate exact implementation date in the retrieved text.`;
  }

  return `The knowledge base has a relevant entry in ${source}, but it does not contain the exact detail needed to answer this question.`;
}

function getQueryTerms(query) {
  const stopWords = new Set([
    'about', 'after', 'also', 'and', 'are', 'code', 'criminal', 'did', 'does',
    'for', 'from', 'how', 'implemented', 'in', 'into', 'is', 'of', 'procedure',
    'section', 'the', 'this', 'to', 'was', 'what', 'when', 'where', 'which'
  ]);

  return query
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{1,}/g)
    ?.filter((term) => !stopWords.has(term)) || [];
}

function searchLocalKnowledge(query, topK = 10) {
  const terms = getQueryTerms(query);
  const sectionMatch = query.match(/\bsection\s+(\d+[a-z]?)\b/i);
  const section = sectionMatch?.[1]?.toLowerCase();

  return localKnowledgeBase
    .map((doc) => {
      const haystack = `${doc.source || ''}\n${doc.text || ''}\n${doc.tags || ''}`.toLowerCase();
      let score = 0;

      for (const term of terms) {
        if (haystack.includes(term)) score += 0.08;
      }

      if (section) {
        const sectionPattern = new RegExp(`\\bsection[_\\s-]*${section}\\b|\\b${section}\\b`);
        if (sectionPattern.test(haystack)) score += 0.75;
      }

      return {
        id: doc.id,
        score: Math.min(score, 1),
        hybridScore: Math.min(score, 1),
        metadata: {
          text: doc.text,
          source: doc.source,
          tags: doc.tags
        }
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, topK);
}

// Upload & Index
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded." });
    
    if (!process.env.PINECONE_API_KEY || !apiKey) {
      return res.status(400).json({ error: "Missing API Keys." });
    }

    const pineconeIndex = pc.index(indexName);
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 2000, chunkOverlap: 150 });
    
    const processFile = async (file) => {
      const rawText = await parseFile(file);
      const chunks = await splitter.splitText(rawText);
      const fileTags = generateTags(rawText);

      // Embed chunks in batches of 96 (Pinecone limit)
      const records = [];
      for (let i = 0; i < chunks.length; i += 96) {
        const batchChunks = chunks.slice(i, i + 96);
        const vectors = await embeddings.embedDocuments(batchChunks);
        
        batchChunks.forEach((chunk, index) => {
          records.push({
            id: uuidv4(),
            values: vectors[index],
            metadata: { 
              text: chunk, 
              source: file.originalname, 
              tags: fileTags.join(',')
            }
          });
        });
      }

      // Upsert in batches of 50
      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50);
        await pineconeIndex.upsert({ records: batch });
      }

      return chunks.length;
    };

    const chunkCounts = await Promise.all(files.map(processFile));
    const totalChunks = chunkCounts.reduce((sum, count) => sum + count, 0);
    
    res.json({ success: true, message: `Successfully indexed ${files.length} documents into ${totalChunks} chunks.` });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Chat / Query
app.post('/api/chat', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });
    
    const queryTags = generateTags(query, 4);
    
    let matches = [];

    try {
      const vector = await embeddings.embedQuery(query);
      const pineconeIndex = pc.index(indexName);

      // Semantic Vector search
      const searchRes = await pineconeIndex.query({
        vector,
        topK: 10,
        includeMetadata: true
      });

      // Hybrid Ranking
      matches = searchRes.matches.map(m => {
        const docTags = (m.metadata.tags || '').split(',');
        let tagMatches = 0;
        queryTags.forEach(qt => { if (docTags.includes(qt)) tagMatches++; });
        const hybridScore = m.score + (tagMatches * 0.15); // Boost factor
        return { ...m, hybridScore };
      });
    } catch (error) {
      console.warn("Pinecone retrieval unavailable, using backend knowledge base:", error.message);
    }

    if (matches.length === 0 && localKnowledgeBase.length > 0) {
      matches = searchLocalKnowledge(query);
    }
    
    matches.sort((a, b) => b.hybridScore - a.hybridScore);
    const sectionMatch = query.match(/\bsection\s+(\d+[a-z]?)\b/i);
    const exactSectionMatches = sectionMatch
      ? matches.filter((match) => {
          const section = sectionMatch[1].toLowerCase();
          const haystack = `${match.metadata?.source || ''}\n${match.metadata?.text || ''}\n${match.metadata?.tags || ''}`.toLowerCase();
          return new RegExp(`\\bsection[_\\s-]*${section}\\b|\\b${section}\\b`).test(haystack);
        })
      : [];
    const topMatches = (exactSectionMatches.length ? exactSectionMatches : matches).slice(0, 3);
    const highestScore = topMatches[0]?.hybridScore || 0;
    
    // Retrieval Validation Layer / Hallucination Prevention
    // If the top hybrid score is less than the threshold (e.g. 0.3), reject immediately.
    if (highestScore < 0.3 || topMatches.length === 0) {
       return res.json({ 
         answer: "Not Found in Knowledge Base",
         context: [],
         confidence: 0,
         sources: []
       });
    }
    
    const contextText = topMatches.map((m, i) => `Source Document: ${m.metadata.source}\nContent:\n${m.metadata.text}`).join('\n\n---\n\n');
    
    const prompt = `You are a domain-agnostic RAG Chatbot. You must answer the user's question STRICTLY based on the provided context below.
    
Rules:
1. Do NOT use external knowledge, pretrained knowledge, or assumptions.
2. If the context contains a relevant section or title but does not state the exact requested date/detail, answer with the relevant information that is present and clearly say the exact detail is not stated in the retrieved text.
3. Reply with "Not Found in Knowledge Base" only when the retrieved context is unrelated to the user's question.
4. Synthesize information from multiple retrieved chunks if required.
5. Your output should only contain information available in the retrieved documents.

Context:
${contextText}

User Question: ${query}`;
    
    const llmRes = await llm.invoke(prompt);
    let finalAnswer = llmRes.content.trim();
    
    // Safety check - If the LLM realized it didn't have the answer and outputted the fallback phrase (or similar)
    if (finalAnswer.toLowerCase().includes("not found in knowledge base")) {
        finalAnswer = buildContextAwareFallback(query, topMatches);
    }
    
    // Only extract unique sources
    const uniqueSources = [...new Set(topMatches.map(m => m.metadata.source))];
    
    res.json({
      answer: finalAnswer,
      context: topMatches.map(m => ({ text: m.metadata.text, source: m.metadata.source, score: m.hybridScore.toFixed(3), tags: m.metadata.tags })),
      confidence: Math.min(highestScore, 1).toFixed(2),
      sources: uniqueSources
    });
    
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

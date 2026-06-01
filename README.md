# Domain-Specific Retrieval-Augmented Generation (RAG) Chatbot

A production-ready RAG chatbot application built with React, Node.js, Pinecone, LangSmith, and Grok API (xAI). This system supports hybrid retrieval (vector search + tag-based search), automatic document tagging, hallucination prevention, and provides a beautiful, modern glassmorphism UI.

## Architecture Overview

The system is a Monorepo containing:
- **Frontend**: A React single-page application built with Vite and React Router. It features a premium, animated glassmorphic UI.
- **Backend**: An Express.js Node backend that integrates with Pinecone (Vector Database), Grok API (LLM via LangChain), and LangSmith for observability.
- **Data Ingestion**: A robust pipeline that accepts JSON documents containing Questions and Answers. For each document, it automatically generates semantic tags using the Grok API, creates embeddings using a local HuggingFace Transformer model, and indexes both dense vectors and metadata in Pinecone.
- **Retrieval Pipeline**: A hybrid search engine. When a user asks a query, the backend:
  1. Uses the LLM to extract tags from the user's query.
  2. Embeds the user query.
  3. Queries Pinecone for top K semantically similar documents.
  4. Ranks the retrieved documents by combining the Pinecone cosine similarity score with a tag match boost score (Naive Hybrid Search).
- **Generation & Validation**: Context is built from the top retrieved documents. The Grok API generates an answer strictly grounded in the context. If the highest retrieval score is too low, the system gracefully falls back to prevent hallucinations.

## Setup Instructions

### Prerequisites
- Node.js v18+
- Pinecone Account (Free Tier)
- xAI Account (for Grok API Key)
- LangSmith Account (Optional, for observability)

### Environment Configuration

In the `backend` directory, rename `.env.example` to `.env` (or create one) and configure:

```env
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=rag-chatbot
XAI_API_KEY=your_xai_api_key
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_api_key
PORT=5000
```

### Installation

1. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

3. Run the applications locally:
   - Backend: `npm start`
   - Frontend: `npm run dev`

## API Documentation

### `POST /api/upload`
Uploads a JSON dataset of Questions and Answers.
- **Request**: `multipart/form-data` with `file` field containing a `.json` file.
- **Response**: `{ success: true, message: "Successfully indexed X documents" }`

### `POST /api/chat`
Ask a question against the knowledge base.
- **Request**: `{ "query": "Your question here" }`
- **Response**: 
  ```json
  {
    "answer": "Grounded answer from Grok API",
    "context": [...],
    "confidence": "0.95",
    "sources": ["Question 1"]
  }
  ```

### `GET /api/stats`
Retrieves RAG pipeline evaluation statistics for the dashboard.

## Evaluation Methodology

The RAG application is evaluated based on:
1. **Retrieval Accuracy**: Measures how often the correct document is retrieved in the top K results.
2. **Precision@K**: The proportion of relevant documents in the top K retrieved documents.
3. **Recall@K**: The proportion of all relevant documents that are successfully retrieved in the top K.
4. **Hallucination Rate**: Monitored heavily using prompt engineering (strict contextual constraints) and confidence thresholds (< 0.25 rejects generation).

LangSmith automatically logs all LLM traces, retrieval contexts, and similarity scores. By reviewing the LangSmith dashboard, developers can establish ground truth datasets to run automated regression testing on the retriever.

## Vercel Deployment Guide

This project is configured as a Zero-Config monorepo for Vercel.

1. Ensure the `vercel.json` is at the root of the project.
2. Push your code to GitHub.
3. Import the repository in the Vercel dashboard.
4. Override the root directory if necessary (leave as default since `vercel.json` configures builds).
5. Set the following Environment Variables in Vercel:
   - `PINECONE_API_KEY`
   - `PINECONE_INDEX`
   - `XAI_API_KEY`
   - `LANGCHAIN_TRACING_V2`
   - `LANGCHAIN_API_KEY`
6. Deploy! Vercel will automatically build the React frontend to `dist` and deploy the Express serverless functions.

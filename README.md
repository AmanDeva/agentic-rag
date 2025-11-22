
# Cogni-Compliance: An End-to-End Agentic RAG System with a MERN Chat Interface

## Introduction

Cogni-Compliance is a full-stack, production-ready AI application that serves as an intelligent assistant for navigating complex legal and regulatory documents. It implements an advanced **Agentic Retrieval-Augmented Generation (RAG)** system, deployed on AWS EC2 and accessible through a MERN-based authenticated chat interface.

Unlike standard RAG pipelines, this system uses a **LangGraph-based agentic workflow** that evaluates retrieved content, filters irrelevant data, and generates verifiable outputs using a multi-model strategy powered by Groq and OpenRouter.

---

## System Highlights

- **Hybrid Retrieval Pipeline:** Pinecone vector search + BM25 + Cross-Encoder Re-ranking.
- **Agent-Based Validation:** Llama-3 grades retrieved documents before answer generation.
- **Answer Generation:** Powered by Mistral through OpenRouter with filtered context only.
- **Asynchronous Job Handling:** Long-running queries processed via AWS SQS worker.
- **Caching:** Redis caching layer reduces repeat inference cost.
- **Deployment:** Fully hosted API on AWS EC2 using FastAPI + Uvicorn + nohup background services.

---

## 🧠 Agentic RAG Architecture

### Architecture Stack

| Layer | Technology |
|-------|------------|
| Compute | AWS EC2 (t3.medium — Ubuntu 24.04 LTS) |
| API Framework | FastAPI (Python) |
| Vector DB | Pinecone Serverless (`cogni-compliance` index) |
| Search | Hybrid (Semantic + BM25 Keyword Search) |
| Re-Ranking | Flashrank (Cross-Encoder) |
| Workflow Orchestration | LangGraph |
| Async Processing | AWS SQS |
| Caching | Redis (Local) |
| Embeddings | BAAI/bge-large-en-v1.5 |
| LLMs | Llama-3 (Groq, grading) + Mistral (OpenRouter, final output) |

---

### System Data Flow

```

User Request (/ask or /ask_async)
│
├── Redis Cache Check (TTL: 24h)
│
├── Hybrid Retrieval:
│     • Pinecone Vector Search
│     • BM25 Search
│
├── Flashrank Cross-Encoder Re-Ranking (Top 10)
│
├── Llama-3 (Groq) grading agent filters irrelevant docs
│
└── Mistral (OpenRouter) final grounded-answer generation

````

---

## MERN Chat Application

The user-facing chat interface is built with the MERN stack.

| Component | Function |
|-----------|----------|
| React.js | Interactive chat UI |
| Express.js | API routing for user auth & messaging |
| MongoDB Atlas | User data + chat history |
| JWT Auth | Secure role-based access |
| Axios → FastAPI | Secure request proxy to EC2 RAG backend |

---

## Deployment & DevOps

### EC2 Server Details

| Parameter | Value |
|-----------|-------|
| Public IP | `52.2.240.7` |
| API Port | `8000` |
| OS | Ubuntu 24.04 LTS |

---

### SSH Access

```bash
ssh -i "rag-key.pem" ubuntu@52.2.240.7
````

---

### Project Location on Server

```bash
cd /home/ubuntu/agentic-rag
source venv/bin/activate
```

---

### Background Services & Logs

| Service     | Command              |
| ----------- | -------------------- |
| API Logs    | `tail -f api.log`    |
| Worker Logs | `tail -f worker.log` |

---

### Restarting EC2 Services

#### Step 1 — Kill Old Processes

```bash
pkill -f python
pkill -f uvicorn
```

#### Step 2 — Start SQS Worker

```bash
nohup ./venv/bin/python worker.py > worker.log 2>&1 &
```

#### Step 3 — Start API Server

```bash
nohup ./venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000 > api.log 2>&1 &
```

---

## Environment Variables

Environment file:

```
/home/ubuntu/agentic-rag/.env
```

Variables include:

```
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=

GROQ_API_KEY=
OPENAI_API_KEY=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SQS_QUEUE_URL=

REDIS_HOST=localhost
```

---

## Endpoints

| Method | Route        | Mode  | Description            |
| ------ | ------------ | ----- | ---------------------- |
| POST   | `/ask`       | Sync  | Direct response        |
| POST   | `/ask_async` | Async | Handled via SQS worker |

---

## Evaluation

The RAG pipeline can be quantitatively assessed using:

* **RAGAS**
* Faithfulness, Context Precision, and Answer Relevance metrics
* A pre-labeled Golden Dataset

---

## Future Enhancements

* GPU-based embedding server
* Multi-tenant enterprise access
* S3 + Athena lineage logging
* Auto-refreshing model router

---

### Status: 🟢 Active & Production Ready

This unified documentation serves as both the **system architecture reference** and **maintenance guide** for engineers deploying and scaling Cogni-Compliance.

---

```
```

# Cogni-Compliance: An End-to-End Agentic RAG System with a MERN Chat Interface

## Introduction

Cogni-Compliance is a full-stack, production-ready AI application that serves as an intelligent assistant for navigating complex legal and regulatory documents. This project demonstrates a complete end-to-end workflow, from raw data ingestion and advanced retrieval logic to a live API deployment on AWS EC2, all accessed through a modern MERN-stack chat application with user authentication and chat history.

The core of the project is a sophisticated **Agentic Retrieval-Augmented Generation (RAG)** system built with LangGraph. Unlike a simple RAG chain, this agent can make decisions, grading the relevance of retrieved context before generating a final, grounded answer. It leverages a multi-model strategy, using the high-speed Groq API for intermediary tasks and powerful models from OpenRouter for final generation, showcasing an optimized approach to cost and performance.

---

## Key Features

* **Advanced RAG Pipeline:** Implements a three-stage retrieval process for maximum accuracy:
    1.  **Hybrid Search:** Combines keyword (BM25) and semantic (FAISS with BGE embeddings) search to ensure high recall.
    2.  **Cross-Encoder Re-ranking:** Re-ranks initial results for high precision, ensuring only the most relevant context is used.
* **Agentic Workflow with LangGraph:** The system is built as a stateful agent, not a simple chain. It retrieves documents, uses an LLM to grade their relevance, and then makes a decision on whether to generate an answer, making it more robust against irrelevant context.
* **Optimized Multi-Model Strategy:** Utilizes the ultra-fast **Groq API** (Llama 3.1) for routing and grading tasks and the powerful **OpenRouter API** (Mixtral) for high-quality final answer generation.
* **Full-Stack MERN Application:** A complete chat application built with **MongoDB, Express.js, React, and Node.js**, featuring:
    * Secure user signup and login with JWT authentication.
    * Persistent chat history saved per user in a MongoDB Atlas database.
    * An interactive, real-time chat interface styled to look like modern AI assistants.
* **Production API Deployment:** The Python-based RAG agent is deployed as a scalable API using **FastAPI** on an **AWS EC2 (t3.large)** instance, running as a persistent background service with `nohup`.
* **Quantitative Evaluation:** The system's performance can be objectively measured using the **RAGAS** framework against a "Golden Dataset" to score for faithfulness, answer relevancy, and context precision.

---

## Architecture Overview

The project is composed of two main components that communicate over the internet:

1.  **RAG API (The "Brain"):**
    * A Python application built with **FastAPI**.
    * Hosted on a public **AWS EC2** instance.
    * Handles all the complex AI logic: receiving a question, executing the LangGraph agent, and returning a generated answer.
    * Uses a file-based **FAISS** vector database for semantic search.

2.  **MERN Chat App (The "Face"):**
    * A standard MERN-stack application running locally.
    * The **React frontend** provides the user interface for chat and authentication.
    * The **Express.js backend** acts as a middleman, managing users and chat history in **MongoDB Atlas** and making secure calls to the RAG API on EC2.

![Architecture Diagram](https://i.imgur.com/your-architecture-diagram-link.png) 
*(**Note:** You can create a simple diagram using a tool like diagrams.net and upload it to your repository to replace this link.)*

---

## Technology Stack

* **AI/ML:** LangChain, LangGraph, Sentence Transformers, FAISS, PyTorch
* **LLM APIs:** Groq, OpenRouter
* **Backend (RAG API):** Python, FastAPI, Uvicorn
* **Backend (Chat App):** Node.js, Express.js, Mongoose
* **Frontend:** React.js
* **Database:** MongoDB Atlas
* **Deployment:** AWS EC2, Git, GitHub, `nohup`
* **Evaluation:** RAGAS

---

## Setup and Installation

### Prerequisites

* Node.js and npm installed
* Python 3.10+
* Git installed
* An AWS account
* API keys from Groq and OpenRouter

### 1. RAG API (on AWS EC2)

Follow these steps to deploy the Python backend.

1.  **Launch and configure an AWS EC2 instance:**
    * **Instance Type:** `t3.large` (8 GiB RAM is recommended).
    * **OS:** Ubuntu 22.04 LTS.
    * **Storage:** 50 GB.
    * **Security Group:** Open inbound TCP traffic on ports `22` (for SSH) and `8000` (for the API).
2.  **Clone the repository:**
    ```bash
    git clone [https://github.com/AmanDeva/agentic-rag.git](https://github.com/AmanDeva/agentic-rag.git)
    cd agentic-rag
    ```
3.  **Upload data files:** Use `scp` to securely copy your local `processed_chunks.jsonl` file and your `faiss_index` directory into the `agentic-rag` folder on the EC2 instance.
4.  **Set up the Python environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```
5.  **Create the `.env` file:**
    ```bash
    nano .env
    ```
    Add your API keys to this file:
    ```env
    GROQ_API_KEY=gsk_...
    OPENROUTER_API_KEY=sk-or-v1-...
    OPENAI_API_KEY=sk-or-v1-...
    ```

### 2. MERN Chat Application (on your Local Machine)

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/AmanDeva/agentic-rag.git](https://github.com/AmanDeva/agentic-rag.git)
    cd agentic-rag
    ```
2.  **Set up the Backend:**
    ```bash
    cd backend
    npm install
    ```
    Create a `.env` file in the `backend` directory and add your MongoDB connection string, a JWT secret, and the URL to your live EC2 API.
    ```env
    MONGO_URI=mongodb+srv://...
    JWT_SECRET=YOUR_RANDOM_SECRET_KEY
    RAG_API_URL=http://YOUR_EC2_PUBLIC_IP:8000/ask
    ```
3.  **Set up the Frontend:**
    ```bash
    cd ../frontend
    npm install
    ```

---

## Running the Application

1.  **Start the RAG API on EC2:**
    * SSH into your instance, navigate to the `agentic-rag` directory, and activate the environment (`source venv/bin/activate`).
    * Run the server in the background:
        ```bash
        nohup uvicorn app:app --host 0.0.0.0 --port 8000 > nohup.out 2>&1 &
        ```
2.  **Start the MERN Backend Locally:**
    * In a terminal, navigate to the `MERN-RAG-App/backend` directory and run:
        ```bash
        node server.js
        ```
3.  **Start the MERN Frontend Locally:**
    * In a **second** terminal, navigate to the `MERN-RAG-App/frontend` directory and run:
        ```bash
        npm start
        ```
    * Your browser will open to `http://localhost:3000`, where you can sign up, log in, and start chatting.

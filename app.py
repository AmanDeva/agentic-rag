# app.py

import os
import json
from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel
# CORRECTED: Import load_dotenv to handle API keys from a .env file
from dotenv import load_dotenv

# --- Load Environment Variables ---
# This line will load the keys from the .env file on your EC2 server
load_dotenv()

# --- LangChain Imports ---
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_community.vectorstores import FAISS
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

# --- Global variables for the loaded models ---
rag_app = None

# --- Pydantic Models for API Request/Response ---
class QueryRequest(BaseModel):
    question: str

class QueryResponse(BaseModel):
    answer: str

# --- Loading Logic (remains the same) ---
def load_components():
    print("Loading RAG components...")
    PROJECT_DIR = "./" 
    INDEX_PATH = os.path.join(PROJECT_DIR, "faiss_index")
    JSONL_PATH = os.path.join(PROJECT_DIR, "processed_chunks.jsonl")

    docs = [Document(page_content=json.loads(line)['text'], metadata=json.loads(line)['metadata']) for line in open(JSONL_PATH, 'r', encoding='utf-8')]
    embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-large-en-v1.5", model_kwargs={'device': 'cpu'})
    vectorstore = FAISS.load_local(INDEX_PATH, embeddings, allow_dangerous_deserialization=True)
    
    faiss_retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
    bm25_retriever = BM25Retriever.from_documents(docs)
    bm25_retriever.k = 5
    ensemble_retriever = EnsembleRetriever(retrievers=[bm25_retriever, faiss_retriever], weights=[0.5, 0.5])
    
    # LangGraph Agent Definition
    class GraphState(dict):
        question: str; documents: List[Document]; generation: str

    grader_llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0)
    # The ChatOpenAI class will automatically look for the OPENAI_API_KEY environment variable
    generator_llm = ChatOpenAI(model="mistralai/mixtral-8x7b-instruct", base_url="https://openrouter.ai/api/v1")

    def retrieve(state):
        state['documents'] = ensemble_retriever.invoke(state['question'])
        return state
    def grade(state):
        prompt = PromptTemplate.from_template("Grade relevance of document to question. Score 'yes' or 'no'. JSON out: {{\"score\": \"yes\"}}. Document: {document}\\nQuestion: {question}")
        grader = prompt | grader_llm | JsonOutputParser()
        filtered = [d for d in state['documents'] if grader.invoke({"question": state['question'], "document": d.page_content}).get('score', 'no').lower() == "yes"]
        state['documents'] = filtered
        return state
    def generate(state):
        prompt = PromptTemplate.from_template("Answer based on context:\\nContext:{context}\\nQuestion:{question}")
        def format_docs(docs): return "\\n\\n".join(doc.page_content for doc in docs)
        chain = {"context": format_docs, "question": lambda s: s['question']} | prompt | generator_llm | StrOutputParser()
        state['generation'] = chain.invoke(state)
        return state
    def decide(state): return "generate" if state.get("documents") else "end"
    
    wf = StateGraph(GraphState)
    wf.add_node("retrieve", retrieve); wf.add_node("grade", grade); wf.add_node("generate", generate)
    wf.set_entry_point("retrieve"); wf.add_edge("retrieve", "grade")
    wf.add_conditional_edges("grade", decide, {"generate": "generate", "end": END}); wf.add_edge("generate", END)
    
    print("RAG components loaded successfully.")
    return wf.compile()

# --- FastAPI Lifespan & App Initialization (remains the same) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_app
    rag_app = load_components()
    yield
    rag_app = None

app = FastAPI(lifespan=lifespan)

@app.get("/")
def read_root():
    return {"status": "Cogni-Compliance API is running"}

@app.post("/ask", response_model=QueryResponse)
async def ask_question(request: QueryRequest):
    if not rag_app:
        return {"answer": "Error: RAG agent not loaded."}
    
    response = rag_app.invoke({"question": request.question})
    final_answer = response.get("generation", "I don't have enough information to answer.")
    return {"answer": final_answer}
import os
import json
from typing import List, Sequence
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langchain_pinecone import PineconeVectorStore
from flashrank import Ranker

# --- Config ---
PINECONE_INDEX_NAME = "cogni-compliance"

def build_agent():
    print("--- Building RAG Components ---")
    
    # 1. Load Embeddings
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-large-en-v1.5", 
        model_kwargs={'device': 'cpu'}
    )

    # 2. Connect to Pinecone
    vectorstore = PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME, 
        embedding=embeddings
    )
    pinecone_retriever = vectorstore.as_retriever(search_kwargs={"k": 10})

    # 3. Load BM25 (from local file if exists)
    ensemble_retriever = None
    if os.path.exists("processed_chunks.jsonl"):
        print("Loading BM25 from processed_chunks.jsonl...")
        docs = [Document(page_content=json.loads(line)['text'], metadata=json.loads(line)['metadata']) for line in open("processed_chunks.jsonl", 'r', encoding='utf-8')]
        bm25_retriever = BM25Retriever.from_documents(docs)
        bm25_retriever.k = 10
        ensemble_retriever = EnsembleRetriever(retrievers=[bm25_retriever, pinecone_retriever], weights=[0.5, 0.5])
    else:
        print("⚠️ processed_chunks.jsonl not found. Running in Pinecone-only mode.")
        ensemble_retriever = pinecone_retriever

    # 4. Load Re-ranker
    reranker_model = Ranker(model_name="ms-marco-MiniLM-L-12-v2")

    # 5. Load LLMs
    grader_llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0)
    generator_llm = ChatOpenAI(model="mistralai/mixtral-8x7b-instruct", base_url="https://openrouter.ai/api/v1")

    # --- LangGraph Nodes ---
    class GraphState(dict):
        question: str
        documents: List[Document]
        generation: str

    def retrieve(state):
        print(f"Retrieving: {state['question'][:30]}...")
        state['documents'] = ensemble_retriever.invoke(state['question'])
        return state

    def rerank(state):
        # Flashrank logic
        if not state['documents']: return state
        passages = [{"id": i, "text": d.page_content} for i, d in enumerate(state['documents'])]
        reranked = reranker_model.rerank(query=state['question'], passages=passages, top_k=5)
        state['documents'] = [state['documents'][r['id']] for r in reranked]
        return state

    def grade(state):
        # LLM Grading logic
        prompt = PromptTemplate.from_template("Grade relevance (yes/no). JSON out: {{\"score\": \"yes\"}}. Doc: {document}\nQ: {question}")
        chain = prompt | grader_llm | JsonOutputParser()
        filtered = [d for d in state['documents'] if chain.invoke({"question": state['question'], "document": d.page_content}).get('score','no') == 'yes']
        state['documents'] = filtered
        return state

    def generate(state):
        if not state['documents']:
            state['generation'] = "I could not find relevant legal information to answer this."
            return state
        
        context = "\n\n".join(d.page_content for d in state['documents'])
        prompt = PromptTemplate.from_template("Answer based ONLY on context:\n{context}\n\nQuestion:\n{question}")
        chain = prompt | generator_llm | StrOutputParser()
        state['generation'] = chain.invoke({"context": context, "question": state['question']})
        return state

    # --- Build Graph ---
    wf = StateGraph(GraphState)
    wf.add_node("retrieve", retrieve)
    wf.add_node("rerank", rerank)
    wf.add_node("grade", grade)
    wf.add_node("generate", generate)
    
    wf.set_entry_point("retrieve")
    wf.add_edge("retrieve", "rerank")
    wf.add_edge("rerank", "grade")
    wf.add_edge("grade", "generate")
    wf.add_edge("generate", END)

    return wf.compile()
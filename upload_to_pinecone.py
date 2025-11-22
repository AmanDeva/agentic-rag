import os
import json
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore

# --- Load Environment Variables ---
# This will load your .env file [cite: Agentic-RAG-Project/.env]
load_dotenv() 

# --- Config ---
JSONL_PATH = "./processed_chunks.jsonl"
INDEX_NAME = "cogni-compliance" # Must match the name you created in the UI

def main():
    # Make sure API keys are loaded
    if not os.getenv("PINECONE_API_KEY") or not os.getenv("PINECONE_ENVIRONMENT"):
        print("Error: PINECONE_API_KEY or PINECONE_ENVIRONMENT not found in .env file.")
        print("Please add them to your .env file before running.")
        return

    print("Loading documents from JSONL [cite: Agentic-RAG-Project/processed_chunks.jsonl]...")
    # Load docs from your local file
    docs = [
        Document(
            page_content=json.loads(line)['text'],
            metadata=json.loads(line)['metadata']
        ) 
        for line in open(JSONL_PATH, 'r', encoding='utf-8')
    ]
    
    print(f"Loaded {len(docs)} document chunks.")

    print("Loading embedding model (BAAI/bge-large-en-v1.5)... this may take a moment.")
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-large-en-v1.5", 
        model_kwargs={'device': 'cpu'}
    )

    print(f"Uploading {len(docs)} documents to Pinecone index '{INDEX_NAME}'...")
    
    try:
        # This will connect to your Pinecone account,
        # create embeddings for all docs, and upload them in batches.
        PineconeVectorStore.from_documents(
            docs,
            embeddings,
            index_name=INDEX_NAME
        )
        
        print(f"\n--- SUCCESS ---")
        print(f"Successfully uploaded and indexed all {len(docs)} documents to Pinecone.")
    
    except Exception as e:
        print(f"\n--- ERROR ---")
        print(f"An error occurred during the upload: {e}")
        print("This could be due to API keys or network issues.")

if __name__ == "__main__":
    main()
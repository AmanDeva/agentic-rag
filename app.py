import os
import json
import hashlib
import boto3
import redis
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# --- Import the RAG Builder from the separate file ---
from rag_agent import build_agent

# --- Load Environment Variables ---
load_dotenv()

# --- Configuration ---
# Redis is running locally on the EC2 instance
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = 6379
SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL")
CACHE_TTL = 3600 * 24 # Cache answers for 24 hours

# --- Initialize Services ---
# 1. Redis Client
try:
    redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
    redis_client.ping() # Test connection
    print("✅ Connected to Redis")
except Exception as e:
    print(f"⚠️ Redis connection failed: {e}")
    redis_client = None

# 2. SQS Client (for Async requests)
sqs = boto3.client(
    'sqs',
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)

# --- Global Variables ---
rag_app = None

# --- Pydantic Models ---
class QueryRequest(BaseModel):
    question: str

class AsyncQueryResponse(BaseModel):
    job_id: str
    status: str

# --- Helper: Generate Cache Key ---
def get_cache_key(text):
    return f"q:{hashlib.md5(text.encode()).hexdigest()}"

# --- Lifecycle: Load Agent on Startup ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_app
    print("🚀 Loading RAG Agent into memory...")
    rag_app = build_agent() # Loads BGE-Large, Re-ranker, Pinecone connection
    print("✅ RAG Agent Ready.")
    yield
    rag_app = None

app = FastAPI(lifespan=lifespan)

@app.get("/")
def read_root():
    return {
        "status": "Cogni-Compliance API (EC2)", 
        "redis": "connected" if redis_client else "disabled"
    }

# --- Endpoint 1: Synchronous /ask (High Speed with Cache) ---
@app.post("/ask")
async def ask_question(request: QueryRequest):
    # 1. FAST PATH: Check Redis Cache
    if redis_client:
        cache_key = get_cache_key(request.question)
        cached_answer = redis_client.get(cache_key)
        if cached_answer:
            return {"answer": cached_answer, "source": "cache"}

    # 2. SLOW PATH: Run RAG Agent
    if not rag_app:
        raise HTTPException(status_code=503, detail="RAG Agent not ready")
    
    try:
        response = rag_app.invoke({"question": request.question})
        final_answer = response.get("generation", "I don't have enough information to answer.")
    except Exception as e:
        print(f"Error running agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # 3. Save to Redis for next time
    if redis_client:
        redis_client.setex(cache_key, CACHE_TTL, final_answer)

    return {"answer": final_answer, "source": "live"}

# --- Endpoint 2: Asynchronous /ask_async (For heavy load) ---
@app.post("/ask_async", response_model=AsyncQueryResponse)
async def ask_async(request: QueryRequest):
    if not SQS_QUEUE_URL:
        raise HTTPException(status_code=500, detail="SQS Queue URL not configured in .env")

    try:
        # Push job to SQS
        response = sqs.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps({"question": request.question}),
            MessageAttributes={
                'RequestType': {'DataType': 'String', 'StringValue': 'RAG_Query'}
            }
        )
        return {
            "job_id": response['MessageId'], 
            "status": "queued"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
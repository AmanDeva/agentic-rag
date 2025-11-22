import os
import time
import json
import boto3
from dotenv import load_dotenv
from rag_agent import build_agent

load_dotenv()

SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL")

def main():
    if not SQS_QUEUE_URL:
        print("❌ Error: SQS_QUEUE_URL not found in .env")
        return

    print("👷 SQS Worker Starting...")
    
    # 1. Init SQS
    sqs = boto3.client(
        'sqs',
        region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
    )

    # 2. Init RAG Agent
    print("🧠 Loading AI Models...")
    agent = build_agent()
    print(f"✅ Worker Ready. Listening to: {SQS_QUEUE_URL}")

    while True:
        try:
            # Long Polling
            response = sqs.receive_message(
                QueueUrl=SQS_QUEUE_URL,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20
            )

            if 'Messages' in response:
                for msg in response['Messages']:
                    body = json.loads(msg['Body'])
                    question = body.get("question")
                    receipt_handle = msg['ReceiptHandle']

                    print(f"📨 Processing Job: {question}")
                    
                    # --- RUN RAG ---
                    result = agent.invoke({"question": question})
                    answer = result.get("generation")
                    print(f"✅ Answer Generated: {answer[:50]}...")

                    # TODO: Here you would save the answer to MongoDB for the frontend to fetch
                    
                    # Delete from queue
                    sqs.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt_handle)
            else:
                pass # No messages

        except Exception as e:
            print(f"❌ Worker Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
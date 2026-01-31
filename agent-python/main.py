import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv

# Loading environment variables
load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
client = None

if not api_key:
    print("api key not found")
else:
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Error")

app = FastAPI(title="AI Agent")

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    role: str = "assistant"

# Simple Dummy Agent Logic
def dummy_agent_process(message: str):
    msg = message.lower().strip()
    if "hello" in msg:
        return "I am your GDG AI Assistant!"
    if "Goodbye" in msg:
        return "Bye!"
    return None

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    if not request.message:
        raise HTTPException(status_code=400, detail="Empty message")

    # 1. checking dummy agent at start
    dummy_response = dummy_agent_process(request.message)
    if dummy_response:
        return ChatResponse(response=dummy_response)

    # 2. dng with api key
    if not client:
        return ChatResponse(response="Please provide a valid GOOGLE_API_KEY.")

    try:
        # gemini-2.0-flash
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=f"You are a helpful assistant. Answer the following message concisely: {request.message}"
        )
        
        return ChatResponse(response=response.text)
    except Exception as e:
        print(f"Error")
        try:
            # fallback
            response = client.models.generate_content(
                model='gemini-flash-latest',
                contents=request.message
            )
            return ChatResponse(response=response.text)
        except Exception as e2:
            print(f"Error")
            return ChatResponse(response="I'm having trouble connecting to my AI brain. Please check the GOOGLE_API_KEY.")

@app.get("/health")
async def health_check():
    return {"status": "ok", "agent": "GDG AI Agent"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

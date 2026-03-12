import os
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Resume Optimizer API")

# Allow all origins for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {str(e)}")

# Define the Pydantic schema for the LLM output is not strictly necessary since
# we can just use JSON mode or rely on the system prompt and parse it.
# We'll use the prompt directly to get strict JSON.

SYSTEM_PROMPT = """You are an expert ATS Resume Optimizer and Tech Career Coach.

The user will give you:
1. Two resumes extracted from PDFs (Gen AI Resume and Backend Developer Resume)
2. A job description / vacancy post

Your job:
- Analyze both resumes against the job description
- For EACH resume, return an optimized version rewritten in LaTeX format
- The LaTeX resume must be ATS-friendly: no tables, no columns, no images, clean section headers (Education, Experience, Skills, Projects)
- Add keywords from the JD naturally into the resume content
- Remove irrelevant skills that hurt ATS ranking for this specific role
- Give a match score out of 100
- Suggest 2 specific projects the candidate should build to get shortlisted for this exact role — be very specific with tech stack, what to build, and exactly why it matches the JD

Respond ONLY with a valid JSON object. No markdown, no explanation outside JSON.
Use this exact structure:
{
  "resume_genai": {
    "match_score": number,
    "optimized_resume_latex": "full latex string",
    "added_keywords": ["keyword1", "keyword2"],
    "removed_keywords": ["keyword1"],
    "ats_tips": ["tip1", "tip2"],
    "project_suggestions": [{ "title": "title", "description": "desc", "why_selected": "why" }]
  },
  "resume_backend": {
    "match_score": number,
    "optimized_resume_latex": "full latex string",
    "added_keywords": [],
    "removed_keywords": [],
    "ats_tips": [],
    "project_suggestions": [{ "title": "", "description": "", "why_selected": "" }]
  }
}
"""

@app.post("/api/optimize")
async def optimize_resumes(
    resume_genai: UploadFile = File(...),
    resume_backend: UploadFile = File(...),
    job_description: str = Form(...)
):
    # Ensure Gemini API key is set
    if not os.environ.get("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set.")

    # Validate files
    if not resume_genai.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Gen AI resume must be a PDF file.")
    if not resume_backend.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Backend resume must be a PDF file.")

    # Extract text from PDFs
    genai_text = extract_text_from_pdf(await resume_genai.read())
    backend_text = extract_text_from_pdf(await resume_backend.read())

    # Format the prompt
    user_message = f"""Here are the inputs:

--- Gen AI Resume ---
{genai_text}

--- Backend Resume ---
{backend_text}

--- Job Description ---
{job_description}
"""

    try:
        # Initialize Gemini Model via LangChain
        # Using gemini-2.5-flash since gemini-pro is legacy, but we can stick to modern models.
        # Alternatively, using gemini-1.5-pro or gemini-2.0-flash.
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.2,
            max_tokens=8192,
            timeout=120,
            max_retries=2
        )

        messages = [
            ("system", SYSTEM_PROMPT),
            ("human", user_message)
        ]

        response = llm.invoke(messages)
        content = response.content.strip()

        # Clean up possible markdown wrappers if the model didn't follow "ONLY JSON" perfectly
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        content = content.strip()

        # Try to parse to validate it's proper JSON before returning to standard
        parsed_json = json.loads(content)
        return parsed_json

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Processing Failed: {str(e)}")

@app.get("/health")
def health_check():
    return {"status": "ok"}

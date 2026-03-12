import os
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
from pydantic import BaseModel
from langchain_huggingface import HuggingFaceEndpoint
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
1. Two original resumes extracted from PDFs
2. A job description / vacancy post
3. Two STRICT LaTeX Templates: one for Gen AI, one for Backend.

Your job:
- Analyze both resumes against the job description.
- For EACH resume category, generate a highly optimized version with a 90-100% keyword match to the given Job Description.
- You MUST return the optimized resumes using the EXACT LaTeX Templates provided for each category. Do not change the document class, margins, packages, styling, or contact information. Only modify the Skills, Experience bullet points, and Project descriptions to align perfectly with the job description. Keep the Education graduation date exactly as "2021 - 2025".
- Add keywords from the JD naturally into the resume content.
- Remove irrelevant skills that hurt ATS ranking for this specific role.
- Give a match score out of 100.
- Suggest 2 specific projects the candidate should build to get shortlisted for this exact role — be very specific with tech stack, what to build, and exactly why it matches the JD.

Respond ONLY with a valid JSON object. No markdown, no explanation outside JSON.
Use this exact structure:
{
  "resume_genai": {
    "match_score": number,
    "optimized_resume_latex": "exact latex string mapped from the Gen AI template",
    "added_keywords": ["keyword1", "keyword2"],
    "removed_keywords": ["keyword1"],
    "ats_tips": ["tip1", "tip2"],
    "project_suggestions": [{ "title": "title", "description": "desc", "why_selected": "why" }]
  },
  "resume_backend": {
    "match_score": number,
    "optimized_resume_latex": "exact latex string mapped from the Backend template",
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
    # Ensure Groq Token is set
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not set in .env")
        
    # Validate files
    if not resume_genai.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Gen AI resume must be a PDF file.")
    if not resume_backend.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Backend resume must be a PDF file.")

    # Extract text from PDFs
    genai_text = extract_text_from_pdf(await resume_genai.read())
    backend_text = extract_text_from_pdf(await resume_backend.read())

    # Load templates
    base_dir = os.path.dirname(os.path.abspath(__file__))
    try:
        with open(os.path.join(base_dir, "template_genai.tex"), "r", encoding="utf-8") as f:
            template_genai = f.read()
        with open(os.path.join(base_dir, "template_backend.tex"), "r", encoding="utf-8") as f:
            template_backend = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load LaTeX templates: {str(e)}")

    # Format the prompt
    user_message = f"""Here are the inputs:

--- Original Gen AI Resume Text ---
{genai_text}

--- Original Backend Resume Text ---
{backend_text}

--- TARGET Gen AI LaTeX Template to Fill ---
{template_genai}

--- TARGET Backend LaTeX Template to Fill ---
{template_backend}

--- Job Description ---
{job_description}
"""
    
    from groq import Groq
    
    try:
        client = Groq(api_key=groq_api_key)
        
        # Using Llama 3 70B on Groq which supports incredibly fast token generation and JSON schema
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT + "\n\nIMPORTANT: Your entire response must be a single raw JSON object. No markdown, no backticks, no explanation. Start with { and end with }."},
                {"role": "user", "content": user_message}
            ],
            max_tokens=4096,
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content.strip()

        # Clean up possible markdown wrappers if the model hallucinated any
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

    except json.JSONDecodeError as decode_err:
        raise HTTPException(status_code=500, detail=f"LLM returned invalid JSON. Raw output: {content}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Processing Failed: {str(e)}")

@app.get("/health")
def health_check():
    return {"status": "ok"}

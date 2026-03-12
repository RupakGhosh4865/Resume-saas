import os
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
from pydantic import BaseModel
from langchain_huggingface import HuggingFaceEndpoint
from dotenv import load_dotenv

import sqlite3
from datetime import datetime

load_dotenv()

app = FastAPI(title="AI Resume Optimizer API")

# Database Setup
DB_PATH = "resume_history.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            job_description TEXT,
            match_score_genai INTEGER,
            match_score_backend INTEGER,
            data_json TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS defaults (
            id TEXT PRIMARY KEY,
            filename TEXT,
            text_content TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@app.post("/api/save-defaults")
async def save_defaults(
    resume_genai: UploadFile = File(None),
    resume_backend: UploadFile = File(None)
):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if resume_genai:
            content = extract_text_from_pdf(await resume_genai.read())
            cursor.execute("INSERT OR REPLACE INTO defaults (id, filename, text_content) VALUES ('genai', ?, ?)", 
                           (resume_genai.filename, content))
        
        if resume_backend:
            content = extract_text_from_pdf(await resume_backend.read())
            cursor.execute("INSERT OR REPLACE INTO defaults (id, filename, text_content) VALUES ('backend', ?, ?)", 
                           (resume_backend.filename, content))
        
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-defaults")
async def get_defaults():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, filename FROM defaults")
        rows = cursor.fetchall()
        conn.close()
        return {row[0]: row[1] for row in rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
- **NEW**: For EACH resume category, write a professional, formal **Cover Letter** (approx. 250-300 words) and a **Recruitment Email** (meant for HR/Hiring Manager). These should describe the candidate's expertise, why they are willing to join the company, and how they add specific value based on the JD. Use a polite, confident, and persuasive tone.

Respond ONLY with a valid JSON object. No markdown, no explanation outside JSON.
Use this exact structure:
{
  "resume_genai": {
    "match_score": number,
    "optimized_resume_latex": "exact latex string",
    "added_keywords": ["kw1"],
    "removed_keywords": ["kw2"],
    "ats_tips": ["tip1"],
    "project_suggestions": [{ "title": "t1", "description": "d1", "why_selected": "w1" }],
    "cover_letter": "The full text of the professional cover letter",
    "application_email": "The full text of the recruitment email"
  },
  "resume_backend": {
    "match_score": number,
    "optimized_resume_latex": "exact latex string",
    "added_keywords": [],
    "removed_keywords": [],
    "ats_tips": [],
    "project_suggestions": [{ "title": "", "description": "", "why_selected": "" }],
    "cover_letter": "The full text of the professional cover letter",
    "application_email": "The full text of the recruitment email"
  }
}
"""

@app.post("/api/optimize")
async def optimize_resumes(
    resume_genai: UploadFile = File(None),
    resume_backend: UploadFile = File(None),
    job_description: str = Form(...)
):
    # Ensure Groq Token is set
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not set in .env")
        
    # Extract text or fetch defaults
    genai_text = ""
    backend_text = ""
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Gen AI Resume logic
    if resume_genai:
        if not resume_genai.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Gen AI resume must be a PDF file.")
        genai_text = extract_text_from_pdf(await resume_genai.read())
    else:
        cursor.execute("SELECT text_content FROM defaults WHERE id = 'genai'")
        row = cursor.fetchone()
        if row:
            genai_text = row[0]
        else:
            raise HTTPException(status_code=400, detail="Gen AI Resume missing and no default found.")

    # Backend Resume logic
    if resume_backend:
        if not resume_backend.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Backend resume must be a PDF file.")
        backend_text = extract_text_from_pdf(await resume_backend.read())
    else:
        cursor.execute("SELECT text_content FROM defaults WHERE id = 'backend'")
        row = cursor.fetchone()
        if row:
            backend_text = row[0]
        else:
            raise HTTPException(status_code=400, detail="Backend Resume missing and no default found.")
    
    conn.close()

    # Load and optimize templates to minimize token generation
    def minify_latex(text: str) -> str:
        import re
        # Remove comments (lines starting with %)
        text = re.sub(r'(?m)^%.*$', '', text)
        # Remove inline comments (not escaped %)
        text = re.sub(r'(?<!\\)%.*$', '', text)
        # Remove excessive whitespace
        text = re.sub(r'\n\s*\n', '\n', text)
        return text.strip()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    try:
        with open(os.path.join(base_dir, "template_genai.tex"), "r", encoding="utf-8") as f:
            template_genai = minify_latex(f.read())
        with open(os.path.join(base_dir, "template_backend.tex"), "r", encoding="utf-8") as f:
            template_backend = minify_latex(f.read())
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
            max_tokens=8000,
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

        # Save to DB
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO history (timestamp, job_description, match_score_genai, match_score_backend, data_json)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                datetime.now().isoformat(),
                job_description,
                parsed_json.get("resume_genai", {}).get("match_score", 0),
                parsed_json.get("resume_backend", {}).get("match_score", 0),
                content
            ))
            conn.commit()
            conn.close()
        except Exception as db_err:
            print(f"Database error: {db_err}")

        # Try to parse to validate it's proper JSON before returning to standard
        return parsed_json

    except json.JSONDecodeError as decode_err:
        raise HTTPException(status_code=500, detail=f"LLM returned invalid JSON. Raw output: {content}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Processing Failed: {str(e)}")

@app.get("/api/history")
async def get_history():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM history ORDER BY timestamp DESC LIMIT 20")
        rows = cursor.fetchall()
        conn.close()
        
        result = []
        for row in rows:
            result.append({
                "id": row["id"],
                "timestamp": row["timestamp"],
                "job_description": row["job_description"],
                "match_score_genai": row["match_score_genai"],
                "match_score_backend": row["match_score_backend"],
                "data": json.loads(row["data_json"])
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")

import requests
from fastapi.responses import StreamingResponse
import io

class CompileRequest(BaseModel):
    latex_code: str

@app.post("/api/compile-pdf")
async def compile_pdf(request: CompileRequest):
    templates_to_try = [
        # Primary: latex.online (with better timeout and user-agent)
        ("https://latex.online/compile?command=pdflatex", "post_json"),
        # Fallback: texlive.net (widely used for web-based tex)
        ("https://texlive.net/cgi-bin/texlive/texlive.sh", "post_form")
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    last_error = ""
    for url, method in templates_to_try:
        try:
            if method == "post_json":
                response = requests.post(url, json={"text": request.latex_code}, headers=headers, timeout=15)
            else:
                # texlive.net format
                response = requests.post(url, data={
                    "filecontents[]": request.latex_code,
                    "filename[]": "main.tex",
                    "engine": "pdflatex",
                    "return": "pdf"
                }, headers=headers, timeout=15)

            if response.status_code == 200 and len(response.content) > 1000: # Basic check if it's a real PDF
                return StreamingResponse(
                    io.BytesIO(response.content),
                    media_type="application/pdf",
                    headers={"Content-Disposition": "attachment; filename=optimized_resume.pdf"}
                )
            last_error = f"Service {url} returned {response.status_code}"
        except Exception as e:
            last_error = str(e)
            continue # Try next service

    raise HTTPException(status_code=503, detail=f"All LaTeX compilation services failed or timed out. Last error: {last_error}. Please use the '.tex' download and paste into Overleaf.")

@app.get("/health")
def health_check():
    return {"status": "ok"}

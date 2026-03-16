# AI Resume Optimizer (SaaS)

Build a single-page AI-powered Resume Optimizer web app using React and FastAPI. 
This application takes two PDFs (a "Gen AI Resume" and a "Backend Developer Resume", for instance) alongside a Job Description. It uses the Anthropic/Gemini models to generate ATS-friendly LaTeX optimize resumes tailored to exactly what the hiring manager is looking for.

## Features
- **Frontend**: React (Vite) + Tailwind CSS + Lucide React
- **Backend**: FastAPI + LangChain + Google Gemini API (gemini-2.0-flash)
- **Infrastructure**: Fully Dockerized `docker-compose.yml` for zero-configuration testing.
- **ATS Friendly**: Extracts PDF contexts reliably and outputs clean LaTeX codes, keyword matching scores, removed/added keywords, missing skill tips, and project recommendations.

## Running Locally Without Docker
1. Start the React Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Start the Backend API (Must provide `.env` inside `/backend` with `GEMINI_API_KEY`):
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # or .\venv\Scripts\activate on Windows
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8002 --reload
   ```

## Running with Docker
```bash
docker-compose up --build
```
Navigate to `http://localhost:80` for the UI.

## Deployment Guide

### Backend: Render
1. **GitHub Connection**: Connect your repository to Render.
2. **Web Service Setup**:
   - **Runtime**: `Python-3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables**:
   - `GROQ_API_KEY`: Your Groq API key.
4. **Persistence (Optional)**:
   - Add a "Disk" mount at `/data` if you want persistent history. In `main.py`, change `DB_PATH` to `/data/resume_history.db`.

### Frontend: Vercel
1. **GitHub Connection**: Connect your repository to Vercel.
2. **Project Settings**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite` (automatically detected)
3. **Environment Variables**:
   - `VITE_API_BASE_URL`: The URL of your Render backend (e.g., `https://resume-backend.onrender.com`).
4. **Build & Deploy**: Click Deploy!

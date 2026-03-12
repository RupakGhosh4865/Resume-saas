import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="d:/ResumeOptimiser/backend/.env")
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

try:
    models = list(genai.list_models())
    for m in models:
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print(e)

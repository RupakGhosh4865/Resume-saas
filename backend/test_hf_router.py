import requests
import os
from dotenv import load_dotenv

load_dotenv("d:/ResumeOptimiser/backend/.env")

hf_token = os.environ.get("HUGGINGFACEHUB_API_TOKEN")

headers = {
    "Authorization": f"Bearer {hf_token}",
    "Content-Type": "application/json"
}

payload = {
    "model": "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "messages": [
        {"role": "user", "content": "hello"}
    ],
    "max_tokens": 10
}

urls_to_test = [
    "https://router.huggingface.co/hf-inference/v1/chat/completions",
    "https://router.huggingface.co/v1/chat/completions"
]

for url in urls_to_test:
    print(f"Testing {url}")
    res = requests.post(url, headers=headers, json=payload)
    print(res.status_code, res.text)

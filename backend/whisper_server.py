import os
import sys
import tempfile
import urllib.request
import re
import imageio_ffmpeg

# Inject FFmpeg binary directory into Windows PATH for WebM audio decoding
try:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = os.path.dirname(ffmpeg_exe)
    os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
except Exception as ffmpeg_err:
    print(f"Warning: Could not configure static FFmpeg: {ffmpeg_err}")

from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from faster_whisper import WhisperModel
from urllib.parse import urlparse
import shutil
import asyncio
import base64

MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
whisper_model = None
transcribe_semaphore = asyncio.Semaphore(2)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://prjrksfleynjqgrofmeb.supabase.co")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))

# Common disfluencies & filler words
HEAVY_FILLERS = {'um', 'uh', 'er', 'ah', 'mmm'}
LIGHT_FILLERS = {'like', 'you know', 'i mean', 'basically', 'actually', 'literally', 'sort of', 'kind of', 'so yeah'}

# Grammar regex rules
GRAMMAR_ERRORS = [
    re.compile(r'\b(he|she|it)\s+(do|don\'t|have|go|were|are)\b', re.IGNORECASE),
    re.compile(r'\b(they|we|you|i)\s+(is|wasn\'t|does|has)\b', re.IGNORECASE),
    re.compile(r'\b(didn\'t|don\'t|doesn\'t)\s+(saw|went|came|ate|took|done|had)\b', re.IGNORECASE),
    re.compile(r'\b(could|should|would)\s+of\b', re.IGNORECASE),
    re.compile(r'\b(don\'t|doesn\'t|didn\'t|no|never)\s+have\s+no\b', re.IGNORECASE),
]

def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        print(f"Loading local Whisper model '{MODEL_NAME}' on CPU (int8)...", flush=True)
        whisper_model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
        print("OK: Local Whisper model ready!", flush=True)
    return whisper_model

def calculate_text_similarity(candidate_text: str, expected_text: str) -> int:
    if not candidate_text or not expected_text:
        return 0
    clean_c = re.sub(r'[^a-z0-9\s]', '', candidate_text.lower()).strip()
    clean_e = re.sub(r'[^a-z0-9\s]', '', expected_text.lower()).strip()
    
    if clean_c == clean_e:
        return 100
    
    words_c = clean_c.split()
    words_e = clean_e.split()
    
    if not words_e:
        return 0
        
    matches = 0
    e_visited = [False] * len(words_e)
    for c in words_c:
        for idx, e in enumerate(words_e):
            if not e_visited[idx] and e == c:
                matches += 1
                e_visited[idx] = True
                break
                
    precision = (matches / max(len(words_c), 1)) * 100
    recall = (matches / max(len(words_e), 1)) * 100
    
    if precision + recall == 0:
        return 0
    return round((2 * precision * recall) / (precision + recall))

def evaluate_transcript(transcript: str, expected_text: Optional[str], duration_sec: float):
    words = re.sub(r'[^a-z0-9\s]', '', transcript.lower()).split()
    word_count = len(words)
    duration_min = max(duration_sec / 60.0, 0.05)
    wpm = round(word_count / duration_min) if duration_sec > 0 else 0

    # 1. Pronunciation / Word Match Accuracy
    if expected_text:
        pronunciation = calculate_text_similarity(transcript, expected_text)
    else:
        if word_count >= 35:
            pronunciation = 88
        elif word_count >= 20:
            pronunciation = 75
        elif word_count >= 10:
            pronunciation = 60
        elif word_count >= 4:
            pronunciation = 45
        else:
            pronunciation = 20

    # 2. Pace Evaluation
    if wpm >= 125 and wpm <= 165:
        pace_score = 95
    elif wpm >= 105 and wpm < 125:
        pace_score = 82
    elif wpm > 165 and wpm <= 185:
        pace_score = 78
    elif wpm >= 70 and wpm < 105:
        pace_score = 60
    elif wpm > 185:
        pace_score = 55
    else:
        pace_score = 35

    # 3. Filler Word & Disfluency Detection
    heavy_fillers = sum(1 for w in words if w in HEAVY_FILLERS)
    light_fillers = sum(1 for w in words if w in LIGHT_FILLERS)
    stutters = sum(1 for i in range(1, len(words)) if words[i] == words[i-1] and len(words[i]) > 2)

    filler_penalty = (heavy_fillers * 7) + (light_fillers * 4) + (stutters * 6)
    fluency_score = max(15, min(98, pace_score - filler_penalty))

    # 4. Vocabulary Diversity
    unique_words = len(set(words))
    vocab_diversity = (unique_words / max(word_count, 1)) * 100
    vocabulary_score = round(vocab_diversity * 0.7 + (25 if word_count > 15 else 10))
    if word_count < 5:
        vocabulary_score = min(vocabulary_score, 30)
    vocabulary_score = max(20, min(95, vocabulary_score))

    # 5. Grammar Analysis
    grammar_violations = sum(1 for pattern in GRAMMAR_ERRORS if pattern.search(transcript))
    if expected_text:
        grammar_score = round(pronunciation * 0.85 + 10)
    else:
        grammar_score = max(20, 92 - (grammar_violations * 12))
    if word_count < 4:
        grammar_score = min(grammar_score, 25)

    # 6. Overall Strict Weighted Score
    overall = round(
        (pronunciation * 0.30) +
        (fluency_score * 0.25) +
        (grammar_score * 0.25) +
        (vocabulary_score * 0.20)
    )

    feedback_notes = []
    if heavy_fillers + light_fillers > 0:
        feedback_notes.append(f"Spoke {heavy_fillers + light_fillers} filler words ('um', 'like') affecting spoken fluency.")
    if grammar_violations > 0:
        feedback_notes.append(f"Detected {grammar_violations} grammar errors.")
    if pronunciation < 65:
        feedback_notes.append(f"Low pronunciation match ({pronunciation}%) against reference text.")
    if wpm < 100:
        feedback_notes.append(f"Hesitant speaking speed ({wpm} WPM).")

    return {
        "transcript": transcript,
        "wordCount": word_count,
        "durationSeconds": round(duration_sec, 2),
        "wpm": wpm,
        "disfluencies": {
            "heavyFillers": heavy_fillers,
            "lightFillers": light_fillers,
            "stutters": stutters,
            "grammarViolations": grammar_violations
        },
        "scores": {
            "pronunciation": pronunciation,
            "fluency": fluency_score,
            "vocabulary": vocabulary_score,
            "grammar": grammar_score,
            "pace": pace_score,
            "wpm": wpm
        },
        "overallScore": overall,
        "feedbackNotes": feedback_notes
    }

class AnalyzeUrlRequest(BaseModel):
    audioUrl: str
    expectedText: Optional[str] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    get_whisper_model()
    yield

app = FastAPI(
    title="Nova Assessment Local Whisper AI Service",
    description="Strict local speech-to-text transcription & communication scoring backend powered by OpenAI Whisper.",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://openhire.in", "https://assessment.openhire.in", "https://nova.openhire.in", "https://nova.hirewave.in", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root_status():
    return {
        "status": "online",
        "service": "Nova Strict Local Whisper AI Service",
        "model": MODEL_NAME,
        "device": "cpu",
        "endpoints": {
            "health": "/health",
            "interactiveDocs": "/docs",
            "transcribeAudio": "/transcribe-audio",
            "analyzeUrl": "/analyze-url"
        }
    }

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Nova Whisper AI Backend",
        "model": MODEL_NAME,
        "device": "cpu"
    }

@app.post("/transcribe-audio")
async def transcribe_audio(
    file: UploadFile = File(...),
    expectedText: Optional[str] = Form(None)
):
    model = get_whisper_model()
    ext = os.path.splitext(file.filename)[1] or ".webm"

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
        temp_path = temp_file.name
        # Stream file to disk to prevent OOM
        shutil.copyfileobj(file.file, temp_file)

    try:
        async with transcribe_semaphore:
            segments, info = model.transcribe(temp_path, beam_size=1, word_timestamps=True, language="en")
        transcript = " ".join(s.text.strip() for s in segments).strip()
        eval_result = evaluate_transcript(transcript, expectedText, info.duration)
        return eval_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Whisper transcription error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.post("/analyze-url")
async def analyze_url(req: AnalyzeUrlRequest):
    model = get_whisper_model()
    url = req.audioUrl

    # SSRF Protection: Validate URL scheme and domain
    parsed_url = urlparse(url)
    if parsed_url.scheme not in ["http", "https"]:
        raise HTTPException(status_code=400, detail="Invalid URL scheme. Must be http or https.")
    if parsed_url.hostname in ["localhost", "127.0.0.1", "0.0.0.0"] or parsed_url.hostname.startswith("169.254.") or parsed_url.hostname.startswith("10.") or parsed_url.hostname.startswith("192.168."):
        raise HTTPException(status_code=403, detail="Local/Private network URLs are strictly forbidden.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
        temp_path = temp_file.name

    try:
        req_obj = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req_obj, timeout=10) as resp, open(temp_path, "wb") as out_f:
            shutil.copyfileobj(resp, out_f)

        async with transcribe_semaphore:
            segments, info = model.transcribe(temp_path, beam_size=1, word_timestamps=True, language="en")
        transcript = " ".join(s.text.strip() for s in segments).strip()
        eval_result = evaluate_transcript(transcript, req.expectedText, info.duration)
        return eval_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio fetch/transcribe error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.post("/upload-audio")
async def upload_audio_proxy(req: Request):
    """Proxy endpoint to upload audio to Supabase to keep Secret Key hidden from frontend."""
    data = await req.json()
    base64_audio = data.get("base64Audio")
    object_path = data.get("objectPath")
    mime_type = data.get("mimeType", "audio/webm")

    if not base64_audio or not object_path:
        raise HTTPException(status_code=400, detail="Missing base64Audio or objectPath")

    try:
        audio_bytes = base64.b64decode(base64_audio)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid base64 string")

    supabase_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/assessment-audio/{object_path}"
    req_obj = urllib.request.Request(
        supabase_url,
        data=audio_bytes,
        headers={
            "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
            "apikey": SUPABASE_SECRET_KEY,
            "Content-Type": mime_type,
            "x-upsert": "true"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req_obj, timeout=15) as resp:
            if resp.status in [200, 201]:
                public_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/assessment-audio/{object_path}"
                return {"success": True, "publicUrl": public_url}
            else:
                raise HTTPException(status_code=500, detail="Supabase upload failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload proxy error: {str(e)}")

BACKUP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "backup_submissions")
os.makedirs(BACKUP_DIR, exist_ok=True)

@app.post("/backup-submission")
async def save_backup_submission(req: Request):
    """Fallback endpoint: saves candidate submission to local server storage if primary DB fails."""
    import json
    try:
        payload = await req.json()
        submission = payload.get("data") or payload
        sub_id = submission.get("id") or f"SUB-{int(asyncio.get_event_loop().time() * 1000)}"
        email = submission.get("candidate", {}).get("email") or payload.get("email") or "unknown"
        
        filename = f"{re.sub(r'[^a-zA-Z0-9_-]', '_', str(sub_id))}.json"
        filepath = os.path.join(BACKUP_DIR, filename)

        record = {
            "id": sub_id,
            "email": email,
            "saved_at": asyncio.get_event_loop().time(),
            "source": "backup_server",
            "data": submission
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2)

        print(f"✅ Saved candidate backup submission to server disk: {filepath}", flush=True)
        return {"success": True, "id": sub_id, "source": "backup_server"}
    except Exception as e:
        print(f"❌ Backup submission save failed: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Server backup save error: {str(e)}")

@app.get("/backup-submissions")
async def get_backup_submissions():
    """Returns all candidate submissions stored in fallback server disk storage."""
    import json
    results = []
    if not os.path.exists(BACKUP_DIR):
        return results

    for fname in os.listdir(BACKUP_DIR):
        if fname.endswith(".json"):
            fpath = os.path.join(BACKUP_DIR, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    sub = data.get("data") or data
                    sub["_source"] = "backup_server"
                    results.append(sub)
            except Exception:
                pass

    return results


if __name__ == "__main__":
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"[*] Starting Nova Local Whisper Backend on http://localhost:{port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)

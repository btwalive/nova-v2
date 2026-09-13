import os
import sys
import json
import urllib.request
import tempfile
import re
import imageio_ffmpeg

# Dynamically add imageio_ffmpeg binary folder to Windows PATH so Whisper can decode .webm audio files
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
ffmpeg_dir = os.path.dirname(ffmpeg_exe)
os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")

from faster_whisper import WhisperModel

SUPABASE_URL = "https://prjrksfleynjqgrofmeb.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByanJrc2ZsZXluanFncm9mbWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MjI3NTMsImV4cCI6MjEwMDQ5ODc1M30.zjp4pH_Y9HCrZ4F0NmZ5xBGARVMLDXTQr7ZFJSiTAHM"
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_SECRET_KEY", ""))

HEAVY_FILLERS = {'um', 'uh', 'er', 'ah', 'mmm'}
LIGHT_FILLERS = {'like', 'you know', 'i mean', 'basically', 'actually', 'literally', 'sort of', 'kind of', 'so yeah'}

GRAMMAR_ERRORS = [
    re.compile(r'\b(he|she|it)\s+(do|don\'t|have|were|are)\b', re.IGNORECASE),
    re.compile(r'\b(they|we|you|i)\s+(is|wasn\'t)\b', re.IGNORECASE),
    re.compile(r'\b(they|we|you)\s+(was)\b', re.IGNORECASE),
    re.compile(r'\b(didn\'t|don\'t|doesn\'t)\s+(saw|went|came|ate|took|done|had)\b', re.IGNORECASE),
    re.compile(r'\b(is|are|was|were|am)\s+(go|come|take|make|do|say|give)\b', re.IGNORECASE),
    re.compile(r'\b(will|shall|can|could|should|would|may|might|must)\s+(went|came|saw|done|taken)\b', re.IGNORECASE),
    re.compile(r'\b(return|revert)\s+back\b', re.IGNORECASE),
    re.compile(r'\b(repeat)\s+again\b', re.IGNORECASE),
    re.compile(r'\b(discuss)\s+about\b', re.IGNORECASE),
    re.compile(r'\b(could|should|would)\s+of\b', re.IGNORECASE),
    re.compile(r'\b(don\'t|doesn\'t|didn\'t|no)\s+have\s+no\b', re.IGNORECASE),
]

def get_cefr_mapping(score):
    if score >= 80: return {"ieltsBand": "Band 8.0 - 9.0", "cefrLevel": "C2", "levelTitle": "Mastery / Native-like", "recommendation": "Strong Hire (Tier 1)"}
    if score >= 68: return {"ieltsBand": "Band 7.0 - 7.5", "cefrLevel": "C1", "levelTitle": "Advanced / Fluent", "recommendation": "Hire (Customer Facing)"}
    if score >= 52: return {"ieltsBand": "Band 6.0 - 6.5", "cefrLevel": "B2", "levelTitle": "Upper-Intermediate", "recommendation": "Hire (General Communication)"}
    if score >= 38: return {"ieltsBand": "Band 4.5 - 5.5", "cefrLevel": "B1 / A2", "levelTitle": "Intermediate / Weak Communication", "recommendation": "Do Not Hire"}
    if score >= 20: return {"ieltsBand": "Band 3.0 - 4.0", "cefrLevel": "A2", "levelTitle": "Elementary / Poor Communication", "recommendation": "Do Not Hire"}
    return {"ieltsBand": "Band 1.0 - 2.5", "cefrLevel": "A1", "levelTitle": "Beginner / Unintelligible", "recommendation": "Do Not Hire"}

def headers(key=SUPABASE_SECRET_KEY):
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def is_primary_target_audio(q_id, sec_id, title, index):
    if index == 0 or index == 1: return True
    q_id_l = str(q_id).lower()
    sec_id_l = str(sec_id).lower()
    title_l = str(title).lower()
    if q_id_l.startswith('q_intro') or 'intro' in sec_id_l or 'introductory' in title_l or 'work experience' in title_l: return True
    if q_id_l.startswith('q_ext') or 'extempore' in sec_id_l or 'extempore' in title_l or 'topic' in title_l: return True
    return False

def is_scripted_task(q_id, sec_id, title, expected_text):
    q_id_l = str(q_id).lower()
    sec_id_l = str(sec_id).lower()
    title_l = str(title).lower()
    if 'read' in sec_id_l or 'listen_repeat' in sec_id_l or q_id_l.startswith('q_read') or q_id_l.startswith('q_lr') or 'reading' in title_l or 'listen & repeat' in title_l: return True
    return False

def calculate_text_similarity(candidate_text: str, expected_text: str) -> int:
    if not candidate_text or not expected_text: return 0
    clean_c = re.sub(r'[^a-z0-9\s]', '', candidate_text.lower()).strip()
    clean_e = re.sub(r'[^a-z0-9\s]', '', expected_text.lower()).strip()
    if clean_c == clean_e: return 100
    words_c = clean_c.split()
    words_e = clean_e.split()
    if not words_e: return 0
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
    if precision + recall == 0: return 0
    return round((2 * precision * recall) / (precision + recall))

def calculate_wpm(word_count: int, duration_seconds: float) -> int:
    if not duration_seconds or duration_seconds <= 0 or not word_count: return 0
    return round(word_count / (duration_seconds / 60))

def main():
    print("=" * 60)
    print("NOVA ASSESSMENT - STRICT UN-PADED RE-ANALYSIS TOOL")
    print(f"Using FFmpeg path: {ffmpeg_exe}")
    print("Targeting 1st/2nd Intro + Topic Audios — Weak speakers strictly rated A1/A2")
    print("=" * 60)

    print("\n[1/3] Loading local Whisper AI model 'base' on CPU (int8)...")
    try:
        model = WhisperModel("base", device="cpu", compute_type="int8")
        print("OK: Model loaded successfully!")
    except Exception as e:
        print(f"ERROR: Failed to load Whisper model: {e}")
        sys.exit(1)

    print("\n[2/3] Fetching past candidate submissions from Supabase...")
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/submissions?select=*", headers=headers())
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"OK: Found {len(data)} candidate submission records in database.")
    except Exception as e:
        print(f"ERROR: Failed to fetch submissions: {e}")
        sys.exit(1)

    print("\n[3/3] Processing audio files with strict un-padded IELTS evaluation...")
    updated_count = 0

    for idx, sub in enumerate(data, start=1):
        sub_id = sub.get('id')
        sub_data = sub.get('data', {})
        candidate = sub_data.get('candidate', {})
        cand_name = candidate.get('fullName', 'Candidate')
        cand_email = candidate.get('email', 'N/A')
        raw_responses = sub_data.get('rawResponses', [])

        if not raw_responses:
            print(f"\n[{idx}/{len(data)}] Skipping {cand_name} ({cand_email}) — No recorded audio files available.")
            continue

        print(f"\n[{idx}/{len(data)}] Processing {cand_name} ({cand_email}) — Found {len(raw_responses)} audio clips...")

        evaluated_questions = []
        primary_audios = []

        for r_idx, resp in enumerate(raw_responses):
            q_id = resp.get('questionId', f'q_{r_idx+1}')
            sec_id = resp.get('sectionId', '')
            sec_title = resp.get('sectionTitle', f'Question {r_idx+1}')
            expected_text = resp.get('expectedText', '')
            audio_url = resp.get('audioUrl', '')

            transcript = ""
            duration = resp.get('durationSeconds', 10)

            if audio_url and not audio_url.startswith('blob:'):
                try:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
                        audio_req = urllib.request.Request(audio_url)
                        with urllib.request.urlopen(audio_req) as a_resp:
                            tmp.write(a_resp.read())
                        tmp_path = tmp.name

                    segments, info = model.transcribe(tmp_path, beam_size=1)
                    transcript = " ".join([seg.text.strip() for seg in segments]).strip()
                    duration = info.duration if info.duration > 0 else duration
                    os.remove(tmp_path)
                    print(f"   [AUDIO OK] Transcribed {q_id}: '{transcript[:60]}...'")
                except Exception as err:
                    print(f"   [AUDIO ERR] Transcribe error on {q_id}: {err}")
                    transcript = resp.get('transcript', '')
            else:
                transcript = resp.get('transcript', '')

            transcript_clean = transcript.strip()
            words = [w.lower() for w in re.findall(r'\b\w+\b', transcript_clean)]
            word_count = len(words)
            wpm = calculate_wpm(word_count, duration)

            is_primary = is_primary_target_audio(q_id, sec_id, sec_title, r_idx)
            is_scripted = is_scripted_task(q_id, sec_id, sec_title, expected_text)

            heavy_fillers = sum(1 for w in words if w in HEAVY_FILLERS)
            light_fillers = sum(1 for w in words if w in LIGHT_FILLERS)
            stutters = sum(1 for i in range(1, len(words)) if words[i] == words[i-1] and len(words[i]) >= 1)
            grammar_errors = sum(1 for p in GRAMMAR_ERRORS if p.search(transcript_clean))

            if is_scripted:
                accuracy = calculate_text_similarity(transcript_clean, expected_text) if expected_text else (30 if word_count >= 4 else 0)
                eval_q = {
                    "questionId": q_id,
                    "sectionTitle": sec_title,
                    "transcript": transcript_clean,
                    "audioUrl": audio_url,
                    "audio": audio_url,
                    "isPrimaryTargetAudio": False,
                    "countsTowardCommunication": False,
                    "wpm": wpm,
                    "wordCount": word_count,
                    "scores": {"pronunciation": accuracy, "accuracy": accuracy, "wpm": wpm}
                }
            else:
                # UN-PADED STRICT EVALUATION
                if word_count >= 75: pron = 80
                elif word_count >= 50: pron = 65
                elif word_count >= 30: pron = 48
                elif word_count >= 15: pron = 32
                elif word_count >= 5: pron = 20
                else: pron = 10

                fluency = 35
                if word_count >= 50: fluency += 30
                elif word_count >= 25: fluency += 15
                elif word_count < 15: fluency -= 10
                disfluency_penalty = (heavy_fillers * 15) + (light_fillers * 8) + (stutters * 18)
                fluency = max(10, min(90, fluency - disfluency_penalty))

                unique = len(set(words))
                vocab_div = (unique / max(word_count, 1)) * 100
                if word_count >= 40: vocab = round(vocab_div * 0.4 + 30)
                elif word_count >= 20: vocab = round(vocab_div * 0.3 + 20)
                else: vocab = 20
                vocab = max(10, min(88, vocab))

                grammar = 35
                if word_count >= 45 and grammar_errors == 0: grammar = 75
                elif word_count >= 25 and grammar_errors == 0: grammar = 55
                elif word_count < 15: grammar = 25
                grammar = max(10, min(92, grammar - (grammar_errors * 20)))

                if not transcript_clean or word_count == 0:
                    pron = fluency = vocab = grammar = 10

                eval_q = {
                    "questionId": q_id,
                    "sectionTitle": sec_title,
                    "transcript": transcript_clean,
                    "audioUrl": audio_url,
                    "audio": audio_url,
                    "isPrimaryTargetAudio": is_primary,
                    "countsTowardCommunication": True,
                    "wpm": wpm,
                    "wordCount": word_count,
                    "scores": {"pronunciation": pron, "fluency": fluency, "vocabulary": vocab, "grammar": grammar, "wpm": wpm}
                }
                if is_primary:
                    primary_audios.append(eval_q)

            evaluated_questions.append(eval_q)

        comms_source = primary_audios if len(primary_audios) > 0 else [q for q in evaluated_questions if q["countsTowardCommunication"]]
        if not comms_source:
            comms_source = evaluated_questions

        avg_p = round(sum(q["scores"].get("pronunciation", 0) for q in comms_source) / len(comms_source))
        avg_f = round(sum(q["scores"].get("fluency", 0) for q in comms_source) / len(comms_source))
        avg_v = round(sum(q["scores"].get("vocabulary", 0) for q in comms_source) / len(comms_source))
        avg_g = round(sum(q["scores"].get("grammar", 0) for q in comms_source) / len(comms_source))
        avg_wpm = round(sum(q.get("wpm", 0) for q in comms_source) / len(comms_source))

        comm_score = round((avg_p * 0.25) + (avg_f * 0.25) + (avg_g * 0.25) + (avg_v * 0.25))

        valid_primary_spoken = [q for q in comms_source if q.get("wordCount", 0) >= 10]
        expected_primary_count = 3
        is_incomplete = False

        overall_score = comm_score
        if len(valid_primary_spoken) < expected_primary_count:
            is_incomplete = True
            ratio = len(valid_primary_spoken) / expected_primary_count
            overall_score = round(overall_score * ratio)

        mapping = get_cefr_mapping(overall_score)

        updated_evaluation = {
            "overallScore": overall_score,
            "whisperVerified": True,
            "ieltsBand": mapping["ieltsBand"],
            "cefrLevel": mapping["cefrLevel"],
            "levelTitle": mapping["levelTitle"],
            "recommendation": "Do Not Hire (Incomplete Primary Audios)" if is_incomplete else mapping["recommendation"],
            "isIncomplete": is_incomplete,
            "scores": {
                "pronunciation": avg_p,
                "fluency": avg_f,
                "vocabulary": avg_v,
                "grammar": avg_g,
                "pace": avg_f,
                "wpm": avg_wpm
            },
            "evaluatedQuestions": evaluated_questions
        }

        sub_data['evaluation'] = updated_evaluation
        sub_data['overallScore'] = overall_score
        sub_data['rawResponses'] = evaluated_questions

        patch_payload = json.dumps({"data": sub_data}).encode('utf-8')
        patch_req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/submissions?id=eq.{sub_id}",
            data=patch_payload,
            headers=headers(),
            method="PATCH"
        )
        try:
            with urllib.request.urlopen(patch_req) as patch_resp:
                print(f"   OK: Successfully updated {cand_name}'s scorecard in Supabase! (New Strict Score: {overall_score}/100 — {mapping['cefrLevel']} {mapping['levelTitle']})")
                updated_count += 1
        except Exception as patch_err:
            print(f"   ERROR updating {cand_name}: {patch_err}")

    print("\n" + "=" * 60)
    print(f"OK: Batch re-analysis completed! Updated {updated_count} candidate records.")
    print("=" * 60)

if __name__ == "__main__":
    main()

"""Contextual AI tutoring for Arabic study."""
from __future__ import annotations

import json
import os
import time
import urllib.request
import subprocess
from threading import Lock, RLock
from dataclasses import dataclass
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent / ".env"
if ENV_FILE.is_file():
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"\''))


MODES = {"language", "nahwu", "shorof", "munasabah"}
MAX_TEXT = 6000
OLLAMA_DEFAULT_TIMEOUT = 120
OLLAMA_DEFAULT_STARTUP_TIMEOUT = 20


class AIUnavailable(RuntimeError):
    pass


class AIRateLimited(RuntimeError):
    pass


@dataclass
class AIService:
    model: str | None = None
    client: object | None = None

    def __post_init__(self):
        self.enabled = True
        self._state_lock = RLock()
        self._ollama_lock = Lock()
        self._ollama_process = None
        self.provider = os.environ.get("AI_PROVIDER", "gemini" if os.environ.get("GEMINI_API_KEY") else "openai")
        if self.provider == "gemini":
            self.model = self.model or os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
            return
        if self.provider == "ollama":
            self.model = self.model or os.environ.get("OLLAMA_MODEL", "qwen3:8b")
            return
        self.model = self.model or os.environ.get("OPENAI_MODEL", "gpt-5-mini")
        if self.client is None and os.environ.get("OPENAI_API_KEY"):
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
            except ImportError as exc:
                raise AIUnavailable("SDK OpenAI belum terpasang") from exc

    def analyze(self, *, mode: str, text: str, word: str = "", context_before: str = "", context_after: str = "", source: dict) -> dict:
        with self._state_lock:
            if not self.enabled:
                raise AIUnavailable("Asisten AI sedang dinonaktifkan")
        if mode not in MODES:
            raise ValueError("Mode analisis tidak valid")
        text = text.strip()
        if not text:
            raise ValueError("Teks analisis tidak boleh kosong")
        if len(text) > MAX_TEXT or len(context_before) > MAX_TEXT or len(context_after) > MAX_TEXT:
            raise ValueError(f"Konteks terlalu panjang (maksimal {MAX_TEXT} karakter)")
        instruction = {
            "language": "Terjemahkan dan jelaskan kosakata atau kalimat Arab secara ringkas.",
            "nahwu": "Analisis nahwu/i'rab secara bertahap dan jelaskan fungsi kata dalam kalimat.",
            "shorof": "Analisis akar kata, wazan, bentuk, perubahan morfologi, dan maknanya.",
            "munasabah": "Jelaskan hubungan tema teks dengan bab atau konteks kitab yang diberikan; bedakan fakta dan interpretasi.",
        }[mode]
        user_payload = json.dumps({"mode": mode, "task": instruction, "text": text, "word": word, "context_before": context_before, "context_after": context_after, "source": source}, ensure_ascii=False)
        system = ("Anda adalah tutor bahasa Arab untuk pembaca kitab. Jawab dalam Bahasa Indonesia. "
                  "Pertahankan contoh Arab apa adanya. Jangan mengarang rujukan. Nyatakan ketidakpastian. "
                  "Gunakan seluruh teks konteks untuk analisis, bukan hanya mengulang kata target. "
                  "Untuk nahwu, wajib jelaskan posisi i'rab/fungsi kata target dalam kalimat dan alasan gramatikalnya. "
                  "Khusus teks tanpa harakat, bedakan kemungkinan إنَّ (taukid dan nashab), إنْ (syarat), "
                  "atau bentuk lain; sebutkan bacaan yang paling mungkin dan jangan menyatakan satu i'rab sebagai pasti "
                  "jika harakat atau konteks belum cukup. Jangan menyebut partikel tidak bermakna bila ia memengaruhi i'rab kata sesudahnya. "
                  "Untuk shorof, wajib jelaskan akar, wazan, jenis kata, dan perubahan bentuk bila dapat ditentukan. "
                  "Jika konteks tidak cukup, katakan secara eksplisit bagian apa yang belum dapat dipastikan. "
                  "Buat jawaban ringkas: answer maksimal 80 kata dan sections maksimal 3 bagian, "
                  "masing-masing content maksimal 35 kata. Jangan mengulang prompt. "
                  "Kembalikan JSON valid dengan keys answer (string) dan sections (array objek title/content), dan jangan biarkan answer kosong.")
        if self.provider == "ollama":
            return self._ollama(system, user_payload, mode, source)
        if self.provider == "gemini":
            return self._gemini(system, user_payload, mode, source)
        if self.client is None:
            raise AIUnavailable("OPENAI_API_KEY belum dikonfigurasi")
        try:
            response = self.client.responses.create(model=self.model, store=False, input=[
                {"role": "system", "content": [{"type": "input_text", "text": system}]},
                {"role": "user", "content": [{"type": "input_text", "text": user_payload}]},
            ])
            raw = response.output_text
            parsed = json.loads(raw)
        except Exception as exc:
            name = exc.__class__.__name__.lower()
            if "ratelimit" in name:
                raise AIRateLimited("Batas penggunaan AI tercapai") from exc
            raise AIUnavailable("Layanan AI tidak tersedia") from exc
        return {"mode": mode, "answer": str(parsed.get("answer", "")), "sections": parsed.get("sections", []), "source": source,
                "disclaimer": "Analisis AI adalah bantuan belajar; verifikasi kembali dengan syarah atau guru."}

    def status(self) -> dict:
        with self._state_lock:
            return {"enabled": self.enabled, "provider": self.provider, "model": self.model}

    def set_enabled(self, enabled: bool) -> dict:
        with self._state_lock:
            self.enabled = enabled
            return self.status()

    def set_provider(self, provider: str) -> dict:
        if provider not in {"gemini", "ollama"}:
            raise ValueError("Provider AI tidak valid")
        with self._state_lock:
            if provider == "ollama":
                target_model = self._current_env("OLLAMA_MODEL") or "qwen3:8b"
                self._ensure_ollama(target_model)
                self.provider = "ollama"
                self.model = target_model
            else:
                self.provider = "gemini"
                self.model = self._current_env("GEMINI_MODEL") or "gemini-3.5-flash-lite"
            return self.status()

    @staticmethod
    def _gemini_setting(name: str, default: int, minimum: int, maximum: int) -> int:
        try:
            return max(minimum, min(maximum, int(os.environ.get(name, str(default)))))
        except ValueError:
            return default

    def _gemini(self, system: str, user_payload: str, mode: str, source: dict) -> dict:
        key = self._current_env("GEMINI_API_KEY")
        if not key:
            raise AIUnavailable("GEMINI_API_KEY belum diisi. Isi .env lalu mulai ulang aplikasi.")
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        body = {"system_instruction": {"parts": [{"text": system}]}, "contents": [{"role": "user", "parts": [{"text": user_payload}]}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1, "maxOutputTokens": self._gemini_setting("GEMINI_MAX_OUTPUT_TOKENS", 500, 128, 8192)}}
        request = urllib.request.Request(endpoint, data=json.dumps(body, ensure_ascii=False).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
        try:
            with urllib.request.urlopen(request, timeout=self._gemini_setting("GEMINI_TIMEOUT", 45, 5, 90)) as response:
                payload = json.loads(response.read().decode())
            content = payload["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(content)
        except Exception as exc:
            if "429" in str(exc): raise AIRateLimited("Batas penggunaan Gemini tercapai") from exc
            raise AIUnavailable("Gemini AI tidak tersedia atau gagal memproses permintaan") from exc
        return {"mode": mode, "answer": str(parsed.get("answer", "")), "sections": parsed.get("sections", []), "source": source,
                "disclaimer": "Analisis Gemini adalah bantuan belajar; verifikasi kembali dengan syarah atau guru."}

    @staticmethod
    def _current_env(name: str) -> str:
        """Read a newly edited .env value without exposing it to the frontend."""
        value = os.environ.get(name, "").strip()
        if value:
            return value
        if ENV_FILE.is_file():
            for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
                if line.strip() and not line.lstrip().startswith("#") and "=" in line:
                    key, file_value = line.split("=", 1)
                    if key.strip() == name:
                        return file_value.strip().strip('"\'')
        return ""

    def _ollama(self, system: str, user_payload: str, mode: str, source: dict) -> dict:
        endpoint = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/") + "/api/chat"
        response_schema = {
            "type": "object",
            "required": ["answer", "sections"],
            "properties": {
                "answer": {"type": "string"},
                "sections": {"type": "array", "items": {"type": "object", "required": ["title", "content"], "properties": {
                    "title": {"type": "string"}, "content": {"type": "string"}
                }}}
            }
        }
        payload = {
            "model": self.model,
            "stream": False,
            # Qwen3's reasoning mode adds substantial CPU latency. The tutor
            # needs a concise structured answer, so use its direct-answer mode.
            "think": False,
            "format": response_schema,
            "keep_alive": os.environ.get("OLLAMA_KEEP_ALIVE", "10m"),
            "options": {
                # The reader sends a short word window. A small context avoids
                # allocating the model's 16K context for every local request.
                "num_ctx": int(os.environ.get("OLLAMA_NUM_CTX", "2048")),
                "num_predict": int(os.environ.get("OLLAMA_NUM_PREDICT", "220")),
                "temperature": float(os.environ.get("OLLAMA_TEMPERATURE", "0.1")),
                "top_p": 0.9,
            },
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user_payload}],
        }
        with self._ollama_lock:
            self._ensure_ollama()
            request = urllib.request.Request(endpoint, data=json.dumps(payload, ensure_ascii=False).encode(), headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(request, timeout=self._ollama_timeout()) as response:
                    content = json.loads(response.read().decode())["message"]["content"]
                parsed = self._parse_ollama_json(content)
            except AIUnavailable:
                raise
            except Exception as exc:
                raise AIUnavailable("Model Ollama tidak tersedia atau gagal memproses permintaan") from exc
        if not str(parsed.get("answer", "")).strip():
            raise AIUnavailable("Ollama mengembalikan jawaban kosong")
        return {"mode": mode, "answer": str(parsed.get("answer", "")), "sections": parsed.get("sections", []), "source": source,
                "disclaimer": "Analisis AI lokal adalah bantuan belajar; verifikasi kembali dengan syarah atau guru."}

    def _ollama_timeout(self) -> float:
        try:
            return max(10.0, float(os.environ.get("OLLAMA_TIMEOUT", str(OLLAMA_DEFAULT_TIMEOUT))))
        except ValueError:
            return OLLAMA_DEFAULT_TIMEOUT

    def _ensure_ollama(self, model: str | None = None) -> None:
        """Ensure Ollama is reachable and the configured model is installed."""
        host = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
        target_model = model or self.model

        def tags():
            with urllib.request.urlopen(host + "/api/tags", timeout=1.5) as response:
                return json.loads(response.read().decode()).get("models", [])

        try:
            models = tags()
        except Exception:
            if self._ollama_process is None or self._ollama_process.poll() is not None:
                try:
                    self._ollama_process = subprocess.Popen(
                        ["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True
                    )
                except OSError as exc:
                    raise AIUnavailable("Ollama belum terpasang atau tidak dapat dijalankan") from exc
            deadline = time.monotonic() + max(3.0, float(os.environ.get("OLLAMA_STARTUP_TIMEOUT", OLLAMA_DEFAULT_STARTUP_TIMEOUT)))
            models = []
            while time.monotonic() < deadline:
                try:
                    models = tags()
                    break
                except Exception:
                    time.sleep(0.25)
            else:
                raise AIUnavailable("Ollama belum siap. Pastikan layanan Ollama berjalan lalu coba lagi")

        installed = {item.get("name") for item in models}
        if target_model not in installed:
            raise AIUnavailable(f"Model Ollama '{target_model}' belum terpasang. Jalankan: ollama pull {target_model}")

    @staticmethod
    def _parse_ollama_json(content: str) -> dict:
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            start, end = content.find("{"), content.rfind("}")
            if start < 0 or end <= start:
                raise AIUnavailable("Ollama mengembalikan format jawaban yang tidak valid")
            try:
                parsed = json.loads(content[start:end + 1])
            except json.JSONDecodeError as exc:
                raise AIUnavailable("Ollama mengembalikan format jawaban yang tidak valid") from exc
        if not isinstance(parsed, dict):
            raise AIUnavailable("Ollama mengembalikan format jawaban yang tidak valid")
        return parsed

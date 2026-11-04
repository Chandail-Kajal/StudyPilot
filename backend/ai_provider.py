"""
StudyPilot AI - Centralized AI Provider and Agent Architecture
Supports:
1. Google Gemini API (Primary free-tier eligible: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro)
2. Groq API (Secondary free developer tier: llama-3.3-70b-versatile, llama-3.1-8b-instant)
3. Ollama (Local offline AI provider: llama3, mistral, gemma2)
4. Heuristic Fallback (High-yield deterministic educational knowledge engine)
"""

import os
import json
import re
import time
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Callable
import httpx

logger = logging.getLogger("studypilot.ai_provider")
logging.basicConfig(level=logging.INFO)

# =============================================================================
# Helper JSON Extraction
# =============================================================================

def extract_clean_json(text: str) -> Optional[Dict[str, Any]]:
    """Robustly extracts JSON from an LLM response even if wrapped in markdown or conversational text."""
    if not text or not text.strip():
        return None
    cleaned = text.strip()
    # Strip markdown codeblocks
    if "```" in cleaned:
        code_block = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if code_block:
            cleaned = code_block.group(1).strip()

    # Try direct parse
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Find outermost { ... } or [ ... ]
    first_curly = cleaned.find("{")
    last_curly = cleaned.rfind("}")
    if first_curly != -1 and last_curly != -1 and last_curly > first_curly:
        try:
            return json.loads(cleaned[first_curly:last_curly + 1])
        except Exception:
            pass

    first_square = cleaned.find("[")
    last_square = cleaned.rfind("]")
    if first_square != -1 and last_square != -1 and last_square > first_square:
        try:
            parsed = json.loads(cleaned[first_square:last_square + 1])
            return {"items": parsed}
        except Exception:
            pass

    return None


# =============================================================================
# Base AI Provider Interface
# =============================================================================

class BaseAIProvider(ABC):
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    async def is_available(self, api_key: Optional[str] = None) -> bool:
        """Checks if provider has credentials or endpoint available."""
        pass

    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        system_instruction: str = "",
        json_mode: bool = False,
        temperature: float = 0.4,
        api_key: Optional[str] = None
    ) -> str:
        """Generates text from the AI provider."""
        pass


# =============================================================================
# 1. Google Gemini Provider (Primary)
# =============================================================================

class GeminiProvider(BaseAIProvider):
    MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]

    def __init__(self):
        super().__init__("Gemini")

    def _get_key(self, api_key: Optional[str] = None) -> Optional[str]:
        if api_key and api_key.strip():
            return api_key.strip()
        return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    async def is_available(self, api_key: Optional[str] = None) -> bool:
        key = self._get_key(api_key)
        return bool(key and len(key) > 8 and not key.startswith("sk-"))

    async def generate_text(
        self,
        prompt: str,
        system_instruction: str = "",
        json_mode: bool = False,
        temperature: float = 0.4,
        api_key: Optional[str] = None
    ) -> str:
        key = self._get_key(api_key)
        if not key:
            raise ValueError("Gemini API key is not configured")

        headers = {"Content-Type": "application/json"}
        last_error = None

        for model in self.MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            body: Dict[str, Any] = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": temperature,
                    "topP": 0.95,
                    "maxOutputTokens": 8192,
                }
            }
            if json_mode:
                body["generationConfig"]["responseMimeType"] = "application/json"
            if system_instruction:
                body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    res = await client.post(url, headers=headers, json=body)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts:
                                return parts[0].get("text", "")
                    elif res.status_code in [429, 403, 503]:
                        logger.warning(f"Gemini {model} rate limited or unavailable (HTTP {res.status_code}). Trying next...")
                        last_error = f"HTTP {res.status_code}: {res.text[:200]}"
                        continue
                    else:
                        last_error = f"HTTP {res.status_code}: {res.text[:200]}"
                        continue
            except Exception as e:
                last_error = str(e)
                continue

        raise RuntimeError(f"All Gemini models exhausted. Last error: {last_error}")


# =============================================================================
# 2. Groq Provider (Secondary Free Developer Tier)
# =============================================================================

class GroqProvider(BaseAIProvider):
    MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
    BASE_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self):
        super().__init__("Groq")

    def _get_key(self, api_key: Optional[str] = None) -> Optional[str]:
        if api_key and api_key.startswith("gsk_"):
            return api_key.strip()
        return os.environ.get("GROQ_API_KEY")

    async def is_available(self, api_key: Optional[str] = None) -> bool:
        key = self._get_key(api_key)
        return bool(key and key.strip())

    async def generate_text(
        self,
        prompt: str,
        system_instruction: str = "",
        json_mode: bool = False,
        temperature: float = 0.4,
        api_key: Optional[str] = None
    ) -> str:
        key = self._get_key(api_key)
        if not key:
            raise ValueError("Groq API key is not configured")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}"
        }

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        last_error = None
        for model in self.MODELS:
            body: Dict[str, Any] = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": 4096,
            }
            if json_mode:
                body["response_format"] = {"type": "json_object"}

            try:
                async with httpx.AsyncClient(timeout=35.0) as client:
                    res = await client.post(self.BASE_URL, headers=headers, json=body)
                    if res.status_code == 200:
                        data = res.json()
                        choices = data.get("choices", [])
                        if choices:
                            return choices[0]["message"]["content"]
                    else:
                        last_error = f"HTTP {res.status_code}: {res.text[:200]}"
                        continue
            except Exception as e:
                last_error = str(e)
                continue

        raise RuntimeError(f"All Groq models failed. Last error: {last_error}")


# =============================================================================
# 3. Ollama Provider (Local Offline AI)
# =============================================================================

class OllamaProvider(BaseAIProvider):
    def __init__(self):
        super().__init__("Ollama")
        self.base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        self.model = os.environ.get("OLLAMA_MODEL", "llama3")

    async def is_available(self, api_key: Optional[str] = None) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    async def generate_text(
        self,
        prompt: str,
        system_instruction: str = "",
        json_mode: bool = False,
        temperature: float = 0.4,
        api_key: Optional[str] = None
    ) -> str:
        url = f"{self.base_url}/api/chat"
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        body: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature}
        }
        if json_mode:
            body["format"] = "json"

        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(url, json=body)
            if res.status_code != 200:
                raise RuntimeError(f"Ollama error: HTTP {res.status_code}")
            data = res.json()
            return data.get("message", {}).get("content", "")


# =============================================================================
# 4. Centralized AI Service Manager (Unified Dispatcher with Fallback)
# =============================================================================

class AIServiceManager:
    """
    Centralized coordinator that implements:
    - Provider priority: Gemini -> Groq -> Ollama -> Heuristic
    - Automated fallback on quota/rate-limit/errors
    - Structured JSON parsing and validation
    - Metrics logging (latency, provider used, tokens)
    """

    def __init__(self):
        self.gemini = GeminiProvider()
        self.groq = GroqProvider()
        self.ollama = OllamaProvider()
        self.request_counts: Dict[str, int] = {
            "gemini": 0, "groq": 0, "ollama": 0, "heuristic": 0, "failures": 0
        }

    async def get_active_providers(self, user_key: Optional[str] = None) -> List[str]:
        active = []
        if await self.gemini.is_available(user_key):
            active.append("Gemini (Primary)")
        if await self.groq.is_available(user_key):
            active.append("Groq (Secondary)")
        if await self.ollama.is_available():
            active.append(f"Ollama ({self.ollama.model})")
        active.append("Heuristic Engine (Always Available)")
        return active

    async def call_llm(
        self,
        prompt: str,
        system_instruction: str = "",
        json_mode: bool = False,
        temperature: float = 0.4,
        user_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Attempts execution across providers sequentially.
        Returns a dict: {"text": str, "provider": str, "latency_ms": int, "success": bool}
        """
        t0 = time.time()
        errors = []

        # 1. Try Gemini
        if await self.gemini.is_available(user_key):
            try:
                res = await self.gemini.generate_text(prompt, system_instruction, json_mode, temperature, user_key)
                if res and res.strip():
                    self.request_counts["gemini"] += 1
                    return {
                        "success": True,
                        "text": res.strip(),
                        "provider": "Gemini",
                        "latency_ms": int((time.time() - t0) * 1000)
                    }
            except Exception as e:
                logger.warning(f"[AI Manager] Gemini attempt failed: {e}. Falling back to Groq.")
                errors.append(f"Gemini: {e}")

        # 2. Try Groq
        if await self.groq.is_available(user_key):
            try:
                res = await self.groq.generate_text(prompt, system_instruction, json_mode, temperature, user_key)
                if res and res.strip():
                    self.request_counts["groq"] += 1
                    return {
                        "success": True,
                        "text": res.strip(),
                        "provider": "Groq",
                        "latency_ms": int((time.time() - t0) * 1000)
                    }
            except Exception as e:
                logger.warning(f"[AI Manager] Groq attempt failed: {e}. Falling back to Ollama.")
                errors.append(f"Groq: {e}")

        # 3. Try Ollama (Local)
        if await self.ollama.is_available():
            try:
                res = await self.ollama.generate_text(prompt, system_instruction, json_mode, temperature)
                if res and res.strip():
                    self.request_counts["ollama"] += 1
                    return {
                        "success": True,
                        "text": res.strip(),
                        "provider": "Ollama",
                        "latency_ms": int((time.time() - t0) * 1000)
                    }
            except Exception as e:
                logger.warning(f"[AI Manager] Ollama attempt failed: {e}. Falling back to Heuristics.")
                errors.append(f"Ollama: {e}")

        self.request_counts["failures"] += 1
        return {
            "success": False,
            "text": "",
            "provider": "None",
            "errors": errors,
            "latency_ms": int((time.time() - t0) * 1000)
        }

    async def call_llm_json(
        self,
        prompt: str,
        system_instruction: str = "",
        user_key: Optional[str] = None,
        validator: Optional[Callable[[Dict[str, Any]], bool]] = None
    ) -> Optional[Dict[str, Any]]:
        """Calls LLM with json_mode=True and extracts validated JSON."""
        result = await self.call_llm(prompt, system_instruction, json_mode=True, user_key=user_key)
        if result["success"] and result["text"]:
            parsed = extract_clean_json(result["text"])
            if parsed is not None:
                if validator is None or validator(parsed):
                    parsed["_ai_provider"] = result["provider"]
                    return parsed
        return None


# Global Singleton Instance
ai_manager = AIServiceManager()


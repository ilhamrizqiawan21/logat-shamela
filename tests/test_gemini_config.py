import json
import os
import unittest
from unittest.mock import MagicMock, patch

from ai_service import AIService, AIUnavailable


class GeminiConfigTests(unittest.TestCase):
    def test_missing_key_does_not_send_request(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "gemini", "GEMINI_API_KEY": ""}), patch("urllib.request.urlopen") as send:
            with self.assertRaisesRegex(AIUnavailable, "GEMINI_API_KEY belum diisi"):
                AIService()._gemini("system", "text", "language", {})
            send.assert_not_called()

    def test_config_and_key_header(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({"candidates": [{"content": {"parts": [{"text": '{"answer":"arti","sections":[]}'}]}}]}).encode()
        with patch.dict(os.environ, {"AI_PROVIDER": "gemini", "GEMINI_API_KEY": "test-placeholder", "GEMINI_TIMEOUT": "30", "GEMINI_MAX_OUTPUT_TOKENS": "700"}), patch("urllib.request.urlopen", return_value=response) as send:
            result = AIService()._gemini("system", "text", "language", {})
            request = send.call_args.args[0]
            self.assertNotIn("test-placeholder", request.full_url)
            self.assertEqual(request.get_header("X-goog-api-key"), "test-placeholder")
            self.assertEqual(send.call_args.kwargs["timeout"], 30)
            self.assertEqual(json.loads(request.data)["generationConfig"]["maxOutputTokens"], 700)
            self.assertEqual(result["answer"], "arti")

    def test_invalid_numeric_config_uses_default(self):
        with patch.dict(os.environ, {"GEMINI_TIMEOUT": "invalid"}):
            self.assertEqual(AIService._gemini_setting("GEMINI_TIMEOUT", 45, 5, 90), 45)

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from fastapi import HTTPException

from app import AnnotationInput, create_app
from logat_syamilah.core import LogatStore, Token

class AnnotationEndpointTests(unittest.TestCase):
	def test_annotation_uses_real_reader_token(self):
		with tempfile.TemporaryDirectory() as folder:
			store = LogatStore(Path(folder) / "logat.db")

			real_token = Token(
				"قال",
				True,
				2,
				normalized="قال",
				prev_word="ثم",
				next_word="الامام",
			)

			reader = SimpleNamespace(
				page=lambda book_id, page_id: {
					"tokens": [real_token]
				}

			)

			app = create_app()
			app.state.service = SimpleNamespace(
				store=store,
				reader=reader,
			)

			endpoint = next(
				route.endpoint
				for route in app.routes
				if route.path == "/api/annotation"
				and "PUT" in route.methods
        		)

			data = AnnotationInput(
				book_id=1,
				page_id=10,
				word_index=2,
				word="قال",
				meaning="berkata",
				normalized_word="SALAH",
				prev_word="SALAH",
				next_word="SALAH",
			)


			result = endpoint(data)

			self.assertEqual(result, {"ok": True})

			saved = store.annotations(1, 10)[2]

			self.assertEqual(saved["word"], "قال")
			self.assertEqual(saved["normalized_word"], "قال")
			self.assertEqual(saved["prev_word"], "ثم")
			self.assertEqual(saved["next_word"], "الامام")

	def test_annotation_rejects_mismatched_word(self):
		with tempfile.TemporaryDirectory() as folder:
			store = LogatStore(Path(folder) / "logat.db")

			real_token = Token(
				"قال",
				True,
				2,
				normalized="قال"
			)

			reader = SimpleNamespace(
				page=lambda book_id, page_id: {
					"tokens": [real_token]
				}
			)

			app = create_app()
			app.state.service = SimpleNamespace(
				store=store,
				reader=reader,
			)

			endpoint = next(
				route.endpoint
				for route in app.routes
				if route.path == "/api/annotation"
				and "PUT" in route.methods
			)


			data = AnnotationInput(
				book_id=1,
				page_id=10,
				word_index=2,
				word="كتاب",
				meaning="kitab",
			)

			with self.assertRaises(HTTPException) as error:
				endpoint(data)

			self.assertEqual(
				error.exception.status_code,
				409,
			)

			self.assertEqual(
				store.annotations(1, 10),
				{},
			)

if __name__ == "__main__":
	unittest.main()
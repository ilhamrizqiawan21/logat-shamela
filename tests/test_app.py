import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import LogatStore, tokenize
from logat_syamilah.core import Token


class LogatTests(unittest.TestCase):
    def test_tokenize_arabic_words_stably(self):
        words = [t for t in tokenize("قال الإمام: الحمد لله") if t["word"]]
        self.assertEqual([w["text"] for w in words], ["قال", "الإمام", "الحمد", "لله"])
        self.assertEqual([w["index"] for w in words], [0, 1, 2, 3])

    def test_annotation_round_trip_and_delete(self):
        with tempfile.TemporaryDirectory() as d:
            store = LogatStore(Path(d) / "test.db")
            token = Token("قال", True, 4, normalized="قال")
            store.save(12, 3, token, "berkata")
            self.assertEqual(store.annotations(12, 3)[4]["meaning"], "berkata")
            store.save(12, 3, token, "")
            self.assertEqual(store.annotations(12, 3), {})

    def test_bookmark_toggle_and_list(self):
        with tempfile.TemporaryDirectory() as d:
            store = LogatStore(Path(d) / "test.db")
            self.assertFalse(store.is_bookmarked(12, 3))
            self.assertTrue(store.toggle_bookmark(12, 3))
            self.assertTrue(store.is_bookmarked(12, 3))
            self.assertEqual(store.bookmarks()[0]["page_id"], 3)
            self.assertFalse(store.toggle_bookmark(12, 3))
            self.assertEqual(store.bookmarks(), [])

    def test_suggestions_use_normalized_word(self):
        with tempfile.TemporaryDirectory() as d:
            store = LogatStore(Path(d) / "test.db")
            store.save(12, 3, Token("قَالَ", True, 4, normalized="قال"), "berkata")
            store.save(13, 7, Token("قال", True, 2, normalized="قال"), "mengucapkan")
            self.assertEqual(store.suggestions("قال", limit=2), ["mengucapkan", "berkata"])


if __name__ == "__main__":
    unittest.main()

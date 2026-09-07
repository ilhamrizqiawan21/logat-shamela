import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import AnnotationInput, create_app


class ApiTests(unittest.TestCase):
    def test_api_contract_contains_reader_endpoints(self):
        paths = {route.path for route in create_app().routes}
        self.assertTrue({"/api/books", "/api/books/{book_id}", "/api/page", "/api/page/resolve", "/api/index", "/api/search", "/api/annotation", "/api/bookmark", "/api/bookmarks", "/api/suggestions", "/api/data/export", "/api/data/import"} <= paths)
        data = AnnotationInput(book_id=1, page_id=2, word_index=3, word="قال", meaning="berkata")
        self.assertEqual((data.book_id, data.meaning), (1, "berkata"))


if __name__ == '__main__': unittest.main()

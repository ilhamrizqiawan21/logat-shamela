import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from app import BookmarkInput, create_app
from logat_syamilah.core import LogatStore


class BookmarkDeleteTests(unittest.TestCase):
    def test_delete_endpoint_is_idempotent_and_preserves_other_bookmarks(self):
        with tempfile.TemporaryDirectory() as folder:
            store = LogatStore(Path(folder) / 'logat.db')
            store.toggle_bookmark(1, 12)
            store.toggle_bookmark(2, 24)
            app = create_app()
            app.state.service = SimpleNamespace(store=store)
            endpoint = next(route.endpoint for route in app.routes if route.path == '/api/bookmark' and 'DELETE' in route.methods)
            for _ in range(2):
                self.assertEqual(endpoint(BookmarkInput(book_id=1, page_id=12)), {'bookmarked': False})
            self.assertFalse(store.is_bookmarked(1, 12))
            self.assertTrue(store.is_bookmarked(2, 24))

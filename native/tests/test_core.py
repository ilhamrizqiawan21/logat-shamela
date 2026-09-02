import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from logat_syamilah.core import CatalogRepository, LogatStore, Token, normalize_word, parse_and_tokenize


class ParserTests(unittest.TestCase):
    def test_markup_is_removed_and_title_preserved(self):
        tokens = parse_and_tokenize('<span data-type="title" id="toc-1">باب العلم</span>قال المؤلف')
        self.assertFalse(any('<span' in t.text or '</span>' in t.text for t in tokens))
        title_words = [t.text for t in tokens if t.is_word and t.style == 'title']
        self.assertEqual(title_words, ['باب', 'العلم'])

    def test_punctuation_is_not_a_word(self):
        tokens = parse_and_tokenize('قال: نعم، والحمدُ لله.')
        words = [t for t in tokens if t.is_word]
        self.assertEqual([t.normalized for t in words], ['قال', 'نعم', 'والحمد', 'لله'])
        self.assertEqual([t.index for t in words], [0, 1, 2, 3])

    def test_context_is_recorded(self):
        words = [t for t in parse_and_tokenize('قال الإمام أحمد') if t.is_word]
        self.assertEqual((words[1].prev_word, words[1].next_word), ('قال', 'أحمد'))


class StoreTests(unittest.TestCase):
    def test_migrates_legacy_database_without_losing_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'logat.db'
            with sqlite3.connect(path) as db:
                db.execute('CREATE TABLE annotation (book_id INTEGER,page_id INTEGER,word_index INTEGER,word TEXT,meaning TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(book_id,page_id,word_index))')
                db.execute("INSERT INTO annotation(book_id,page_id,word_index,word,meaning) VALUES(1,2,3,'قال','berkata')")
            store = LogatStore(path)
            row = store.annotations(1, 2)[3]
            self.assertEqual(row['meaning'], 'berkata')
            self.assertIn('normalized_word', row)

    def test_save_suggest_backup_and_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); store = LogatStore(root / 'logat.db')
            token = Token('الْعِلْمُ', True, 2, normalized=normalize_word('الْعِلْمُ'), prev_word='طلب', next_word='نور')
            store.save(1, 4, token, 'ilmu')
            self.assertEqual(store.suggestions('العلم'), ['ilmu'])
            self.assertTrue(store.toggle_bookmark(1, 4))
            self.assertTrue(store.is_bookmarked(1, 4))
            self.assertFalse(store.toggle_bookmark(1, 4))
            self.assertTrue(store.backup().exists())
            target = root / 'export.json'; store.export_json(target)
            self.assertEqual(json.loads(target.read_text())['annotations'][0]['meaning'], 'ilmu')


class CatalogTests(unittest.TestCase):
    def test_catalog_groups_and_filters_installed_books(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'master.db'
            with sqlite3.connect(path) as db:
                db.executescript('''CREATE TABLE book(book_id INTEGER PRIMARY KEY,book_name TEXT,book_category INTEGER,major_ondisk INTEGER);
                CREATE TABLE category(category_id INTEGER PRIMARY KEY,category_name TEXT,category_order INTEGER);
                CREATE TABLE author(author_id INTEGER PRIMARY KEY,author_name TEXT,alpha INTEGER);
                CREATE TABLE author_book(author_id INTEGER,book_id INTEGER);''')
                db.executemany('INSERT INTO category VALUES(?,?,?)', [(1,'تفسير',2),(2,'فقه',1)])
                db.executemany('INSERT INTO author VALUES(?,?,?)', [(1,'أحمد',2),(2,'بكر',1)])
                db.executemany('INSERT INTO book VALUES(?,?,?,?)', [(1,'كتاب التفسير',1,1),(2,'كتاب الفقه',2,1),(3,'مخفي',1,0)])
                db.executemany('INSERT INTO author_book VALUES(?,?)', [(1,1),(2,1),(2,2),(1,3)])
            catalog = CatalogRepository(path)
            self.assertEqual([x.name for x in catalog.categories()], ['فقه', 'تفسير'])
            self.assertEqual([x.id for x in catalog.books(category_id=1)], [1])
            self.assertEqual([x.id for x in catalog.books(author_id=2)], [1, 2])
            self.assertEqual([x.id for x in catalog.books('الفقه')], [2])


if __name__ == '__main__':
    unittest.main()

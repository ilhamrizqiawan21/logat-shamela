from __future__ import annotations

import hashlib
import html
import json
import os
import re
import shutil
import sqlite3
import subprocess
import threading
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

ARABIC_LETTERS = re.compile(r"[\u0621-\u063a\u0641-\u064a\u066e\u066f\u0671-\u06d3\u06fa-\u06fc\u0750-\u077f\u08a0-\u08c9]")
TOKEN_PARTS = re.compile(r"[\u0621-\u063a\u0641-\u064a\u066e\u066f\u0671-\u06d3\u06fa-\u06fc\u0750-\u077f\u08a0-\u08c9\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]+|[^\u0621-\u063a\u0641-\u064a\u066e\u066f\u0671-\u06d3\u06fa-\u06fc\u0750-\u077f\u08a0-\u08c9\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]+")
DIACRITICS = re.compile(r"[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]")


@dataclass(frozen=True)
class Token:
    text: str
    is_word: bool
    index: int | None
    style: str = "body"
    normalized: str = ""
    prev_word: str = ""
    next_word: str = ""


@dataclass(frozen=True)
class CatalogBook:
    id: int
    name: str
    authors: str
    category_id: int
    category_name: str
    volume_count: int


@dataclass(frozen=True)
class CatalogItem:
    id: int
    name: str
    count: int


class CatalogRepository:
    """Read-only view of the catalog bundled with Maktabah Syamilah."""
    def __init__(self, master_db: Path): self.master_db = master_db

    def _connect(self):
        return sqlite3.connect(f"file:{self.master_db}?mode=ro", uri=True)

    @staticmethod
    def _book(row):
        return CatalogBook(row[0], row[1], row[2] or "", row[3], row[4] or "", row[5] or 0)

    def books(self, query="", category_id=None, author_id=None):
        clauses = ["b.major_ondisk>0"]
        args = []
        if category_id is not None: clauses.append("b.book_category=?"); args.append(category_id)
        if author_id is not None: clauses.append("EXISTS (SELECT 1 FROM author_book ab WHERE ab.book_id=b.book_id AND ab.author_id=?)"); args.append(author_id)
        if query.strip():
            clauses.append("(b.book_name LIKE ? OR EXISTS (SELECT 1 FROM author_book ab JOIN author a ON a.author_id=ab.author_id WHERE ab.book_id=b.book_id AND a.author_name LIKE ?))")
            args.extend([f"%{query.strip()}%"] * 2)
        sql = """SELECT b.book_id,b.book_name,GROUP_CONCAT(DISTINCT a.author_name),b.book_category,c.category_name,b.major_ondisk
                 FROM book b JOIN category c ON c.category_id=b.book_category
                 LEFT JOIN author_book ab ON ab.book_id=b.book_id LEFT JOIN author a ON a.author_id=ab.author_id
                 WHERE """ + " AND ".join(clauses) + " GROUP BY b.book_id ORDER BY b.book_name"
        with self._connect() as db: return [self._book(r) for r in db.execute(sql, args)]

    def categories(self, query=""):
        sql = """SELECT c.category_id,c.category_name,COUNT(b.book_id) FROM category c JOIN book b ON b.book_category=c.category_id AND b.major_ondisk>0"""
        args = []
        if query.strip(): sql += " WHERE c.category_name LIKE ?"; args.append(f"%{query.strip()}%")
        sql += " GROUP BY c.category_id ORDER BY c.category_order,c.category_name"
        with self._connect() as db: return [CatalogItem(*r) for r in db.execute(sql, args)]

    def authors(self, query=""):
        sql = """SELECT a.author_id,a.author_name,COUNT(DISTINCT b.book_id) FROM author a JOIN author_book ab ON ab.author_id=a.author_id JOIN book b ON b.book_id=ab.book_id AND b.major_ondisk>0"""
        args = []
        if query.strip(): sql += " WHERE a.author_name LIKE ?"; args.append(f"%{query.strip()}%")
        sql += " GROUP BY a.author_id ORDER BY a.alpha,a.author_name"
        with self._connect() as db: return [CatalogItem(*r) for r in db.execute(sql, args)]


class ShamelaMarkupParser(HTMLParser):
    """Accept the small Shamela markup vocabulary and discard raw tags safely."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[tuple[str, str]] = []
        self.styles = ["body"]

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "span" and attrs.get("data-type") == "title":
            self.parts.append(("\n", "body"))
            self.styles.append("title")
        elif tag in {"br", "p", "div"}:
            self.parts.append(("\n", "body"))
        elif tag.startswith("hadeeth") or tag == "hadeeth":
            self.styles.append("hadith")

    def handle_endtag(self, tag):
        if tag in {"span", "hadeeth"} and len(self.styles) > 1:
            self.styles.pop()
            if tag == "span":
                self.parts.append(("\n", "body"))

    def handle_data(self, data):
        self.parts.append((data, self.styles[-1]))


def normalize_word(word: str) -> str:
    return DIACRITICS.sub("", word).replace("ـ", "")


def parse_and_tokenize(body: str, foot: str = "") -> list[Token]:
    parser = ShamelaMarkupParser()
    parser.feed(body)
    if foot:
        parser.parts.extend([("\n\n────────\n", "body"), (foot, "footnote")])
    raw: list[tuple[str, bool, int | None, str, str]] = []
    index = 0
    for text, style in parser.parts:
        for piece in TOKEN_PARTS.findall(html.unescape(text).replace("\r", "\n")):
            is_word = bool(ARABIC_LETTERS.search(piece))
            normalized = normalize_word(piece) if is_word else ""
            raw.append((piece, is_word, index if is_word else None, style, normalized))
            if is_word:
                index += 1
    words = [r[4] for r in raw if r[1]]
    result: list[Token] = []
    wi = 0
    for text, is_word, idx, style, normalized in raw:
        if is_word:
            result.append(Token(text, True, idx, style, normalized,
                                words[wi - 1] if wi else "", words[wi + 1] if wi + 1 < len(words) else ""))
            wi += 1
        else:
            result.append(Token(text, False, None, style))
    return result


def discover_install_root(explicit: str | None = None) -> Path:
    candidates = [explicit, os.environ.get("SHAMELA_INSTALL_ROOT"),
                  str(Path(__file__).resolve().parents[3]),
                  "C:/shamela" if os.name == "nt" else "/mnt/c/shamela",
                  str(Path.home() / "Documents/shamela"), str(Path.home() / "shamela")]
    for candidate in filter(None, candidates):
        root = Path(candidate).expanduser().resolve()
        if (root / "database/master.db").is_file() and (root / "app/lucene/2").is_dir():
            return root
    raise FileNotFoundError("Instalasi Maktabah Syamilah tidak ditemukan. Atur SHAMELA_INSTALL_ROOT.")


def user_data_dir() -> Path:
    root = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "logat-syamilah"
    root.mkdir(parents=True, exist_ok=True)
    return root


class LogatStore:
    SCHEMA_VERSION = 2

    def __init__(self, path: Path, legacy_path: Path | None = None):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() and legacy_path and legacy_path.exists():
            shutil.copy2(legacy_path, path)
        self._migrate()

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def _columns(self, db, table):
        return {r[1] for r in db.execute(f"PRAGMA table_info({table})")}

    def _migrate(self):
        with self.connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS annotation (
                book_id INTEGER NOT NULL, page_id INTEGER NOT NULL, word_index INTEGER NOT NULL,
                word TEXT NOT NULL, meaning TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(book_id,page_id,word_index))""")
            additions = {"normalized_word": "TEXT NOT NULL DEFAULT ''", "prev_word": "TEXT NOT NULL DEFAULT ''",
                         "next_word": "TEXT NOT NULL DEFAULT ''", "created_at": "TEXT NOT NULL DEFAULT ''"}
            columns = self._columns(db, "annotation")
            for name, spec in additions.items():
                if name not in columns:
                    db.execute(f"ALTER TABLE annotation ADD COLUMN {name} {spec}")
            db.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS bookmark (book_id INTEGER NOT NULL,page_id INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(book_id,page_id))")
            db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('schema_version',?)", (str(self.SCHEMA_VERSION),))

    def annotations(self, book_id: int, page_id: int):
        with self.connect() as db:
            rows = db.execute("SELECT * FROM annotation WHERE book_id=? AND page_id=?", (book_id, page_id))
            return {r["word_index"]: dict(r) for r in rows}

    def save(self, book_id: int, page_id: int, token: Token, meaning: str):
        if token.index is None:
            raise ValueError("Token bukan kata")
        if not meaning.strip():
            return self.delete(book_id, page_id, token.index)
        now = datetime.now().isoformat(timespec="seconds")
        with self.connect() as db:
            db.execute("""INSERT INTO annotation(book_id,page_id,word_index,word,meaning,normalized_word,prev_word,next_word,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(book_id,page_id,word_index) DO UPDATE SET
                word=excluded.word,meaning=excluded.meaning,normalized_word=excluded.normalized_word,
                prev_word=excluded.prev_word,next_word=excluded.next_word,updated_at=excluded.updated_at""",
                (book_id, page_id, token.index, token.text, meaning.strip(), token.normalized,
                 token.prev_word, token.next_word, now, now))

    def delete(self, book_id: int, page_id: int, word_index: int):
        with self.connect() as db:
            db.execute("DELETE FROM annotation WHERE book_id=? AND page_id=? AND word_index=?", (book_id, page_id, word_index))

    def suggestions(self, normalized_word: str, limit=8):
        with self.connect() as db:
            return [r[0] for r in db.execute("SELECT meaning FROM annotation WHERE normalized_word=? GROUP BY meaning ORDER BY MAX(updated_at) DESC LIMIT ?", (normalized_word, limit))]

    def set_setting(self, key: str, value: str):
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)", (key, value))

    def get_setting(self, key: str, default=""):
        with self.connect() as db:
            row = db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
            return row[0] if row else default

    def is_bookmarked(self, book_id: int, page_id: int) -> bool:
        with self.connect() as db:
            return db.execute("SELECT 1 FROM bookmark WHERE book_id=? AND page_id=?", (book_id, page_id)).fetchone() is not None

    def bookmarks(self):
        with self.connect() as db:
            return [dict(r) for r in db.execute("SELECT book_id,page_id,created_at FROM bookmark ORDER BY created_at DESC")]

    def delete_bookmark(self, book_id: int, page_id: int) -> None:
        with closing(self.connect()) as db, db:
            db.execute("DELETE FROM bookmark WHERE book_id=? AND page_id=?", (book_id, page_id))

    def toggle_bookmark(self, book_id: int, page_id: int) -> bool:
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            deleted = db.execute("DELETE FROM bookmark WHERE book_id=? AND page_id=?", (book_id, page_id)).rowcount
            if deleted:
                return False
            db.execute("INSERT OR IGNORE INTO bookmark(book_id,page_id) VALUES(?,?)", (book_id, page_id))
            return True

    def backup(self) -> Path:
        backup_dir = self.path.parent / "backups"
        backup_dir.mkdir(exist_ok=True)
        target = backup_dir / f"logat-{datetime.now():%Y%m%d-%H%M%S}.db"
        with self.connect() as source, sqlite3.connect(target) as dest:
            source.backup(dest)
        return target

    def export_json(self, target: Path):
        with self.connect() as db:
            data = self.export_data(db)
        target.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def export_data(self, db=None):
        owns_connection = db is None
        db = db or self.connect()
        try:
            return {
                "format": "logat-syamilah-backup",
                "version": 1,
                "annotations": [dict(row) for row in db.execute("SELECT * FROM annotation ORDER BY book_id,page_id,word_index")],
                "bookmarks": [dict(row) for row in db.execute("SELECT book_id,page_id,created_at FROM bookmark ORDER BY created_at")],
            }
        finally:
            if owns_connection:
                db.close()

    def import_data(self, data: dict):
        if data.get("format") != "logat-syamilah-backup" or data.get("version") != 1:
            raise ValueError("Format backup tidak didukung")
        annotations = data.get("annotations")
        bookmarks = data.get("bookmarks", [])
        if not isinstance(annotations, list) or not isinstance(bookmarks, list):
            raise ValueError("Isi backup tidak valid")
        required = {"book_id", "page_id", "word_index", "word", "meaning"}
        if any(not isinstance(row, dict) or not required <= row.keys() for row in annotations):
            raise ValueError("Data logat pada backup tidak valid")
        if any(not isinstance(row, dict) or not {"book_id", "page_id"} <= row.keys() for row in bookmarks):
            raise ValueError("Data bookmark pada backup tidak valid")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM annotation")
            db.execute("DELETE FROM bookmark")
            for row in annotations:
                db.execute("""INSERT INTO annotation
                    (book_id,page_id,word_index,word,meaning,normalized_word,prev_word,next_word,created_at,updated_at)
                    VALUES(?,?,?,?,?,?,?,?,?,?)""", (
                    row["book_id"], row["page_id"], row["word_index"], row["word"], row["meaning"],
                    row.get("normalized_word", ""), row.get("prev_word", ""), row.get("next_word", ""),
                    row.get("created_at", ""), row.get("updated_at", "")))
            for row in bookmarks:
                db.execute("INSERT INTO bookmark(book_id,page_id,created_at) VALUES(?,?,?)",
                           (row["book_id"], row["page_id"], row.get("created_at", "")))


class ShamelaReader:
    def __init__(self, install_root: Path, helper_jar: Path):
        self.root = install_root
        self.catalog = CatalogRepository(install_root / "database/master.db")
        java = install_root / "app/linux/64/jre/2/bin/java"
        windows_java = install_root / "app/win/64/jre/2/bin/java.exe"
        if os.name == "nt" or (not java.is_file() and shutil.which("wslpath") and windows_java.is_file()):
            java = windows_java
        if not java.is_file():
            raise FileNotFoundError(f"Java bawaan Syamilah tidak ditemukan: {java}")
        def java_path(value: Path) -> str:
            if java.suffix == ".exe" and os.name != "nt":
                return subprocess.check_output(["wslpath", "-w", str(value.resolve())], text=True).strip()
            return str(value)
        jars = sorted((install_root / "app/lucene/2").glob("*.jar"))
        cp = (";" if java.suffix == ".exe" else os.pathsep).join(map(java_path, [*jars, helper_jar]))
        self.proc = subprocess.Popen([str(java), "--enable-native-access=ALL-UNNAMED",
            "--add-modules=jdk.incubator.vector", "-cp", cp, "ws.shamela.mcp.Main", java_path(install_root)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", bufsize=1,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        self.lock = threading.Lock()
        line = self.proc.stdout.readline()
        if not line:
            details = self.proc.stderr.read()
            self.close()
            raise RuntimeError(f"Mesin Lucene Syamilah gagal dimulai: {details.strip()}")
        ready = json.loads(line)
        if not ready.get("ok"):
            raise RuntimeError("Mesin Lucene Syamilah gagal dimulai")

    def close(self):
        if self.proc.poll() is None:
            self.proc.terminate()
            try: self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired: self.proc.kill()

    def request(self, cmd: str, args: dict):
        with self.lock:
            rid = hashlib.sha1(f"{threading.get_ident()}-{datetime.now().timestamp()}".encode()).hexdigest()[:12]
            self.proc.stdin.write(json.dumps({"id": rid, "cmd": cmd, "args": args}) + "\n")
            self.proc.stdin.flush()
            while line := self.proc.stdout.readline():
                response = json.loads(line)
                if response.get("id") == rid:
                    if not response.get("ok"):
                        raise RuntimeError(response.get("error", {}).get("message", "Pembaca Syamilah gagal"))
                    return response["data"]
            raise RuntimeError("Pembaca Syamilah berhenti")

    def books(self, query="", category_id=None, author_id=None):
        return self.catalog.books(query, category_id, author_id)

    def categories(self, query=""): return self.catalog.categories(query)
    def authors(self, query=""): return self.catalog.authors(query)

    def page_count(self, book_id: int):
        uri = f"file:{self.root / 'database/book' / str(book_id)[-3:] / (str(book_id)+'.db')}?mode=ro"
        with sqlite3.connect(uri, uri=True) as db:
            return db.execute("SELECT COUNT(*) FROM page").fetchone()[0]

    def page_exists(self, book_id: int, page_id: int) -> bool:
        uri = f"file:{self.root / 'database/book' / str(book_id)[-3:] / (str(book_id)+'.db')}?mode=ro"
        try:
            with sqlite3.connect(uri, uri=True) as db:
                return db.execute("SELECT 1 FROM page WHERE id=?", (page_id,)).fetchone() is not None
        except sqlite3.Error:
            return False

    def page(self, book_id: int, page_id: int):
        response = self.request("get_pages_batch", {"book_id": book_id, "page_ids": [page_id]})
        results = response.get("results", [])
        if not results:
            raise LookupError("Halaman tidak ditemukan")
        data = results[0]
        if not data.get("found"):
            raise LookupError("Halaman tidak ditemukan")
        uri = f"file:{self.root / 'database/book' / str(book_id)[-3:] / (str(book_id)+'.db')}?mode=ro"
        printed = None
        try:
            with sqlite3.connect(uri, uri=True) as db:
                printed = db.execute("SELECT part,page FROM page WHERE id=?", (page_id,)).fetchone()
        except sqlite3.Error: pass
        return {"tokens": parse_and_tokenize(data["body"], data["foot"]),
                "part": printed[0] if printed else None, "printed_page": printed[1] if printed else None}

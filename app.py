#!/usr/bin/env python3
"""FastAPI server for the local Logat Syamilah web reader."""
from __future__ import annotations

import argparse
import sqlite3
import threading
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from logat_syamilah.core import LogatStore, ShamelaReader, Token, discover_install_root, parse_and_tokenize, user_data_dir

APP_DIR = Path(__file__).resolve().parent
DIST_DIR = APP_DIR / "web" / "dist"


def tokenize(text: str) -> list[dict]:
    """Legacy-compatible tokenizer retained for existing integrations."""
    return [{"text": t.text, "word": t.is_word, "index": t.index} for t in parse_and_tokenize(text)]


class AnnotationInput(BaseModel):
    book_id: int
    page_id: int
    word_index: int
    word: str
    meaning: str = ""
    normalized_word: str = ""
    prev_word: str = ""
    next_word: str = ""


class BookmarkInput(BaseModel):
    book_id: int
    page_id: int


class ReaderService:
    def __init__(self, root: Path | None = None, data_dir: Path | None = None):
        self.root = root or discover_install_root()
        self.reader = ShamelaReader(self.root, APP_DIR / "vendor" / "shamela-helper.jar")
        self.store = LogatStore(data_dir / "logat.db" if data_dir else user_data_dir() / "logat.db",
                                self.root / "logat" / "logat.db")

    def close(self): self.reader.close()

    def book(self, book_id: int):
        uri = f"file:{self.root / 'database/master.db'}?mode=ro"
        with sqlite3.connect(uri, uri=True) as db:
            row = db.execute("""SELECT b.book_id,b.book_name,COALESCE(GROUP_CONCAT(DISTINCT a.author_name),''),b.book_category,COALESCE(c.category_name,''),COALESCE(b.major_ondisk,0)
                              FROM book b LEFT JOIN author_book ab ON ab.book_id=b.book_id LEFT JOIN author a ON a.author_id=ab.author_id
                              LEFT JOIN category c ON c.category_id=b.book_category WHERE b.book_id=? GROUP BY b.book_id""", (book_id,)).fetchone()
        return {"id": row[0], "name": row[1], "authors": row[2].replace(",", "،"), "category_id": row[3], "category": row[4], "volume_count": row[5]} if row else None

    def page(self, book_id: int, page_id: int):
        page = self.reader.page(book_id, page_id)
        book = self.book(book_id)
        if not book: raise LookupError("Kitab tidak ditemukan")
        return {"book_id": book_id, "page_id": page_id, "part": page["part"], "printed_page": page["printed_page"],
                "tokens": [token.__dict__ for token in page["tokens"]],
                "annotations": {str(k): v for k, v in self.store.annotations(book_id, page_id).items()},
                "book_name": book["name"], "authors": book["authors"],
                "bookmarked": self.store.is_bookmarked(book_id, page_id)}

    def bookmarks(self):
        results = []
        for row in self.store.bookmarks():
            book = self.book(row["book_id"])
            results.append(row | {"book_name": book["name"] if book else "", "authors": book["authors"] if book else ""})
        return results

    def index(self, book_id: int):
        uri = f"file:{self.root / 'database/book' / str(book_id)[-3:] / (str(book_id) + '.db')}?mode=ro"
        try:
            with sqlite3.connect(uri, uri=True) as db: rows = db.execute("SELECT id,page,parent FROM title ORDER BY id").fetchall()
        except sqlite3.Error: return []
        results = self.reader.request("get_titles_batch", {"book_id": book_id, "title_ids": [r[0] for r in rows]}).get("results", [])
        titles = {r["title_id"]: r.get("title_text", "") for r in results}
        return [{"id": r[0], "page_id": r[1], "parent": r[2], "title": titles.get(r[0], "")}
                for r in rows if titles.get(r[0], "").strip()]

    def parts(self, book_id: int):
        uri = f"file:{self.root / 'database/book' / str(book_id)[-3:] / (str(book_id) + '.db')}?mode=ro"
        try:
            with sqlite3.connect(uri, uri=True) as db:
                rows = db.execute("SELECT part, MIN(id) FROM page WHERE part IS NOT NULL GROUP BY part ORDER BY part").fetchall()
            return [{"part": r[0], "page_id": r[1]} for r in rows]
        except sqlite3.Error:
            return []

    def search(self, query: str, book_ids: list[int], offset: int = 0):
        if not query.strip(): return {"query": query, "total_hits": 0, "results": []}
        data = self.reader.request("search_pages", {"query": query, "offset": max(0, offset), "max_results": 100,
                                                     "scope_book_keys": [str(book_id) for book_id in book_ids]})
        for item in data.get("results", []):
            book = self.book(item["book_id"])
            item["book_name"] = book["name"] if book else ""
            item["authors"] = book["authors"] if book else ""
        return data


def create_app(service: ReaderService | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.service = service or ReaderService()
        try: yield
        finally:
            if not service: app.state.service.close()

    api = FastAPI(title="Logat Syamilah", lifespan=lifespan)
    def svc() -> ReaderService: return api.state.service

    @api.get("/api/health")
    def health(): return {"ok": True}

    @api.get("/api/books")
    def books(q: str = "", category: int | None = None, author: int | None = None):
        return [b.__dict__ | {"category": b.category_name} for b in svc().reader.books(q, category, author)]

    @api.get("/api/books/{book_id}")
    def book(book_id: int):
        result = svc().book(book_id)
        if not result: raise HTTPException(404, "Kitab tidak ditemukan")
        return result

    @api.get("/api/categories")
    def categories(q: str = ""): return [x.__dict__ for x in svc().reader.categories(q)]

    @api.get("/api/authors")
    def authors(q: str = ""): return [x.__dict__ for x in svc().reader.authors(q)]

    @api.get("/api/page")
    def page(book_id: int, page_id: int):
        try: return svc().page(book_id, page_id)
        except (LookupError, RuntimeError) as exc: raise HTTPException(404, str(exc)) from exc

    @api.get("/api/index")
    def index(book_id: int): return svc().index(book_id)

    @api.get("/api/parts")
    def parts(book_id: int): return svc().parts(book_id)

    @api.get("/api/bookmarks")
    def bookmarks(): return svc().bookmarks()

    @api.put("/api/bookmark")
    def toggle_bookmark(data: BookmarkInput):
        return {"bookmarked": svc().store.toggle_bookmark(data.book_id, data.page_id)}

    @api.get("/api/suggestions")
    def suggestions(normalized_word: str, limit: int = 8):
        return {"suggestions": svc().store.suggestions(normalized_word, max(1, min(limit, 20)))}

    @api.get("/api/search")
    def search(q: str, book_ids: list[int] = Query(...), offset: int = 0): return svc().search(q, book_ids, offset)

    @api.put("/api/annotation")
    def save_annotation(data: AnnotationInput):
        svc().store.save(data.book_id, data.page_id,
                         Token(data.word, True, data.word_index, normalized=data.normalized_word,
                               prev_word=data.prev_word, next_word=data.next_word), data.meaning)
        return {"ok": True}

    @api.delete("/api/annotation")
    def delete_annotation(data: AnnotationInput):
        svc().store.delete(data.book_id, data.page_id, data.word_index)
        return {"ok": True}

    if DIST_DIR.is_dir():
        api.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
        @api.get("/{path:path}", include_in_schema=False)
        def frontend(path: str):
            candidate = DIST_DIR / path
            return FileResponse(candidate) if path and candidate.is_file() else FileResponse(DIST_DIR / "index.html")
    return api


def main():
    parser = argparse.ArgumentParser(description="Web reader Logat Syamilah")
    parser.add_argument("--host", default="127.0.0.1"); parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not args.no_browser: threading.Timer(.6, lambda: webbrowser.open(f"http://{args.host}:{args.port}")).start()
    uvicorn.run(create_app(), host=args.host, port=args.port)

if __name__ == "__main__": main()

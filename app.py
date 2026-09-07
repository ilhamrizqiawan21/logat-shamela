#!/usr/bin/env python3
"""FastAPI server for the local Logat Syamilah web reader."""
from __future__ import annotations

import argparse
import sqlite3
import threading
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from ai_service import AIService, AIRateLimited, AIUnavailable

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


class AIAnalysisInput(BaseModel):
    book_id: int
    page_id: int
    mode: str
    text: str
    word: str = ""
    context_before: str = ""
    context_after: str = ""


class AIToggleInput(BaseModel):
    enabled: bool


class AIProviderInput(BaseModel):
    provider: str


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

    def search_advanced(self, terms: list[str], operator: str, book_ids: list[int], offset: int = 0):
        terms = [term.strip() for term in terms if term.strip()]
        if not terms: return {"query": "", "total_hits": 0, "results": []}
        queries = [f"{term}~" if operator == "FUZZY" else term for term in terms]
        responses = [self.search(query, book_ids, 0) for query in queries]
        buckets = [{(item["book_id"], item["page_id"]): item for item in response.get("results", [])} for response in responses]
        if operator == "AND": keys = set.intersection(*(set(bucket) for bucket in buckets))
        elif operator == "NOT": keys = set(buckets[0]) - set().union(*(set(bucket) for bucket in buckets[1:]))
        else: keys = set.union(*(set(bucket) for bucket in buckets))
        results = [next(bucket[key] for bucket in buckets if key in bucket) for key in sorted(keys)]
        return {"query": f" {operator} ".join(terms), "total_hits": len(results), "results": results[offset:offset + 100]}


def create_app(service: ReaderService | None = None, ai_service: AIService | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.service = service or ReaderService()
        app.state.ai_service = ai_service or AIService()
        try: yield
        finally:
            if not service: app.state.service.close()

    api = FastAPI(title="Logat Syamilah", lifespan=lifespan)
    def svc() -> ReaderService: return api.state.service
    def ai() -> AIService: return api.state.ai_service

    @api.get("/api/health")
    def health(): return {"ok": True}

    @api.get("/api/books")
    def books(q: str = "", category: int | None = None, author: int | None = None):
        try:
            return [b.__dict__ | {"category": b.category_name} for b in svc().reader.books(q, category, author)]
        except sqlite3.Error as exc:
            raise HTTPException(503, "Database katalog tidak tersedia") from exc
    @api.get("/api/books/{book_id}")
    def book(book_id: int):
        result = svc().book(book_id)
        if not result: raise HTTPException(404, "Kitab tidak ditemukan")
        return result

    @api.get("/api/categories")
    def categories(q: str = ""):
        try:
            return [x.__dict__ for x in svc().reader.categories(q)]
        except sqlite3.Error as exc:
            raise HTTPException(503, "Database katalog tidak tersedia") from exc
    @api.get("/api/authors")
    def authors(q: str = ""):
        try:
            return [x.__dict__ for x in svc().reader.authors(q)]
        except sqlite3.Error as exc:
            raise HTTPException(503, "Database katalog tidak tersedia") from exc
    @api.get("/api/page")
    def page(book_id: int, page_id: int):
        try: return svc().page(book_id, page_id)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(503, "Mesin pembaca sedang tidak tersedia") from exc

    @api.get("/api/index")
    def index(book_id: int): return svc().index(book_id)

    @api.get("/api/parts")
    def parts(book_id: int): return svc().parts(book_id)

    @api.get("/api/bookmarks")
    def bookmarks(): return svc().bookmarks()

    @api.delete("/api/bookmark")
    def delete_bookmark(data: BookmarkInput):
        svc().store.delete_bookmark(data.book_id, data.page_id)
        return {"bookmarked": False}

    @api.put("/api/bookmark")
    def toggle_bookmark(data: BookmarkInput):
        if not svc().book(data.book_id) or not svc().reader.page_exists(data.book_id, data.page_id):
            raise HTTPException(404, "Halaman tidak ditemukan")
        return {"bookmarked": svc().store.toggle_bookmark(data.book_id, data.page_id)}

    @api.post("/api/ai/analyze")
    def analyze_ai(data: AIAnalysisInput):
        if data.mode not in {"language", "nahwu", "shorof", "munasabah"}:
            raise HTTPException(400, "Mode analisis tidak valid")
        book = svc().book(data.book_id)
        if not book or not svc().reader.page_exists(data.book_id, data.page_id):
            raise HTTPException(404, "Kitab atau halaman tidak ditemukan")
        source = {"book_name": book["name"], "authors": book["authors"], "page_id": data.page_id, "chapter": ""}
        try:
            chapters = svc().index(data.book_id)
            eligible = [c for c in chapters if c["page_id"] <= data.page_id]
            if eligible: source["chapter"] = eligible[-1]["title"]
            return ai().analyze(mode=data.mode, text=data.text, word=data.word, context_before=data.context_before, context_after=data.context_after, source=source)
        except ValueError as exc: raise HTTPException(400, str(exc)) from exc
        except AIRateLimited as exc: raise HTTPException(429, str(exc)) from exc
        except AIUnavailable as exc: raise HTTPException(503, str(exc)) from exc

    @api.get("/api/ai/status")
    def ai_status(): return ai().status()

    @api.put("/api/ai/toggle")
    def ai_toggle(data: AIToggleInput): return ai().set_enabled(data.enabled)

    @api.put("/api/ai/provider")
    def ai_provider(data: AIProviderInput):
        try: return ai().set_provider(data.provider)
        except ValueError as exc: raise HTTPException(400, str(exc)) from exc
        except AIUnavailable as exc: raise HTTPException(503, str(exc)) from exc

    @api.get("/api/suggestions")
    def suggestions(normalized_word: str, limit: int = 8):
        return {"suggestions": svc().store.suggestions(normalized_word, max(1, min(limit, 20)))}

    @api.get("/api/search")
    def search(q: str = Query(..., min_length=1, max_length=500),
               book_ids: list[int] = Query(..., min_length=1, max_length=200),
               offset: int = Query(0, ge=0, le=1_000_000)):
        return svc().search(q, book_ids, offset)

    @api.get("/api/search/advanced")
    def advanced_search(terms: list[str] = Query(..., min_length=1, max_length=4),
                        operator: str = Query("AND", pattern="^(AND|OR|NOT|FUZZY)$"),
                        book_ids: list[int] = Query(..., min_length=1, max_length=200),
                        offset: int = Query(0, ge=0, le=1_000_000)):
        if any(not term.strip() or len(term) > 500 for term in terms):
            raise HTTPException(400, "Kata kunci tidak valid")
        return svc().search_advanced(terms, operator, book_ids, offset)

    @api.put("/api/annotation")
    def save_annotation(data: AnnotationInput):
        try:
            page = svc().reader.page(data.book_id, data.page_id)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(
                503,
                "Mesin pembaca sedang tidak tersedia"
            ) from exc

        token = next(
            (
                token
                for token in page["tokens"]
                if token.is_word and token.index == data.word_index
            ),
            None,
        )

        if token is None:
            raise HTTPException(
                404,
                "Kata tidak ditemukan pada halaman"
            )
        if data.word and token.text != data.word:
            raise HTTPException(
                409,
                "Data tidak sesuai dengan halaman saat ini"
            )

        svc().store.save(
            data.book_id,
            data.page_id,
            token,
            data.meaning,
        )
        return {"ok": True}
        

    @api.delete("/api/annotation")
    def delete_annotation(data: AnnotationInput):
        svc().store.delete(data.book_id, data.page_id, data.word_index)
        return {"ok": True}

    @api.get("/api/data/export")
    def export_data():
        return svc().store.export_data()

    @api.post("/api/data/import")
    def import_data(data: dict):
        try:
            svc().store.import_data(data)
        except (TypeError, ValueError, KeyError, sqlite3.Error) as exc:
            raise HTTPException(400, str(exc) or "Backup tidak valid") from exc
        return {"ok": True}

    if DIST_DIR.is_dir():
        api.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
        @api.get("/{path:path}", include_in_schema=False)
        def frontend(path: str):
            candidate = DIST_DIR / path
            return FileResponse(candidate) if path and candidate.is_file() else FileResponse(DIST_DIR / "index.html")
    return api


def main():
    import uvicorn

    parser = argparse.ArgumentParser(description="Web reader Logat Syamilah")
    parser.add_argument("--host", default="127.0.0.1"); parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not args.no_browser: threading.Timer(.6, lambda: webbrowser.open(f"http://{args.host}:{args.port}")).start()
    uvicorn.run(create_app(), host=args.host, port=args.port)

if __name__ == "__main__": main()

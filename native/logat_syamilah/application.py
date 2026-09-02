from __future__ import annotations

import os
import threading
from pathlib import Path

import gi
gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gdk, Gio, GLib, Gtk, Pango

from . import __version__
from .core import LogatStore, ShamelaReader, Token, discover_install_root, user_data_dir

APP_ID = "id.logat_syamilah.desktop"


def resource_root() -> Path:
    explicit = os.environ.get("LOGAT_SYAMILAH_RESOURCE_DIR")
    if explicit:
        return Path(explicit)
    source_root = Path(__file__).resolve().parents[2]
    return source_root if (source_root / "vendor/shamela-helper.jar").exists() else Path("/usr/lib/logat-syamilah")


CSS = b"""
.reader, .reader text { background: #fbf7e9; color: #282419; }
.word { padding: 2px 1px; margin: 0; border-radius: 5px; background: transparent; }
.word:hover { background: alpha(@accent_color, .12); }
.annotated { background: alpha(@accent_color, .16); }
.arabic { font-family: "Noto Naskh Arabic", "Amiri", serif; font-size: 24px; }
.meaning { font-size: 11px; color: #765512; }
.title-word .arabic { font-weight: 700; color: @accent_color; }
.footnote-word .arabic { font-size: 19px; }
.sidebar-title { font-weight: 700; }
.page-meta { opacity: .7; }
.editor-word { font-family: "Noto Naskh Arabic", "Amiri", serif; font-size: 28px; }
"""


class MainWindow(Adw.ApplicationWindow):
    def __init__(self, app, reader: ShamelaReader, store: LogatStore):
        super().__init__(application=app, title="Logat Syamilah", default_width=1280, default_height=820)
        self.reader, self.store = reader, store
        self.books = []
        self.catalog_mode = "all"
        self.catalog_selection = None
        self.current_book = 0
        self.current_page = 1
        self.page_total = 1
        self.tokens: list[Token] = []
        self.selected_token: Token | None = None
        self.load_generation = 0
        self.font_scale = float(store.get_setting("font_scale", "1.0") or 1.0)
        self._build()
        self._refresh_catalog()
        self._restore_session()

    def _build(self):
        overlay = Adw.ToastOverlay()
        self.toast_overlay = overlay
        self.set_content(overlay)
        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        overlay.set_child(root)

        header = Adw.HeaderBar()
        title = Adw.WindowTitle(title="Logat Syamilah", subtitle="Membaca dan memberi arti per kata")
        header.set_title_widget(title)
        backup = Gtk.Button(icon_name="document-save-symbolic", tooltip_text="Buat backup logat")
        backup.connect("clicked", self._backup)
        header.pack_end(backup)
        export = Gtk.Button(icon_name="document-send-symbolic", tooltip_text="Ekspor logat ke JSON")
        export.connect("clicked", self._export)
        header.pack_end(export)
        self.bookmark_button = Gtk.ToggleButton(icon_name="non-starred-symbolic", tooltip_text="Tandai halaman")
        self.bookmark_button.connect("toggled", self._toggle_bookmark)
        header.pack_end(self.bookmark_button)
        zoom_out = Gtk.Button(icon_name="zoom-out-symbolic", tooltip_text="Perkecil teks")
        zoom_in = Gtk.Button(icon_name="zoom-in-symbolic", tooltip_text="Perbesar teks")
        zoom_out.connect("clicked", lambda *_: self._zoom(-.1))
        zoom_in.connect("clicked", lambda *_: self._zoom(.1))
        header.pack_end(zoom_in); header.pack_end(zoom_out)
        root.append(header)

        paned = Gtk.Paned(orientation=Gtk.Orientation.HORIZONTAL, shrink_start_child=False)
        paned.set_position(310)
        root.append(paned)
        paned.set_vexpand(True)

        sidebar = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        sidebar.set_size_request(260, -1)
        sidebar.set_margin_top(12); sidebar.set_margin_bottom(12); sidebar.set_margin_start(12); sidebar.set_margin_end(12)
        self.catalog_tabs = Gtk.DropDown.new_from_strings(["Semua Kitab", "Fan Ilmu", "Musonnif"])
        self.catalog_tabs.connect("notify::selected", self._catalog_mode_changed)
        sidebar.append(self.catalog_tabs)
        self.catalog_title = Gtk.Label(label="Semua kitab", xalign=1, css_classes=["sidebar-title"])
        self.catalog_title.set_direction(Gtk.TextDirection.RTL)
        sidebar.append(self.catalog_title)
        self.search = Gtk.SearchEntry(placeholder_text="Cari kitab atau musonnif…")
        self.search.connect("search-changed", self._refresh_catalog)
        sidebar.append(self.search)
        book_scroll = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER)
        self.book_list = Gtk.ListBox(selection_mode=Gtk.SelectionMode.SINGLE, css_classes=["navigation-sidebar"])
        self.book_list.connect("row-selected", self._catalog_selected)
        book_scroll.set_child(self.book_list)
        sidebar.append(book_scroll)
        paned.set_start_child(sidebar)

        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        nav = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8, halign=Gtk.Align.CENTER)
        nav.set_margin_top(10); nav.set_margin_bottom(4)
        self.prev_button = Gtk.Button(label="Sebelumnya", icon_name="go-previous-symbolic")
        self.next_button = Gtk.Button(label="Berikutnya", icon_name="go-next-symbolic")
        self.prev_button.connect("clicked", lambda *_: self._change_page(-1))
        self.next_button.connect("clicked", lambda *_: self._change_page(1))
        self.page_spin = Gtk.SpinButton.new_with_range(1, 1, 1)
        self.page_spin.set_width_chars(6)
        self.page_spin.connect("activate", lambda *_: self.load_page(int(self.page_spin.get_value())))
        nav.append(self.prev_button); nav.append(Gtk.Label(label="Halaman")); nav.append(self.page_spin); nav.append(self.next_button)
        content.append(nav)
        self.meta = Gtk.Label(label="Pilih kitab", css_classes=["page-meta"])
        content.append(self.meta)
        self.book_heading = Gtk.Label(xalign=1, wrap=True, css_classes=["sidebar-title"])
        self.book_heading.set_direction(Gtk.TextDirection.RTL)
        content.append(self.book_heading)

        self.reader_scroll = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER)
        self.reader_view = Gtk.TextView(editable=False, cursor_visible=False, wrap_mode=Gtk.WrapMode.WORD_CHAR,
                                        accepts_tab=False, css_classes=["reader"])
        self.reader_view.set_direction(Gtk.TextDirection.RTL)
        self.reader_view.set_justification(Gtk.Justification.RIGHT)
        self.reader_view.set_left_margin(18); self.reader_view.set_right_margin(18)
        self.reader_view.set_top_margin(22); self.reader_view.set_bottom_margin(22)
        self.reader_view.set_pixels_above_lines(9); self.reader_view.set_pixels_below_lines(9)
        self.reader_scroll.set_child(self.reader_view)
        content.append(self.reader_scroll)

        self.editor = Gtk.Revealer(transition_type=Gtk.RevealerTransitionType.SLIDE_UP)
        editor_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        editor_box.set_margin_top(10); editor_box.set_margin_bottom(10); editor_box.set_margin_start(18); editor_box.set_margin_end(18)
        self.editor_word = Gtk.Label(css_classes=["editor-word"], width_chars=10)
        self.meaning_entry = Gtk.Entry(placeholder_text="Masukkan arti/logat…", hexpand=True)
        self.meaning_entry.connect("activate", self._save_annotation)
        save = Gtk.Button(label="Simpan", css_classes=["suggested-action"])
        delete = Gtk.Button(label="Hapus", css_classes=["destructive-action"])
        close = Gtk.Button(icon_name="window-close-symbolic", tooltip_text="Tutup editor")
        save.connect("clicked", self._save_annotation); delete.connect("clicked", self._delete_annotation)
        close.connect("clicked", lambda *_: self.editor.set_reveal_child(False))
        editor_box.append(self.editor_word); editor_box.append(self.meaning_entry); editor_box.append(save); editor_box.append(delete); editor_box.append(close)
        self.editor.set_child(editor_box)
        content.append(self.editor)
        paned.set_end_child(content)

        key = Gtk.EventControllerKey()
        key.connect("key-pressed", self._key_pressed)
        self.add_controller(key)

    def _clear_catalog(self):
        while child := self.book_list.get_first_child(): self.book_list.remove(child)

    def _refresh_catalog(self, *_):
        self._clear_catalog()
        query = self.search.get_text().strip()
        if self.catalog_mode == "all":
            self.catalog_title.set_label("Semua kitab")
            self.books = self.reader.books(query)
            for book in self.books: self._append_book(book)
            return
        if self.catalog_selection is None:
            items = self.reader.categories(query) if self.catalog_mode == "category" else self.reader.authors(query)
            self.catalog_title.set_label("Pilih fan ilmu" if self.catalog_mode == "category" else "Pilih musonnif")
            for item in items:
                row = Gtk.ListBoxRow(); row.kind = self.catalog_mode; row.item = item
                row.set_child(Gtk.Label(label=f"{item.name} ({item.count})", xalign=1, wrap=True))
                self.book_list.append(row)
            return
        label = self.catalog_selection.name
        self.catalog_title.set_label(f"← {label}")
        books = self.reader.books(query, category_id=self.catalog_selection.id) if self.catalog_mode == "category" else self.reader.books(query, author_id=self.catalog_selection.id)
        for book in books: self._append_book(book)

    def _append_book(self, book):
        row = Gtk.ListBoxRow(); row.kind = "book"; row.book = book
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        name = Gtk.Label(label=book.name, xalign=1, wrap=True, ellipsize=Pango.EllipsizeMode.END, max_width_chars=30)
        name.set_direction(Gtk.TextDirection.RTL); box.append(name)
        if book.authors:
            author = Gtk.Label(label=book.authors.replace(',', '،'), xalign=1, css_classes=["dim-label"], ellipsize=Pango.EllipsizeMode.END)
            author.set_direction(Gtk.TextDirection.RTL); box.append(author)
        row.set_child(box); self.book_list.append(row)

    def _catalog_mode_changed(self, *_):
        self.catalog_mode = ("all", "category", "author")[self.catalog_tabs.get_selected()]
        self.catalog_selection = None
        self.search.set_text("")
        self._refresh_catalog()

    def _populate_books(self):
        self._refresh_catalog()

    def _filter_books(self, *_):
        self._refresh_catalog()

    def _catalog_selected(self, _list, row):
        if not row: return
        if row.kind in {"category", "author"}:
            self.catalog_selection = row.item
            self.search.set_text("")
            self._refresh_catalog()
            return
        self._book_selected(_list, row)

    def _book_selected(self, _list, row):
        if getattr(row, "kind", "book") != "book": return
        book = row.book
        self.current_book = book.id
        self.current_book_info = book
        self.page_total = max(1, self.reader.page_count(self.current_book))
        self.page_spin.set_range(1, self.page_total)
        saved = int(self.store.get_setting(f"last_page:{self.current_book}", "1") or 1)
        self.load_page(min(saved, self.page_total))

    def _restore_session(self):
        wanted = int(self.store.get_setting("last_book", "0") or 0)
        row = self.book_list.get_first_child()
        chosen = None
        while row:
            if getattr(row, "kind", None) == "book" and row.book.id == wanted: chosen = row; break
            chosen = chosen or row
            row = row.get_next_sibling()
        if chosen: self.book_list.select_row(chosen)

    def _change_page(self, delta):
        self.load_page(max(1, min(self.page_total, self.current_page + delta)))

    def load_page(self, page_id: int):
        if not self.current_book: return
        self.load_generation += 1
        generation = self.load_generation
        self.meta.set_label("Memuat halaman…")
        self.prev_button.set_sensitive(False); self.next_button.set_sensitive(False)
        def worker():
            try:
                page = self.reader.page(self.current_book, page_id)
                annotations = self.store.annotations(self.current_book, page_id)
                GLib.idle_add(self._render_page, generation, page_id, page, annotations)
            except Exception as exc:
                GLib.idle_add(self._show_error, str(exc))
        threading.Thread(target=worker, daemon=True).start()

    def _render_page(self, generation, page_id, page, annotations):
        if generation != self.load_generation: return False
        self.tokens = page["tokens"]
        buffer = self.reader_view.get_buffer()
        buffer.set_text("")
        for token in self.tokens:
            end = buffer.get_end_iter()
            if token.is_word:
                anchor = buffer.create_child_anchor(end)
                widget = self._token_widget(token, token.text, annotations.get(token.index))
                self.reader_view.add_child_at_anchor(widget, anchor)
            else:
                buffer.insert(end, token.text)
        self.current_page = page_id
        self.page_spin.set_value(page_id)
        self.prev_button.set_sensitive(page_id > 1); self.next_button.set_sensitive(page_id < self.page_total)
        info = getattr(self, "current_book_info", None)
        self.book_heading.set_label(f"{info.name} — {info.authors.replace(',', '،')}" if info and info.authors else (info.name if info else ""))
        self.meta.set_label(f"Jilid {page['part'] or '–'} · Halaman cetak {page['printed_page'] or '–'} · {page_id}/{self.page_total}")
        self.bookmark_button.handler_block_by_func(self._toggle_bookmark)
        marked = self.store.is_bookmarked(self.current_book, page_id)
        self.bookmark_button.set_active(marked)
        self.bookmark_button.set_icon_name("starred-symbolic" if marked else "non-starred-symbolic")
        self.bookmark_button.handler_unblock_by_func(self._toggle_bookmark)
        self.store.set_setting("last_book", str(self.current_book)); self.store.set_setting(f"last_page:{self.current_book}", str(page_id))
        self.editor.set_reveal_child(False)
        adj = self.reader_scroll.get_vadjustment(); adj.set_value(0)
        return False

    def _token_widget(self, token: Token, text: str, annotation):
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0, halign=Gtk.Align.CENTER)
        word = Gtk.Label(label=text, css_classes=["arabic"])
        word.set_direction(Gtk.TextDirection.RTL); box.append(word)
        if annotation:
            meaning = Gtk.Label(label=annotation["meaning"], css_classes=["meaning"], wrap=True, max_width_chars=18)
            box.append(meaning)
        classes = ["word"] + (["annotated"] if annotation else [])
        if token.style == "title": classes.append("title-word")
        if token.style == "footnote": classes.append("footnote-word")
        button = Gtk.Button(child=box, css_classes=classes, focus_on_click=False)
        button.connect("clicked", self._edit_token, token)
        return button

    def _edit_token(self, _button, token: Token):
        self.selected_token = token
        annotation = self.store.annotations(self.current_book, self.current_page).get(token.index)
        self.editor_word.set_label(token.text)
        self.meaning_entry.set_text(annotation["meaning"] if annotation else "")
        self.meaning_entry.set_tooltip_text("Saran lama: " + ", ".join(self.store.suggestions(token.normalized)))
        self.editor.set_reveal_child(True); self.meaning_entry.grab_focus(); self.meaning_entry.set_position(-1)

    def _save_annotation(self, *_):
        if not self.selected_token: return
        self.store.save(self.current_book, self.current_page, self.selected_token, self.meaning_entry.get_text())
        self.load_page(self.current_page)
        self.toast_overlay.add_toast(Adw.Toast(title="Logat tersimpan", timeout=2))

    def _delete_annotation(self, *_):
        if self.selected_token and self.selected_token.index is not None:
            self.store.delete(self.current_book, self.current_page, self.selected_token.index)
            self.load_page(self.current_page)
            self.toast_overlay.add_toast(Adw.Toast(title="Logat dihapus", timeout=2))

    def _backup(self, *_):
        target = self.store.backup()
        self.toast_overlay.add_toast(Adw.Toast(title=f"Backup dibuat: {target.name}", timeout=4))

    def _export(self, *_):
        target = user_data_dir() / "logat-export.json"
        self.store.export_json(target)
        self.toast_overlay.add_toast(Adw.Toast(title=f"Logat diekspor: {target}", timeout=5))

    def _toggle_bookmark(self, button):
        if not self.current_book: return
        marked = self.store.toggle_bookmark(self.current_book, self.current_page)
        button.set_icon_name("starred-symbolic" if marked else "non-starred-symbolic")
        self.toast_overlay.add_toast(Adw.Toast(title="Halaman ditandai" if marked else "Tanda halaman dihapus", timeout=2))

    def _zoom(self, amount):
        self.font_scale = min(1.8, max(.7, self.font_scale + amount))
        self.store.set_setting("font_scale", f"{self.font_scale:.1f}")
        provider = Gtk.CssProvider(); provider.load_from_data(f".arabic {{ font-size: {24*self.font_scale:.0f}px; }} .meaning {{ font-size: {11*self.font_scale:.0f}px; }}".encode())
        Gtk.StyleContext.add_provider_for_display(self.get_display(), provider, Gtk.STYLE_PROVIDER_PRIORITY_USER)

    def _key_pressed(self, _controller, keyval, _keycode, state):
        ctrl = bool(state & Gdk.ModifierType.CONTROL_MASK)
        if keyval == 65307: self.editor.set_reveal_child(False); return True
        if ctrl and keyval in (ord('s'), ord('S')): self._save_annotation(); return True
        if ctrl and keyval in (ord('f'), ord('F')): self.search.grab_focus(); return True
        if state == 0 and keyval == 65361: self._change_page(-1); return True
        if state == 0 and keyval == 65363: self._change_page(1); return True
        return False

    def _show_error(self, message):
        self.meta.set_label("Gagal memuat halaman")
        self.prev_button.set_sensitive(True); self.next_button.set_sensitive(True)
        self.toast_overlay.add_toast(Adw.Toast(title=message, timeout=6))
        return False


class LogatApplication(Adw.Application):
    def __init__(self):
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.DEFAULT_FLAGS)
        self.reader = None

    def do_startup(self):
        Adw.Application.do_startup(self)
        display = Gdk.Display.get_default()
        if display:
            provider = Gtk.CssProvider(); provider.load_from_data(CSS)
            Gtk.StyleContext.add_provider_for_display(display, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

    def do_activate(self):
        win = self.get_active_window()
        if win: win.present(); return
        try:
            root = discover_install_root()
            resources = resource_root()
            helper = resources / "vendor/shamela-helper.jar"
            self.reader = ShamelaReader(root, helper)
            store = LogatStore(user_data_dir() / "logat.db", root / "logat/logat.db")
            MainWindow(self, self.reader, store).present()
        except Exception as exc:
            dialog = Adw.AlertDialog(heading="Logat Syamilah tidak dapat dimulai", body=str(exc))
            dialog.add_response("close", "Tutup"); dialog.set_default_response("close")
            fallback = Adw.ApplicationWindow(application=self, title="Logat Syamilah", default_width=520, default_height=240)
            fallback.present(); dialog.present(fallback)

    def do_shutdown(self):
        if self.reader: self.reader.close()
        Adw.Application.do_shutdown(self)


def run(argv=None):
    app = LogatApplication()
    return app.run(argv)

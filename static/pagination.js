(() => {
  const pageSize = 24;
  let offset = 0;
  const $ = (selector) => document.querySelector(selector);

  const render = async () => {
    const state = window.logatState;
    const query = $("#qbook")?.value || "";
    let url = `/api/books?q=${encodeURIComponent(query)}&limit=${pageSize}&offset=${offset}`;
    if (state.filter) {
      const field = state.filterMode === "category" ? "category" : "author";
      url += `&${field}=${state.filter.id}`;
    }
    const response = await fetch(url);
    const books = await response.json();
    if (!response.ok) throw Error(books.error || "Gagal memuat kitab");
    const list = $("#list");
    list.innerHTML = books.map((book) =>
      `<button class="book" data-book="${book.id}"><b>${escape(book.name)}</b><small>${escape(book.authors || "Musonnif tidak tercatat")}</small></button>`
    ).join("") || '<div class="empty">Kitab tidak ditemukan.</div>';
    list.querySelectorAll(".book").forEach((button) => button.onclick = () => {
      const book = books.find((item) => item.id === Number(button.dataset.book));
      window.logatChoose(book);
    });
    drawControls(books.length);
  };

  const escape = (value) => {
    const node = document.createElement("i"); node.textContent = value || ""; return node.innerHTML;
  };

  const drawControls = (count) => {
    let controls = $("#bookPagination");
    if (!controls) {
      controls = document.createElement("div");
      controls.id = "bookPagination";
      controls.style.cssText = "display:flex;justify-content:center;align-items:center;gap:10px;padding:18px;color:#778078";
      $("#list").after(controls);
    }
    controls.innerHTML = `<button ${offset === 0 ? "disabled" : ""}>← Sebelumnya</button><span>Halaman ${Math.floor(offset / pageSize) + 1}</span><button ${count < pageSize ? "disabled" : ""}>Berikutnya →</button>`;
    const [previous, next] = controls.querySelectorAll("button");
    previous.onclick = () => { offset = Math.max(0, offset - pageSize); render(); };
    next.onclick = () => { offset += pageSize; render(); };
  };

  const originalBooks = window.books;
  window.books = async () => { offset = 0; return render(); };
  $("#qbook").addEventListener("input", () => { offset = 0; });
  render().catch((error) => { $("#error").textContent = error.message; });
  void originalBooks;
})();

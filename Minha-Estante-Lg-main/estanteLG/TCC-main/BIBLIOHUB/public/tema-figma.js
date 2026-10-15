/* ==========================================================================
   BiblioHub — interações do design "Minha Estante" (vindas do Figma)

   Este script NÃO altera o app.js, o backend nem o banco de dados.
   Ele apenas observa a tela que o app.js desenha e, a cada renderização,
   acrescenta por cima:
     • logo em SVG;
     • barra lateral (Início, Todos, Ler mais tarde, Favoritos, Gêneros);
     • botões de favoritar / ler mais tarde nos cards (salvos no navegador);
     • abertura da página de detalhe do livro ao clicar no card;
     • chips de gênero e navegação inferior no celular;
     • avisos flutuantes (toast).
   Empréstimo, devolução e reserva continuam usando as funções originais.
   ========================================================================== */
(function () {
  "use strict";

  const app = document.getElementById("app");
  if (!app) return;

  /* ---------- estado só de interface ---------- */
  let section = "home";   // home | all | later | favorites
  let genre = "";         // categoria escolhida na barra lateral
  let openId = null;      // livro aberto na página de detalhe

  /* ---------- utilidades ---------- */
  const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  /* lê (somente leitura) as variáveis globais que o app.js já mantém: books, user, doAction, api */
  const currentBooks = () => { try { return Array.isArray(books) ? books : []; } catch { return []; } };
  const currentUserId = () => { try { return user && user.id != null ? String(user.id) : "anon"; } catch { return "anon"; } };

  function loadSet(kind) {
    try { return new Set(JSON.parse(localStorage.getItem(`bibliohub_fx_${kind}_${currentUserId()}`) || "[]").map(Number)); }
    catch { return new Set(); }
  }
  function saveSet(kind, set) {
    try { localStorage.setItem(`bibliohub_fx_${kind}_${currentUserId()}`, JSON.stringify([...set])); } catch { /* sem armazenamento: ignora */ }
  }

  /* ---------- ícones e logo ---------- */
  const ICONS = {
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    books: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    back: '<path d="m15 18-6-6 6-6"/><path d="M9 12h10"/>',
    read: '<path d="M2 4h7a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H2V4Z"/><path d="M22 4h-7a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h7V4Z"/>'
  };
  const icon = (name, size = 18, filled = false) =>
    `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

  const LOGO = '<svg viewBox="0 0 64 64" role="img" aria-label="Logo BiblioHub"><circle class="fx-seal" cx="32" cy="32" r="28"/><circle class="fx-seal-inner" cx="32" cy="32" r="24"/><path class="fx-mono" d="M17 15v23h10"/><path class="fx-mono" d="M46 21c-3-5-13-6-17-1-5 6-2 16 6 18 6 2 12-2 12-8h-9"/><path class="fx-page" d="M12 38c8-2 14 0 20 5v10c-6-5-12-7-20-5Z"/><path class="fx-page" d="M52 38c-8-2-14 0-20 5v10c6-5 12-7 20-5Z"/><path class="fx-line" d="M16 42c6-.5 11 1 16 5m16-5c-6-.5-11 1-16 5"/></svg>';

  /* ---------- textos de apoio do design (por título) ---------- */
  const CONTENT = {
    "1984": { description: "Em uma sociedade permanentemente vigiada, Winston Smith trabalha alterando registros históricos para que correspondam à versão oficial do Partido. Aos poucos, suas dúvidas se transformam em uma busca perigosa por verdade e liberdade.", preview: ["Era um dia claro e frio de abril, e os relógios marcavam treze horas.", "Winston Smith entrou rapidamente pelas portas de vidro das Mansões Vitória, embora não tão depressa que evitasse a entrada de um redemoinho de poeira áspera."] },
    "A Origem das Espécies": { description: "A obra que apresentou ao mundo a teoria da evolução por seleção natural. Darwin reúne observações da natureza para explicar como as espécies se transformam ao longo das gerações.", preview: ["Ao considerarmos a origem das espécies, é perfeitamente concebível que um naturalista reflita sobre as afinidades mútuas dos seres vivos.", "Cada espécie não foi criada de forma independente, mas descende, como as variedades, de outras espécies."] },
    "Breve História do Tempo": { description: "Stephen Hawking conduz o leitor pelas grandes perguntas da cosmologia: a origem do universo, a natureza do tempo, os buracos negros e os limites do conhecimento científico.", preview: ["Vivemos nossa vida cotidiana sem entender quase nada do mundo.", "Pouco pensamos sobre a maquinaria que gera a luz do Sol e torna possível a vida, ou sobre a gravidade que nos prende a uma Terra que, de outro modo, nos lançaria ao espaço."] },
    "Clean Code": { description: "Um guia prático sobre princípios, padrões e técnicas para escrever código legível, sustentável e profissional, com exemplos de refatoração e boas práticas de desenvolvimento.", preview: ["Código limpo pode ser lido e melhorado por outro desenvolvedor.", "Ele possui testes significativos, nomes claros, dependências mínimas e oferece uma única maneira de fazer uma coisa."] },
    "Cosmos": { description: "Uma viagem pela história da ciência e do universo. Carl Sagan combina astronomia, filosofia e imaginação para mostrar o lugar da humanidade no cosmos.", preview: ["O Cosmos é tudo o que existe, existiu ou existirá.", "Nossas contemplações mais tênues do Cosmos nos agitam: sentimos um formigamento, a voz embarga e surge a sensação distante de uma lembrança."] },
    "Dom Casmurro": { description: "Bentinho relembra sua juventude, o amor por Capitu e os ciúmes que marcaram sua vida. Um dos maiores romances brasileiros, narrado entre memória, dúvida e ironia.", preview: ["Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz aqui do bairro.", "A viagem era curta, e o verso talvez não fosse inteiramente mau. Sucedeu, porém, que adormeci algumas vezes."] },
    "O Hobbit": { description: "Bilbo Bolseiro deixa a tranquilidade do Condado para participar de uma jornada inesperada com treze anões e o mago Gandalf em busca de um tesouro guardado por um dragão.", preview: ["Numa toca no chão vivia um hobbit. Não uma toca desagradável, suja e úmida, cheia de restos de minhocas, nem uma toca seca, vazia e arenosa.", "Era uma toca de hobbit, e isso quer dizer conforto."] },
    "O Senhor dos Anéis": { description: "Frodo recebe a missão de destruir o Um Anel antes que ele retorne ao Senhor do Escuro. A jornada reúne povos da Terra-média em uma luta decisiva contra o poder e a corrupção.", preview: ["Este livro trata em grande parte dos hobbits, e através de suas páginas o leitor poderá descobrir muito sobre seu caráter e um pouco de sua história.", "Os hobbits são um povo discreto, mas muito antigo, mais numeroso antigamente do que nos dias de hoje."] },
    "Orgulho e Preconceito": { description: "Elizabeth Bennet e Fitzwilliam Darcy precisam superar primeiras impressões, diferenças sociais e o próprio orgulho nesta história sobre amor, família e escolhas.", preview: ["É uma verdade universalmente reconhecida que um homem solteiro, possuidor de boa fortuna, deve estar necessitado de esposa.", "Por pouco conhecidos que sejam os sentimentos ou opiniões de tal homem ao entrar numa vizinhança, essa verdade está tão fixada nas mentes das famílias próximas que ele é considerado propriedade de alguma de suas filhas."] },
    "Sapiens": { description: "Uma narrativa ampla sobre a trajetória do Homo sapiens, da revolução cognitiva às transformações tecnológicas que moldaram sociedades, culturas e crenças.", preview: ["Há cerca de 13,5 bilhões de anos, matéria, energia, tempo e espaço surgiram naquilo que é conhecido como Big Bang.", "Cerca de 300 mil anos depois, matéria e energia começaram a formar estruturas complexas, chamadas átomos."] }
  };

  /* cores das capas (as mesmas do design, escolhidas pelo id do livro) */
  const COVERS = [
    ["#A85F3C", "#B87844", "#A4AA8E"],
    ["#738064", "#8D987B", "#B58A45"],
    ["#8D3F3F", "#B96847", "#C98552"],
    ["#5A3E32", "#85604C", "#A27A58"],
    ["#9A7338", "#B58A45", "#738064"]
  ];
  const coverVars = (id) => { const c = COVERS[Math.abs(Number(id)) % COVERS.length]; return `--cover-start:${c[0]};--cover-mid:${c[1]};--cover-end:${c[2]}`; };

  /* ---------- aviso flutuante ---------- */
  function toast(message) {
    const el = document.createElement("div");
    el.className = "fx-toast";
    el.setAttribute("role", "status");
    el.textContent = message;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2700);
  }

  /* ---------- ações ---------- */
  function toggleList(kind, id) {
    const set = loadSet(kind);
    const had = set.has(id);
    had ? set.delete(id) : set.add(id);
    saveSet(kind, set);
    toast(had ? "Livro removido da sua lista." : kind === "favs" ? "Livro adicionado aos favoritos." : "Livro salvo para ler mais tarde.");
    enhance();
    const btn = app.querySelector(`[data-fx-${kind === "favs" ? "fav" : "save"}="${id}"]`);
    if (btn) { btn.classList.add("pop"); window.setTimeout(() => btn.classList.remove("pop"), 320); }
  }

  function openBook(id) {
    openId = Number(id);
    enhance();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeBook() { openId = null; enhance(); }

  function setSection(next) {
    section = next; genre = ""; openId = null;
    syncGenreSelect();
    enhance();
  }
  function setGenre(next) {
    genre = next; if (next) section = "all"; openId = null;
    syncGenreSelect();
    enhance();
  }
  /* usa o <select> original do app.js, para o filtro continuar sendo o dele */
  function syncGenreSelect() {
    const select = document.getElementById("category");
    if (!select || select.value === genre) return;
    if (genre && ![...select.options].some((o) => o.value === genre)) { genre = ""; return; }
    select.value = genre;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function borrowFromDetail(id) {
    const book = currentBooks().find((b) => Number(b.id) === Number(id));
    if (!book || typeof doAction !== "function" || typeof api !== "function") return;
    const available = Number(book.available_copies) > 0;
    doAction(async () => (await api(available ? "/api/loans" : "/api/reservations", { method: "POST", body: JSON.stringify({ bookId: Number(book.id) }) })).message);
  }

  /* ---------- eventos (delegação única) ---------- */
  app.addEventListener("click", (e) => {
    const t = e.target;
    const el = (sel) => t.closest(sel);
    let n;
    if ((n = el("[data-fx-fav]"))) { e.stopPropagation(); return toggleList("favs", Number(n.dataset.fxFav)); }
    if ((n = el("[data-fx-save]"))) { e.stopPropagation(); return toggleList("saved", Number(n.dataset.fxSave)); }
    if ((n = el("[data-fx-section]"))) return setSection(n.dataset.fxSection);
    if ((n = el("[data-fx-genre]"))) return setGenre(n.dataset.fxGenre);
    if (el("[data-fx-back]")) return closeBook();
    if ((n = el("[data-fx-borrow]"))) return borrowFromDetail(n.dataset.fxBorrow);
    const card = el(".book-card[data-fx-id]");
    if (card && !el("button")) openBook(card.dataset.fxId);
  });
  app.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".book-card[data-fx-id]")) {
      e.preventDefault();
      openBook(e.target.dataset.fxId);
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openId !== null) closeBook(); });

  /* ---------- montagem das partes novas ---------- */
  function uniqueGenres(list) { return [...new Set(list.map((b) => b.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")); }

  function sidebarHtml(list, favs, saved) {
    const items = [
      ["home", "Início", "home"], ["all", "Todos os livros", "books"],
      ["later", "Ler mais tarde", "bookmark", saved], ["favorites", "Favoritos", "heart", favs]
    ];
    const main = items.map(([id, label, ic, count]) => `<button type="button" data-fx-section="${id}" class="${section === id && !genre ? "active" : ""}">${icon(ic, 17, (id === "favorites" || id === "later") && section === id && !genre)}<strong>${label}</strong>${count !== undefined ? `<small>${count}</small>` : "<span></span>"}</button>`).join("");
    const gens = uniqueGenres(list).map((c) => `<button type="button" data-fx-genre="${esc(c)}" class="${genre === c ? "active" : ""}"><i></i><strong>${esc(c)}</strong><small>${list.filter((b) => b.category === c).length}</small></button>`).join("");
    return `<div class="fx-group"><span>Biblioteca</span>${main}</div><div class="fx-group fx-genres"><span>Gêneros</span>${gens}</div>`;
  }
  function mobileNavHtml(favs, saved) {
    const items = [["home", "Catálogo", "home"], ["later", "Salvos", "bookmark", saved], ["favorites", "Favoritos", "heart", favs]];
    return items.map(([id, label, ic, count]) => `<button type="button" data-fx-section="${id}" class="${section === id && !genre ? "active" : ""}"><span>${icon(ic, 19, (id === "later" || id === "favorites") && section === id)}${count ? `<small>${count}</small>` : ""}</span><strong>${label}</strong></button>`).join("");
  }
  function chipsHtml(list) {
    return ["", ...uniqueGenres(list)].map((c) => `<button type="button" data-fx-genre="${esc(c)}" class="${genre === c ? "active" : ""}">${c ? esc(c) : "Todas"}</button>`).join("");
  }

  function detailHtml(book, fav, saved) {
    const extra = CONTENT[book.title] || {};
    const description = extra.description || book.description || "Este livro ainda não possui descrição cadastrada.";
    const available = Number(book.available_copies) > 0;
    const preview = extra.preview
      ? `<section class="fx-reading"><div class="fx-rtitle"><span>${icon("read", 20)}</span><div><small>CONTEÚDO DO LIVRO</small><h2>Prévia de leitura</h2></div></div><div class="fx-paper"><span>CAPÍTULO INICIAL</span><h2>${esc(book.title)}</h2>${extra.preview.map((p) => `<p>${esc(p)}</p>`).join("")}<div class="fx-end"><i></i><span>Fim da prévia disponível</span><i></i></div></div></section>`
      : "";
    return `<button type="button" class="fx-back" data-fx-back>${icon("back", 17)}Voltar ao catálogo</button>
      <section class="fx-dhero">
        <div class="fx-dcover" style="${coverVars(book.id)}"><span>${esc(String(book.title).charAt(0))}</span><small>${esc(book.category)}</small></div>
        <div class="fx-dinfo">
          <span class="fx-cat">${esc(book.category)}</span>
          <h1>${esc(book.title)}</h1>
          <p class="fx-dauthor">por <strong>${esc(book.author)}</strong></p>
          <p class="fx-ddesc">${esc(description)}</p>
          <div class="fx-dmeta">
            ${book.isbn ? `<span><small>ISBN</small><strong>${esc(book.isbn)}</strong></span>` : ""}
            <span><small>Disponibilidade</small><strong class="${available ? "" : "unavailable"}">${book.available_copies} de ${book.total_copies} exemplares</strong></span>
          </div>
          <div class="fx-dactions">
            <button type="button" class="fx-primary" data-fx-borrow="${book.id}">${available ? "Emprestar livro" : "Reservar livro"}</button>
            <button type="button" class="${fav ? "selected" : ""}" data-fx-fav="${book.id}">${icon("heart", 17, fav)}${fav ? "Favoritado" : "Favoritar"}</button>
            <button type="button" class="${saved ? "selected" : ""}" data-fx-save="${book.id}">${icon("bookmark", 17, saved)}${saved ? "Salvo" : "Ler mais tarde"}</button>
          </div>
        </div>
      </section>${preview}`;
  }

  /* substitui o conteúdo de um elemento só quando mudou (evita piscar) */
  function setHtml(el, html) { if (el.dataset.fxSig !== html) { el.innerHTML = html; el.dataset.fxSig = html; } }

  /* ---------- aprimoramento da tela ---------- */
  function skinStatic() {
    app.querySelectorAll(".brand-mark:not([data-fx]), .mini-logo:not([data-fx])").forEach((el) => { el.dataset.fx = "1"; el.innerHTML = LOGO; });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && meta.content !== "#5A3E32") meta.content = "#5A3E32";
  }

  function enhanceCatalog(content) {
    const list = currentBooks();
    const favSet = loadSet("favs"), savedSet = loadSet("saved");
    const ids = new Set(list.map((b) => Number(b.id)));
    const favCount = [...favSet].filter((i) => ids.has(i)).length;
    const savedCount = [...savedSet].filter((i) => ids.has(i)).length;

    content.classList.add("fx-has-sidebar");

    /* barra lateral */
    let sb = content.querySelector(":scope > .fx-sidebar");
    if (!sb) { sb = document.createElement("aside"); sb.className = "fx-sidebar"; sb.setAttribute("aria-label", "Biblioteca"); content.prepend(sb); }
    setHtml(sb, sidebarHtml(list, favCount, savedCount));

    /* navegação inferior (celular) */
    let mn = content.querySelector(":scope > .fx-mobilenav");
    if (!mn) { mn = document.createElement("nav"); mn.className = "fx-mobilenav"; mn.setAttribute("aria-label", "Navegação da biblioteca"); content.appendChild(mn); }
    setHtml(mn, mobileNavHtml(favCount, savedCount));

    /* chips de gênero (celular) */
    const filters = content.querySelector(".filters");
    if (filters) {
      let chips = content.querySelector(":scope > .fx-chips");
      if (!chips) { chips = document.createElement("div"); chips.className = "fx-chips"; chips.setAttribute("aria-label", "Filtrar por gênero"); filters.after(chips); }
      setHtml(chips, chipsHtml(list));
    }

    /* mantém o gênero escolhido depois que o app.js redesenha a tela */
    syncGenreSelect();

    /* textos do destaque conforme a seção */
    const hero = content.querySelector(".hero");
    if (hero) {
      const h1 = hero.querySelector("h1"), p = hero.querySelector("div > p:not(.eyebrow)"), eb = hero.querySelector(".eyebrow");
      const num = hero.querySelector(".hero-stat strong"), lbl = hero.querySelector(".hero-stat span");
      if (!hero._fx && h1 && p && eb && num && lbl) hero._fx = { h1: h1.textContent, p: p.textContent, eb: eb.textContent, n: num.textContent, l: lbl.textContent };
      const o = hero._fx;
      if (o) {
        const fav = section === "favorites", later = section === "later";
        h1.textContent = fav ? "Seus livros favoritos" : later ? "Sua lista para ler mais tarde" : genre ? `Livros de ${genre}` : section === "all" ? "Todos os livros" : o.h1;
        p.textContent = fav ? "Os títulos que ganharam um lugar especial na sua estante." : later ? "Histórias que você salvou para descobrir depois." : o.p;
        eb.textContent = genre ? genre.toUpperCase() : o.eb;
        num.textContent = fav ? favCount : later ? savedCount : o.n;
        lbl.textContent = fav ? "livros favoritos" : later ? "livros salvos" : o.l;
      }
    }

    /* cards: cor da capa, botões de favoritar/salvar, abertura do detalhe */
    const area = content.querySelector("#book-area");
    let visible = 0, total = 0;
    content.querySelectorAll(".book-card").forEach((card) => {
      const btn = card.querySelector("[data-borrow],[data-reserve]");
      if (!btn) return;
      const id = Number(btn.dataset.borrow || btn.dataset.reserve);
      const book = list.find((b) => Number(b.id) === id);
      total++;
      if (!card.dataset.fxId) {
        card.dataset.fxId = id;
        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");
        card.setAttribute("style", coverVars(id));
        if (book) card.setAttribute("aria-label", `Abrir ${book.title}`);
      }
      const body = card.querySelector(".book-body");
      let tools = card.querySelector(".fx-tools");
      if (!tools && body) { tools = document.createElement("div"); tools.className = "fx-tools"; body.prepend(tools); }
      const isFav = favSet.has(id), isSaved = savedSet.has(id);
      if (tools) setHtml(tools, `<button type="button" data-fx-fav="${id}" class="${isFav ? "selected" : ""}" aria-label="${isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}" title="${isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}">${icon("heart", 15, isFav)}</button><button type="button" data-fx-save="${id}" class="${isSaved ? "selected" : ""}" aria-label="${isSaved ? "Remover de ler mais tarde" : "Adicionar a ler mais tarde"}" title="${isSaved ? "Remover de ler mais tarde" : "Adicionar a ler mais tarde"}">${icon("bookmark", 15, isSaved)}</button>`);
      const hide = (section === "favorites" && !isFav) || (section === "later" && !isSaved);
      card.classList.toggle("fx-hide", hide);
      if (!hide) visible++;
    });

    /* estado vazio de Favoritos / Ler mais tarde */
    if (area) {
      const grid = area.querySelector(".book-grid");
      let empty = area.querySelector(".fx-empty");
      const needEmpty = grid && total > 0 && visible === 0 && (section === "favorites" || section === "later");
      if (grid) grid.classList.toggle("fx-hide", !!needEmpty);
      if (needEmpty && !empty) {
        empty = document.createElement("div");
        empty.className = "fx-empty";
        empty.innerHTML = "<strong>Nenhum livro nesta lista.</strong><p>Adicione títulos usando os botões de favorito ou ler mais tarde.</p>";
        area.appendChild(empty);
      }
      if (!needEmpty && empty) empty.remove();
    }

    /* página de detalhe */
    let detail = content.querySelector(":scope > .fx-detail");
    const book = openId !== null ? list.find((b) => Number(b.id) === openId) : null;
    if (openId !== null && !book) openId = null;
    if (book) {
      if (!detail) { detail = document.createElement("article"); detail.className = "fx-detail"; sb.after(detail); }
      setHtml(detail, detailHtml(book, favSet.has(book.id), savedSet.has(book.id)));
      content.classList.add("fx-detail-open");
    } else {
      if (detail) detail.remove();
      content.classList.remove("fx-detail-open");
    }
  }

  let working = false;
  function enhance() {
    if (working) return;
    working = true;
    observer.disconnect();
    try {
      skinStatic();
      const content = app.querySelector(".content");
      if (content && content.querySelector("#book-area")) enhanceCatalog(content);
      else { openId = null; }
    } catch (err) {
      console.error("[tema-figma]", err);
    } finally {
      working = false;
      observer.observe(app, { childList: true, subtree: true });
    }
  }

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => { queued = false; enhance(); });
  });

  enhance();
})();

// Shared auto-translate for BagIdea Office pop-out windows (Tools Hub, Plugins
// Hub, Workflow Builder). Thai is the source language; for any OTHER office
// language we pull cached translations from the daemon (/i18n) and ask it to
// fill in anything missing (Gemini, cached to disk → later harvested into the
// shipped seed). English keeps its hand-written copy in each window.
//
//   const WL = await WinLang.build(reg.lang);   // {lang, map, tr(s), ensure()}
//   el.textContent = WL.tr(thaiString);          // map[thai] || thai
//   WL.ensure(allThaiStrings, () => rerender()); // fill gaps, re-render live
window.WinLang = (function () {
  async function build(lang) {
    const self = { lang: lang || "th", map: {} };
    self.tr = (s) => (self.map[s] != null ? self.map[s] : s);
    if (self.lang === "th") { self.ensure = async () => {}; return self; }
    try {
      const r = await fetch("/i18n/all?lang=" + self.lang);
      self.map = (await r.json()).map || {};
    } catch {}
    // Ask the daemon to translate strings we don't have yet, then poll a few
    // times so background Gemini results get picked up and re-rendered live.
    self.ensure = async function (strings, onUpdate) {
      const want = [...new Set((strings || []).filter(Boolean).map(String))];
      const missing = () => want.filter((s) => !(s in self.map));
      if (!missing().length) return;
      try {
        await fetch("/i18n", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ lang: self.lang, strings: missing() }),
        });
      } catch {}
      for (let i = 0; i < 8 && missing().length; i++) {
        await new Promise((r) => setTimeout(r, 1300));
        try {
          const r = await fetch("/i18n/all?lang=" + self.lang);
          const m = (await r.json()).map || {};
          let upd = false;
          for (const s of want) if (m[s] != null && self.map[s] == null) { self.map[s] = m[s]; upd = true; }
          if (upd && onUpdate) onUpdate();
        } catch {}
      }
    };
    if (self.lang !== "th" && self.lang !== "en") autoDom(self);
    return self;
  }
  // 🇮🇹 Rete di sicurezza: traduce anche il testo già scritto nella pagina
  // (inglese incluso) quando coincide esattamente con una chiave della mappa.
  // I numeri dentro una frase diventano {n} nella chiave ("3 agenti" ↔ "{n} agents").
  const NUM = /\d+(?:[.,]\d+)*/g;
  function lookup(map, raw) {
    const key = raw.trim();
    if (!key) return null;
    if (map[key] != null && map[key] !== key) return raw.replace(key, map[key]);
    if (!/\d/.test(key)) return null;
    const nums = key.match(NUM) || [];
    const pat = key.replace(NUM, "{n}");
    if (map[pat] == null) return null;
    let i = 0;
    return raw.replace(key, String(map[pat]).replace(/\{n\}/g, () => (nums[i++] ?? "")));
  }
  function autoDom(self) {
    if (self._dom) return; self._dom = true;
    const run = (root) => {
      if (!root || !document.body) return;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const p = n.parentElement;
        if (!p || p.closest("script,style,textarea,code,pre,[contenteditable],input")) continue;
        let v = lookup(self.map, n.nodeValue);
        if (v != null && v !== n.nodeValue) {
          // il thai non ha spazi tra le parole: aggiungili attorno ai pezzi tradotti
          if (/[\u0E00-\u0E7F]/.test(n.nodeValue)) {
            const pv = n.previousSibling, nx = n.nextSibling;
            if (pv && /\S$/.test(pv.textContent || "") && !/^[\s)\].,:;·]/.test(v)) v = " " + v;
            if (nx && /^\S/.test(nx.textContent || "") && !/\s$/.test(v) && !/^[)\].,:;]/.test(nx.textContent)) v = v + " ";
          }
          n.nodeValue = v;
        }
      }
      const els = root.nodeType === 1 ? [root, ...root.querySelectorAll("[placeholder],[title]")] : [];
      for (const el of els) for (const a of ["placeholder", "title"]) {
        const cur = el.getAttribute && el.getAttribute(a);
        if (!cur) continue;
        const v = lookup(self.map, cur);
        if (v != null && v !== cur) el.setAttribute(a, v);
      }
    };
    const start = () => {
      run(document.body);
      new MutationObserver((ms) => { for (const m of ms) for (const nd of m.addedNodes) run(nd.nodeType === 1 ? nd : nd.parentNode); })
        .observe(document.body, { childList: true, subtree: true, characterData: true });
      setInterval(() => { if (!document.hidden) run(document.body); }, 1500);
    };
    if (document.body) start(); else addEventListener("DOMContentLoaded", start);
  }
  return { build: build };
})();

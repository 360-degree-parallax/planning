/* 노아 페이지 — 테마 적용 후 노아를 붙인다. */
(function(){ try { window.P && window.P.theme && window.P.theme(); } catch (e) {} const el = document.getElementById('noah'); if (el && window.NOAH) window.NOAH.mount(el); })();

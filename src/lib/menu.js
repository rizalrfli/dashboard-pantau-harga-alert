// src/lib/menu.js — menu hamburger mobile + tombol logout.
//
// Dipakai oleh BaseLayout (semua halaman ber-shell). Logika disalin dari
// blok menu yang sebelumnya diduplikasi di tiap halaman.
import { logout } from "./auth.js";

export function initMenu() {
  const menuBtn = document.querySelector("#menuBtn");
  if (!menuBtn) return;
  function closeMenu() {
    document.body.classList.remove("menu-open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Buka menu");
  }
  menuBtn.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
    if (open) {
      const first = document.querySelector("#siteNav a, #siteNav button");
      if (first) first.focus();
    } else {
      menuBtn.focus();
    }
  });
  document.querySelectorAll("#siteNav a, #siteNav button").forEach((el) =>
    el.addEventListener("click", () => {
      closeMenu();
    })
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

// Semua tombol dengan [data-logout] (sidebar + topbar) menjalankan logout().
export function initLogout() {
  document.querySelectorAll("[data-logout]").forEach((el) =>
    el.addEventListener("click", logout)
  );
}

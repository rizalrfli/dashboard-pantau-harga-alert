// @ts-check
import { defineConfig } from "astro/config";

// Output statis, satu file HTML per halaman (format: 'file') — URL yang
// dihasilkan sama persis dengan situs lama (index.html, analisa.html,
// whale.html, login.html). /api/* tetap jadi Vercel Serverless Functions
// (tidak butuh adapter — adapter Vercel hanya untuk SSR).
export default defineConfig({
  build: { format: "file" },
});

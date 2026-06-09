# MobiGlass TELOS

Application de gestion de corporation Star Citizen — Stanton Trade System.

## Structure

```
mobiglass-telos/
├── index.html          ← HTML : structure, topbar, sidebar, panels, modals
├── src/
│   ├── style.css       ← CSS complet (~1400 lignes)
│   └── main.js         ← JS complet (~8500 lignes)
├── vite.config.js      ← Config Vite
├── vercel.json         ← Config déploiement Vercel
└── package.json
```

## Développement local

```bash
npm install
npm run dev
# → http://localhost:5173
```

## Déploiement

Push sur GitHub → Vercel build automatiquement avec `npm run build`.

## Backend

Supabase — table `telos_store` (key TEXT PRIMARY KEY, value JSONB).

# Vocab Review — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une PWA installable sur iPhone qui récupère les traductions enregistrées dans Google Translate (via l'export Google Sheets et l'API Drive) et les fait réviser en flashcards à répétition espacée, dans les deux sens.

**Architecture:** App statique Vite + Preact + TypeScript, sans serveur, hébergée sur GitHub Pages. La logique métier (`src/domain/`) est faite de fonctions pures testées avec Vitest. Le stockage (IndexedDB), Google (OAuth par redirection + Drive) et l'orchestration de la synchro sont des modules séparés, eux aussi testés. L'interface Preact les assemble.

**Tech Stack:** Vite 8, Preact 10, TypeScript 6, vite-plugin-pwa 1.3 (+ @vite-pwa/assets-generator), ts-fsrs 5, idb 8, papaparse 5, Vitest 5, fake-indexeddb 6, GitHub Actions / Pages.

**Spec:** `docs/superpowers/specs/2026-09-27-vocab-review-design.md`

**Comment ce plan a été préparé :** tout le code ci-dessous a d'abord été écrit et exécuté dans un projet jetable. Les 88 tests passent, `tsc` et le build aussi, et l'interface a été vérifiée dans un navigateur au format iPhone. Les tâches 1 et 4 ont aussi été vérifiées dans leur état intermédiaire. Recopier le code tel quel ; si un test échoue, c'est un signal à investiguer, pas à contourner.

**Étapes avec l'utilisateur :** les tâches 2, 4 et 14 contiennent des étapes marquées **[Avec l'utilisateur]** (compte GitHub, Google Cloud, test sur iPhone). Un sous-agent ne peut pas les faire seul : il s'arrête et rend la main au contrôleur, qui relaie à l'utilisateur.

## Global Constraints

- Dossier du projet : `~/Dev/vocab-review` (dépôt git existant, branche `main`, contient déjà la spec).
- Node ≥ 20 en local (Node 24 installé), Node 24 en CI.
- Versions : celles du `package.json` de la tâche 1 (preact ^10.29.8, vite ^8.3.0, vite-plugin-pwa ^1.3.0, vitest ^5.0.2, ts-fsrs ^5.4.2, idb ^8.0.3, papaparse ^5.7.0, fake-indexeddb ^6.2.5, typescript ~6.0.2).
- TypeScript : `strict` (par défaut en TS 6), `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (imports de types avec `import type`), `erasableSyntaxOnly` (pas d'`enum` ni de propriétés déclarées dans les paramètres d'un constructeur).
- Base Vite : `/vocab-review/`. URL de prod : `https://<compte>.github.io/vocab-review/`. En local : `http://localhost:5173/vocab-review/`.
- Scope OAuth unique : `https://www.googleapis.com/auth/drive.readonly`. Flux `response_type=token` par **redirection pleine page**, jamais de popup.
- Jeton Google en mémoire uniquement. Le `state` OAuth et l'indicateur « synchro en attente » vont dans `localStorage` et sont effacés au retour.
- `src/domain/*` n'accède ni au réseau, ni au stockage, ni à l'horloge : `now` est toujours passé en paramètre.
- ts-fsrs avec `enable_short_term: false`. « Pas su » = `Rating.Again`, « Su » = `Rating.Good`. Seule la première réponse à une carte dans une session la replanifie.
- Jour d'étude : bascule à 4 h du matin, heure locale.
- Nouvelles cartes par jour : 10 par défaut, entre 0 et 100.
- Toute écriture de plusieurs objets (synchro, restauration) passe par une seule transaction IndexedDB. Aucune erreur de synchro ne modifie les données.
- Interface et messages en français, avec les textes exacts de `src/ui/messages.ts`.
- Commits : message en français, suivi de la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Connexion Google depuis la PWA installée sur iPhone.** Après la page Google, on doit revenir dans l'app avec le jeton, pas atterrir dans Safari ni voir « Connexion interrompue ». Vérifié à la main à la tâche 4, étape 8.
- **Même expression enregistrée dans les deux sens** (EN→FR et FR→EN) dans Google Translate. On attend un seul mot, sans traduction en double. Test ajouté à la tâche 12 : « ne crée qu'un mot pour une expression enregistrée dans les deux sens ».
- **Mauvais tap sur la dernière carte d'une session.** On doit pouvoir annuler depuis l'écran de fin. Test ajouté à la tâche 9 (« permet d'annuler la dernière réponse d'une session terminée »), et bouton vérifié à la tâche 13.
- **Phrases longues** (Google Translate enregistre des phrases entières). Le texte doit rester lisible, la carte défiler, et les boutons rester visibles. Vérifié à la tâche 13 avec une phrase de 100 caractères.
- **Premier lancement, base vide.** L'accueil affiche 0 et 0, « Rien à réviser » et « Jamais synchronisé », sans erreur. Vérifié à la tâche 13, étape 6.

## Structure des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `public/logo.svg`, `src/vite-env.d.ts` | Projet, build, PWA, icônes | 1 |
| `.github/workflows/deploy.yml` | Tests + build + publication sur GitHub Pages | 2 |
| `docs/google-cloud-setup.md`, `.env` | Guide Google Cloud, ID client OAuth | 2 |
| `src/google/auth.ts` | URL d'autorisation, lecture du retour, validité du jeton | 3 |
| `src/test/memoryStorage.ts` | Faux `localStorage` pour les tests | 3 |
| `src/google/drive.ts` | Recherche du dernier export, export CSV | 4 |
| `src/config.ts` | ID client, noms de fichier d'export, URI de retour | 4 |
| `src/ui/Diagnostic.tsx` | Écran provisoire de test de connexion (supprimé tâche 13) | 4 |
| `src/domain/types.ts`, `src/domain/keys.ts` | Types et normalisation | 5 |
| `src/domain/csv.ts` | Lecture de l'export | 5 |
| `src/domain/scheduler.ts`, `src/domain/studyDay.ts` | FSRS et jour d'étude | 6 |
| `src/test/builders.ts` | Fabriques de mots et de cartes pour les tests | 7 |
| `src/domain/merge.ts` | Fusion d'un export | 7 |
| `src/domain/queue.ts` | File de la prochaine session | 8 |
| `src/domain/session.ts` | Déroulement d'une session | 9 |
| `src/storage/db.ts` | IndexedDB | 10 |
| `src/storage/backup.ts` | Sauvegarde JSON | 11 |
| `src/sync.ts`, `src/ui/messages.ts` | Synchro de bout en bout, textes | 12 |
| `src/ui/App.tsx`, `Home.tsx`, `Review.tsx`, `Settings.tsx`, `share.ts`, `src/styles.css`, `src/main.tsx` | Interface | 13 |

---

### Task 1 : Squelette du projet

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `public/logo.svg`, `src/vite-env.d.ts`, `src/main.tsx`, `.gitignore`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `npm test` (Vitest, passe sans fichier de test) ;
  - `npm run build` (tsc + Vite, qui génère `dist/` avec le service worker, le manifest et les icônes) ;
  - `npm run dev`, qui sert l'app sur `http://localhost:5173/vocab-review/` ;
  - le type `ImportMetaEnv.VITE_GOOGLE_CLIENT_ID?: string`.

- [ ] **Step 1 : Écrire `package.json`**

```json
{
  "name": "vocab-review",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "idb": "^8.0.3",
    "papaparse": "^5.7.0",
    "preact": "^10.29.8",
    "ts-fsrs": "^5.4.2"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.10.6",
    "@types/node": "^24.13.3",
    "@types/papaparse": "^5.5.2",
    "@vite-pwa/assets-generator": "^1.0.4",
    "fake-indexeddb": "^6.2.5",
    "typescript": "~6.0.2",
    "vite": "^8.3.0",
    "vite-plugin-pwa": "^1.3.0",
    "vitest": "^5.0.2"
  }
}
```

- [ ] **Step 2 : Écrire les trois fichiers TypeScript**

`tsconfig.json` :

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json` :

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "module": "esnext",
    "lib": ["ES2023", "DOM"],
    "types": ["vite/client"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,
    "paths": {
      "react": ["./node_modules/preact/compat/"],
      "react-dom": ["./node_modules/preact/compat/"]
    },

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json` :

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,

    /* Bundler mode */
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3 : Écrire la config Vite (PWA et icônes générées depuis le logo)**

`vite.config.ts` :

```ts
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/vocab-review/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: {
        image: 'public/logo.svg',
        preset: 'minimal-2023',
        includeHtmlHeadLinks: true,
        overrideManifestIcons: true,
      },
      manifest: {
        name: 'Vocab Review',
        short_name: 'Vocab',
        description: 'Révision du vocabulaire anglais enregistré dans Google Translate',
        lang: 'fr',
        display: 'standalone',
        theme_color: '#1f6feb',
        background_color: '#ffffff',
      },
    }),
  ],
})
```

`index.html` (les liens d'icônes et le `theme-color` sont injectés par le plugin PWA) :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Vocab" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <title>Vocab Review</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`public/logo.svg` :

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#1f6feb"/>
  <rect x="140" y="132" width="232" height="168" rx="24" fill="#ffffff" opacity="0.45" transform="rotate(-10 256 216)"/>
  <rect x="140" y="188" width="232" height="192" rx="24" fill="#ffffff"/>
  <rect x="180" y="244" width="152" height="22" rx="11" fill="#1f6feb"/>
  <rect x="180" y="298" width="104" height="22" rx="11" fill="#9dbdf5"/>
</svg>
```

`src/vite-env.d.ts` :

```ts
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
}
```

`src/main.tsx` (provisoire) :

```tsx
import { render } from 'preact'

render(
  <main style={{ fontFamily: '-apple-system, sans-serif', padding: '24px' }}>Vocab Review — en construction</main>,
  document.getElementById('app')!,
)
```

`.gitignore` :

```text
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

- [ ] **Step 4 : Installer**

Run: `npm install`
Expected: installation sans erreur, `package-lock.json` créé.

- [ ] **Step 5 : Vérifier les tests et le build**

Run: `npm test`
Expected: « No test files found, exiting with code 0 ».

Run: `npm run build`
Expected: se termine par `files generated … dist/sw.js`, sans erreur TypeScript.

Run: `grep -c apple-touch-icon dist/index.html && cat dist/manifest.webmanifest`
Expected: `1`, puis un manifest avec `"start_url":"/vocab-review/"`, `"scope":"/vocab-review/"` et 4 icônes.

- [ ] **Step 6 : Commit**

```bash
git add .
git commit -m "Squelette Vite + Preact + PWA" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Déploiement GitHub Pages et projet Google Cloud

**Files:**
- Create: `.github/workflows/deploy.yml`, `docs/google-cloud-setup.md`, `.env`

**Interfaces:**
- Consumes: les scripts `npm test` et `npm run build` de la tâche 1.
- Produces :
  - l'app en ligne sur `https://<compte>.github.io/vocab-review/`, redéployée à chaque push sur `main` ;
  - `.env` avec `VITE_GOOGLE_CLIENT_ID=<ID client>`, lu par `src/config.ts` à la tâche 4.

- [ ] **Step 1 : Écrire le workflow de déploiement**

`.github/workflows/deploy.yml` :

```yaml
name: Déploiement

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2 : Écrire le guide Google Cloud**

`docs/google-cloud-setup.md` :

```markdown
# Mise en place Google Cloud (une seule fois, environ 15 min)

Remplace `<compte>` par ton nom d'utilisateur GitHub.

1. Ouvre https://console.cloud.google.com/ et crée un projet nommé « vocab-review ».
2. Menu → API et services → Bibliothèque → « Google Drive API » → **Activer**.
3. Menu → Google Auth Platform → **Commencer** :
   - nom de l'application : Vocab Review ; e-mail d'assistance : ton adresse ;
   - audience : **Externe** ; coordonnées : ton adresse → Créer.
4. Google Auth Platform → **Audience** → Utilisateurs test → **Ajouter des utilisateurs** → ton adresse Gmail.
   Laisse le statut de publication sur **Test**.
5. Google Auth Platform → **Accès aux données** → Ajouter ou supprimer des champs d'application →
   coche `https://www.googleapis.com/auth/drive.readonly` → Mettre à jour → Enregistrer.
6. Google Auth Platform → **Clients** → Créer un client → type **Application Web**, nom « Vocab Review » :
   - origines JavaScript autorisées : `https://<compte>.github.io` et `http://localhost:5173` ;
   - URI de redirection autorisés : `https://<compte>.github.io/vocab-review/` et `http://localhost:5173/vocab-review/`
     (avec la barre oblique finale) ;
   - Créer, puis copie l'**ID client** (il finit par `.apps.googleusercontent.com`).

L'ID client n'est pas un secret : il est enregistré dans le fichier `.env` du dépôt.
À la première connexion, Google affiche « Google n'a pas validé cette application » :
c'est normal en mode Test. Choisis Continuer.
```

- [ ] **Step 3 : Commit**

```bash
git add .github/workflows/deploy.yml docs/google-cloud-setup.md
git commit -m "Déploiement GitHub Pages et guide Google Cloud" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4 : [Avec l'utilisateur] Créer le dépôt GitHub**

Demander à l'utilisateur son nom de compte GitHub (`<compte>` dans la suite), puis lui faire faire :
1. https://github.com/new → nom `vocab-review`, visibilité **Public** (GitHub Pages gratuit), sans README → Create.
2. Dans le dépôt : Settings → Pages → Build and deployment → Source : **GitHub Actions**.

- [ ] **Step 5 : [Avec l'utilisateur] Projet Google Cloud**

L'utilisateur suit `docs/google-cloud-setup.md` et donne l'ID client.

- [ ] **Step 6 : Enregistrer l'ID client**

Créer `.env` avec l'ID client fourni. Il ne faut jamais en inventer un.

```bash
printf 'VITE_GOOGLE_CLIENT_ID=%s\n' '<ID client fourni>' > .env
git add .env
git commit -m "ID client OAuth Google" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7 : Publier (demander d'abord l'accord de l'utilisateur pour pousser)**

```bash
git remote add origin https://github.com/<compte>/vocab-review.git
git push -u origin main
```

Si le push demande une authentification, c'est à l'utilisateur de la faire.

- [ ] **Step 8 : Vérifier le déploiement**

- Dans l'onglet Actions du dépôt, le workflow « Déploiement » doit être vert.
- Ouvrir `https://<compte>.github.io/vocab-review/` : on doit voir « Vocab Review — en construction ».

---

### Task 3 : Connexion Google (flux par redirection)

**Files:**
- Create: `src/test/memoryStorage.ts`, `src/google/auth.ts`
- Test: `src/google/auth.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces (`src/google/auth.ts`) :
  - `DRIVE_SCOPE: string`
  - `type Token = { accessToken: string; expiresAt: number }`
  - `type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`
  - `type RedirectOutcome = { kind: 'none' } | { kind: 'token'; token: Token; resumeSync: boolean } | { kind: 'error'; error: 'auth-denied' | 'auth-failed' | 'state-mismatch' }`
  - `buildAuthUrl(req: { clientId: string; redirectUri: string; state: string }): string`
  - `beginAuth(req, storage: AuthStorage): string`, qui renvoie l'URL vers laquelle faire `location.assign`
  - `consumeRedirect(hash: string, storage: AuthStorage, nowMs: number): RedirectOutcome`
  - `usableToken(token: Token | null, nowMs: number): string | null`
- Produces (`src/test/memoryStorage.ts`) : `memoryStorage(initial?: Record<string, string>): AuthStorage & { data: Map<string, string> }`

- [ ] **Step 1 : Écrire le faux stockage et les tests**

`src/test/memoryStorage.ts` :

```ts
import type { AuthStorage } from '../google/auth'

export function memoryStorage(initial: Record<string, string> = {}): AuthStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}
```

`src/google/auth.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/memoryStorage'
import { beginAuth, buildAuthUrl, consumeRedirect, DRIVE_SCOPE, usableToken } from './auth'

const request = { clientId: 'client-123', redirectUri: 'https://me.github.io/vocab-review/', state: 'abc' }

describe('auth Google', () => {
  it('construit l’URL d’autorisation en flux « token »', () => {
    const url = new URL(buildAuthUrl(request))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-123',
      redirect_uri: 'https://me.github.io/vocab-review/',
      response_type: 'token',
      scope: DRIVE_SCOPE,
      include_granted_scopes: 'true',
      state: 'abc',
    })
  })

  it('mémorise le state et la synchro en attente avant de rediriger', () => {
    const storage = memoryStorage()
    expect(beginAuth(request, storage)).toBe(buildAuthUrl(request))
    expect(Object.fromEntries(storage.data)).toEqual({ 'vocab-review.oauth-state': 'abc', 'vocab-review.pending-sync': '1' })
  })

  it('ignore une URL sans retour Google', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc' })
    expect(consumeRedirect('', storage, 0)).toEqual({ kind: 'none' })
    expect(consumeRedirect('#section', storage, 0)).toEqual({ kind: 'none' })
    expect(storage.data.size).toBe(1)
  })

  it('récupère le jeton, calcule son expiration et nettoie le stockage', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc', 'vocab-review.pending-sync': '1' })
    const outcome = consumeRedirect('#state=abc&access_token=tok&token_type=Bearer&expires_in=3599', storage, 1_000)
    expect(outcome).toEqual({ kind: 'token', token: { accessToken: 'tok', expiresAt: 3_600_000 }, resumeSync: true })
    expect(storage.data.size).toBe(0)
  })

  it('signale un state différent de celui envoyé', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc' })
    expect(consumeRedirect('#state=evil&access_token=tok', storage, 0)).toEqual({ kind: 'error', error: 'state-mismatch' })
    expect(consumeRedirect('#state=abc&access_token=tok', memoryStorage(), 0)).toEqual({ kind: 'error', error: 'state-mismatch' })
  })

  it('distingue le refus de l’utilisateur des autres erreurs Google', () => {
    const denied = consumeRedirect('#state=abc&error=access_denied', memoryStorage({ 'vocab-review.oauth-state': 'abc' }), 0)
    const other = consumeRedirect('#state=abc&error=invalid_scope', memoryStorage({ 'vocab-review.oauth-state': 'abc' }), 0)
    expect(denied).toEqual({ kind: 'error', error: 'auth-denied' })
    expect(other).toEqual({ kind: 'error', error: 'auth-failed' })
  })

  it('n’utilise plus un jeton qui expire dans moins d’une minute', () => {
    const token = { accessToken: 'tok', expiresAt: 100_000 }
    expect(usableToken(token, 39_999)).toBe('tok')
    expect(usableToken(token, 40_000)).toBeNull()
    expect(usableToken(null, 0)).toBeNull()
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run: `npx vitest run src/google/auth.test.ts`
Expected: FAIL, avec « Failed to resolve import "./auth" ».

- [ ] **Step 3 : Implémenter**

`src/google/auth.ts` :

```ts
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const STATE_KEY = 'vocab-review.oauth-state'
const PENDING_KEY = 'vocab-review.pending-sync'

export type Token = { accessToken: string; expiresAt: number }
export type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type RedirectOutcome =
  | { kind: 'none' }
  | { kind: 'token'; token: Token; resumeSync: boolean }
  | { kind: 'error'; error: 'auth-denied' | 'auth-failed' | 'state-mismatch' }

type AuthRequest = { clientId: string; redirectUri: string; state: string }

export function buildAuthUrl({ clientId, redirectUri, state }: AuthRequest): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: DRIVE_SCOPE,
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/** Mémorise le `state` et la synchro en attente, puis renvoie l'URL Google où rediriger. */
export function beginAuth(request: AuthRequest, storage: AuthStorage): string {
  storage.setItem(STATE_KEY, request.state)
  storage.setItem(PENDING_KEY, '1')
  return buildAuthUrl(request)
}

/** Lit le retour de Google dans le fragment d'URL (`#access_token=…` ou `#error=…`). */
export function consumeRedirect(hash: string, storage: AuthStorage, nowMs: number): RedirectOutcome {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (!params.has('access_token') && !params.has('error')) return { kind: 'none' }

  const expected = storage.getItem(STATE_KEY)
  const resumeSync = storage.getItem(PENDING_KEY) === '1'
  storage.removeItem(STATE_KEY)
  storage.removeItem(PENDING_KEY)

  if (!expected || params.get('state') !== expected) return { kind: 'error', error: 'state-mismatch' }
  const error = params.get('error')
  if (error) return { kind: 'error', error: error === 'access_denied' ? 'auth-denied' : 'auth-failed' }

  const expiresIn = Number(params.get('expires_in') ?? '3600')
  return {
    kind: 'token',
    token: { accessToken: params.get('access_token') ?? '', expiresAt: nowMs + expiresIn * 1000 },
    resumeSync,
  }
}

/** Jeton utilisable s'il reste plus d'une minute avant son expiration. */
export function usableToken(token: Token | null, nowMs: number): string | null {
  return token && token.expiresAt - 60_000 > nowMs ? token.accessToken : null
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run: `npx vitest run src/google/auth.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/test/memoryStorage.ts src/google/auth.ts src/google/auth.test.ts
git commit -m "Connexion Google par redirection OAuth" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Client Drive et test de connexion sur iPhone

C'est le point de risque n°1 de la spec : on vérifie sur le vrai iPhone, avant de construire le reste, que la connexion Google revient bien dans l'app installée. On en profite pour relever le nom exact du fichier d'export et quelques lignes du CSV.

**Files:**
- Create: `src/google/drive.ts`, `src/config.ts`, `src/ui/Diagnostic.tsx`
- Modify: `src/main.tsx` (remplacé)
- Test: `src/google/drive.test.ts`

**Interfaces:**
- Consumes: `beginAuth`, `consumeRedirect` (tâche 3) ; `VITE_GOOGLE_CLIENT_ID` (tâche 2).
- Produces (`src/google/drive.ts`) :
  - `type DriveFile = { id: string; name: string; modifiedTime: string }`
  - `type DriveApi = { findLatestExport(token: string): Promise<DriveFile | null>; exportCsv(token: string, fileId: string): Promise<string> }`
  - `class DriveError extends Error { readonly status: number }`
  - `exportQuery(names: string[]): string`
  - `createDriveApi(names: string[], fetchFn?: (input: string, init?: RequestInit) => Promise<Response>): DriveApi`
- Produces (`src/config.ts`) : `GOOGLE_CLIENT_ID: string`, `EXPORT_FILE_NAMES: string[]`, `redirectUri(): string`

- [ ] **Step 1 : Écrire les tests Drive**

`src/google/drive.test.ts` :

```ts
import { describe, expect, it, vi } from 'vitest'
import { createDriveApi, DriveError, exportQuery } from './drive'

const names = ['Saved translations', "L'export"]
const reply = (status: number, body: string) => new Response(body, { status })

describe('Drive', () => {
  it('cherche la feuille d’export la plus récente par nom', async () => {
    const file = { id: 'f1', name: 'Saved translations', modifiedTime: '2026-09-27T09:00:00.000Z' }
    const fetchFn = vi.fn(async () => reply(200, JSON.stringify({ files: [file] })))
    const drive = createDriveApi(names, fetchFn)

    expect(await drive.findLatestExport('tok')).toEqual(file)

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    const params = new URL(url).searchParams
    expect(url.startsWith('https://www.googleapis.com/drive/v3/files?')).toBe(true)
    expect(params.get('q')).toBe(exportQuery(names))
    expect(params.get('orderBy')).toBe('modifiedTime desc')
    expect(params.get('pageSize')).toBe('1')
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' })
  })

  it('échappe les apostrophes dans la requête', () => {
    expect(exportQuery(["L'export"])).toBe(
      "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (name contains 'L\\'export')",
    )
  })

  it('renvoie null quand aucune feuille ne correspond', async () => {
    const drive = createDriveApi(names, async () => reply(200, JSON.stringify({ files: [] })))
    expect(await drive.findLatestExport('tok')).toBeNull()
  })

  it('exporte la feuille en CSV', async () => {
    const fetchFn = vi.fn(async () => reply(200, 'English,French,reach,atteindre\n'))
    const drive = createDriveApi(names, fetchFn)
    expect(await drive.exportCsv('tok', 'f/1')).toBe('English,French,reach,atteindre\n')
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://www.googleapis.com/drive/v3/files/f%2F1/export?mimeType=text%2Fcsv',
    )
  })

  it('lève une DriveError avec le code HTTP en cas d’échec', async () => {
    const drive = createDriveApi(names, async () => reply(401, 'nope'))
    await expect(drive.findLatestExport('tok')).rejects.toEqual(new DriveError(401))
    await expect(drive.exportCsv('tok', 'f1')).rejects.toMatchObject({ status: 401 })
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run: `npx vitest run src/google/drive.test.ts`
Expected: FAIL, avec « Failed to resolve import "./drive" ».

- [ ] **Step 3 : Implémenter le client Drive**

`src/google/drive.ts` :

```ts
export type DriveFile = { id: string; name: string; modifiedTime: string }

export type DriveApi = {
  /** Feuille d'export Google Translate la plus récente, ou null s'il n'y en a pas. */
  findLatestExport(token: string): Promise<DriveFile | null>
  /** Contenu CSV du premier onglet de la feuille. */
  exportCsv(token: string, fileId: string): Promise<string>
}

export class DriveError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`Google Drive a répondu ${status}`)
    this.name = 'DriveError'
    this.status = status
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

const API = 'https://www.googleapis.com/drive/v3/files'
const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export function exportQuery(names: string[]): string {
  const byName = names.map((n) => `name contains ${quote(n)}`).join(' or ')
  return `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (${byName})`
}

export function createDriveApi(names: string[], fetchFn: Fetch = (input, init) => fetch(input, init)): DriveApi {
  async function get(url: string, token: string): Promise<Response> {
    const response = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) throw new DriveError(response.status)
    return response
  }

  return {
    async findLatestExport(token) {
      const params = new URLSearchParams({
        q: exportQuery(names),
        orderBy: 'modifiedTime desc',
        pageSize: '1',
        fields: 'files(id,name,modifiedTime)',
      })
      const body = (await (await get(`${API}?${params}`, token)).json()) as { files?: DriveFile[] }
      return body.files?.[0] ?? null
    },
    async exportCsv(token, fileId) {
      const response = await get(`${API}/${encodeURIComponent(fileId)}/export?mimeType=text%2Fcsv`, token)
      return response.text()
    },
  }
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run: `npx vitest run src/google/drive.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5 : Config et écran de diagnostic**

`src/config.ts` :

```ts
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** Noms possibles de la feuille créée par « Exporter vers Google Sheets ». */
export const EXPORT_FILE_NAMES = ['Saved translations', 'Traductions enregistrées']

/** Adresse de retour OAuth : la racine de l'app, en local comme sur GitHub Pages. */
export function redirectUri(): string {
  return `${location.origin}${import.meta.env.BASE_URL}`
}
```

`src/ui/Diagnostic.tsx` :

```tsx
import { useEffect, useState } from 'preact/hooks'
import { EXPORT_FILE_NAMES, GOOGLE_CLIENT_ID, redirectUri } from '../config'
import { beginAuth, consumeRedirect } from '../google/auth'
import { createDriveApi } from '../google/drive'

/** Écran provisoire (tâche 4) : vérifie la connexion Google et montre le début du dernier export. */
export function Diagnostic() {
  const [lines, setLines] = useState<string[]>(['Pas encore testé.'])

  useEffect(() => {
    const outcome = consumeRedirect(location.hash, localStorage, Date.now())
    if (outcome.kind === 'none') return
    history.replaceState(null, '', location.pathname + location.search)
    if (outcome.kind === 'error') setLines([`Erreur : ${outcome.error}`])
    else void inspect(outcome.token.accessToken)
  }, [])

  async function inspect(token: string) {
    setLines(['Connecté. Recherche de l’export…'])
    try {
      const file = await createDriveApi(EXPORT_FILE_NAMES).findLatestExport(token)
      if (file) {
        const csv = await createDriveApi(EXPORT_FILE_NAMES).exportCsv(token, file.id)
        setLines([`Fichier : ${file.name}`, `Modifié : ${file.modifiedTime}`, '— 5 premières lignes —', ...csv.split('\n').slice(0, 5)])
        return
      }
      const params = new URLSearchParams({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        orderBy: 'modifiedTime desc',
        pageSize: '5',
        fields: 'files(name,modifiedTime)',
      })
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = (await response.json()) as { files?: { name: string; modifiedTime: string }[] }
      setLines(['Aucun export trouvé avec les noms connus. Feuilles récentes :', ...(body.files ?? []).map((f) => `${f.name} (${f.modifiedTime})`)])
    } catch (error) {
      setLines([`Erreur : ${String(error)}`])
    }
  }

  function connect() {
    const request = { clientId: GOOGLE_CLIENT_ID, redirectUri: redirectUri(), state: crypto.randomUUID() }
    location.assign(beginAuth(request, localStorage))
  }

  return (
    <main style={{ fontFamily: '-apple-system, sans-serif', padding: 'calc(env(safe-area-inset-top) + 16px) 16px' }}>
      <h1>Test de connexion</h1>
      <button style={{ fontSize: '1.1rem', padding: '14px 20px' }} onClick={connect}>
        Se connecter à Google
      </button>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{lines.join('\n')}</pre>
    </main>
  )
}
```

`src/main.tsx` (remplace la version provisoire) :

```tsx
import { render } from 'preact'
import { Diagnostic } from './ui/Diagnostic'

render(<Diagnostic />, document.getElementById('app')!)
```

- [ ] **Step 6 : Vérifier le build**

Run: `npm test && npm run build`
Expected: 12 tests PASS, build sans erreur.

- [ ] **Step 7 : Commit et publication**

```bash
git add src/google/drive.ts src/google/drive.test.ts src/config.ts src/ui/Diagnostic.tsx src/main.tsx
git commit -m "Client Drive et écran de test de connexion" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

Attendre que le workflow « Déploiement » soit vert.

- [ ] **Step 8 : [Avec l'utilisateur] Test sur iPhone**

Faire faire à l'utilisateur :
1. Sur un ordinateur : translate.google.com → **Enregistrées** → **Exporter vers Google Sheets**.
2. Sur l'iPhone, dans Safari : ouvrir `https://<compte>.github.io/vocab-review/` → Partager → **Sur l'écran d'accueil**.
3. Ouvrir l'app **depuis l'icône** (pas depuis Safari) → « Se connecter à Google » → choisir le compte → Continuer (écran « non vérifiée ») → Autoriser.
4. Noter ce qui s'affiche au retour, idéalement avec une capture d'écran.

Résultats possibles :
- **« Fichier : … » puis 5 lignes** : la connexion fonctionne. Relever :
  - le nom du fichier ;
  - les libellés de langue des colonnes 1 et 2 ;
  - s'il y a une ligne d'en-tête ;
  - le nombre de colonnes.
- **« Aucun export trouvé avec les noms connus. Feuilles récentes : … »** : la connexion fonctionne, mais le nom du fichier est différent. Ajouter le nom affiché à `EXPORT_FILE_NAMES` dans `src/config.ts`, commiter (« Nom du fichier d'export »), pousser, puis refaire l'étape 3.
- **Le retour s'ouvre dans Safari au lieu de l'app, ou affiche « Erreur : state-mismatch »** : la connexion par redirection ne marche pas dans la PWA iOS. **Arrêter le plan** et en discuter avec l'utilisateur. La solution de repli prévue par la spec est l'import CSV manuel ; elle n'est pas dans ce plan.

---

### Task 5 : Types du domaine et lecture de l'export CSV

**Files:**
- Create: `src/domain/types.ts`, `src/domain/keys.ts`, `src/domain/csv.ts`
- Test: `src/domain/keys.test.ts`, `src/domain/csv.test.ts`

**Interfaces:**
- Consumes: le format relevé à la tâche 4, étape 8.
- Produces (`src/domain/types.ts`) :
  - `CardDirection`, `WordStatus`, `Grade = 'su' | 'pas-su'` ;
  - `Word`, `FsrsState`, `StoredCard`, `Settings`, `DEFAULT_SETTINGS`, `SyncMeta`, `Pair = { en: string; fr: string }` (définitions exactes ci-dessous).
- Produces (`src/domain/keys.ts`) : `normalizeText(text: string): string`, `cardId(wordKey: string, direction: CardDirection): string`
- Produces (`src/domain/csv.ts`) : `type ParseResult = { pairs: Pair[]; skipped: number }`, `parseExport(csvText: string): ParseResult`

- [ ] **Step 1 : Écrire les types**

`src/domain/types.ts` :

```ts
export type CardDirection = 'en-fr' | 'fr-en'
export type WordStatus = 'actif' | 'retiré'
export type Grade = 'su' | 'pas-su'

export type Word = {
  key: string
  en: string
  fr: string[]
  status: WordStatus
  addedAt: string
  order: number
}

/** État ts-fsrs sérialisable en JSON (dates au format ISO). */
export type FsrsState = {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: string
}

export type StoredCard = {
  id: string
  wordKey: string
  direction: CardDirection
  fsrs: FsrsState
  introducedAt?: string
}

export type Settings = { newPerDay: number }
export const DEFAULT_SETTINGS: Settings = { newPerDay: 10 }

export type SyncMeta = { fileId: string; modifiedTime: string; syncedAt: string }

export type Pair = { en: string; fr: string }
```

- [ ] **Step 2 : Écrire les tests**

`src/domain/keys.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { cardId, normalizeText } from './keys'

describe('keys', () => {
  it('normalise casse, espaces et forme Unicode', () => {
    expect(normalizeText('  To   Cope With ')).toBe('to cope with')
    expect(normalizeText('Café')).toBe(normalizeText('Café'))
  })

  it('construit l’identifiant d’une carte à partir du mot et du sens', () => {
    expect(cardId('reach', 'fr-en')).toBe('reach:fr-en')
  })
})
```

`src/domain/csv.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { parseExport } from './csv'

describe('parseExport', () => {
  it('lit une paire anglais → français', () => {
    expect(parseExport('English,French,reach,atteindre\n')).toEqual({
      pairs: [{ en: 'reach', fr: 'atteindre' }],
      skipped: 0,
    })
  })

  it('remet une paire français → anglais dans le sens EN/FR', () => {
    expect(parseExport('French,English,atteindre,reach\n').pairs).toEqual([{ en: 'reach', fr: 'atteindre' }])
  })

  it('reconnaît les noms de langue en français, avec ou sans accents ni majuscules', () => {
    const csv = 'Anglais,Français,reach,atteindre\nfrancais,ANGLAIS,parvenir,achieve\n'
    expect(parseExport(csv).pairs).toEqual([
      { en: 'reach', fr: 'atteindre' },
      { en: 'achieve', fr: 'parvenir' },
    ])
  })

  it('gère les guillemets, virgules et retours à la ligne dans les champs', () => {
    const csv = 'English,French,"well, actually","eh bien, en fait"\nEnglish,French,"line one\nline two","ligne un\nligne deux"\n'
    expect(parseExport(csv).pairs).toEqual([
      { en: 'well, actually', fr: 'eh bien, en fait' },
      { en: 'line one\nline two', fr: 'ligne un\nligne deux' },
    ])
  })

  it('ignore une ligne d’en-tête, les autres langues et les textes vides, en les comptant', () => {
    const csv = [
      'Source language,Target language,Source text,Translation',
      'Spanish,French,hola,bonjour',
      'English,French,,vide',
      'English,French,reach,atteindre',
    ].join('\n')
    expect(parseExport(csv)).toEqual({ pairs: [{ en: 'reach', fr: 'atteindre' }], skipped: 3 })
  })

  it('ignore les lignes vides sans les compter, retire les espaces et le BOM', () => {
    const csv = '﻿English,French,  reach  , atteindre \n\n   \n'
    expect(parseExport(csv)).toEqual({ pairs: [{ en: 'reach', fr: 'atteindre' }], skipped: 0 })
  })

  it('renvoie zéro paire pour un contenu sans rapport', () => {
    expect(parseExport('a;b;c\n1;2;3\n')).toEqual({ pairs: [], skipped: 2 })
  })
})
```

- [ ] **Step 3 : Ajuster les tests au format réel relevé à la tâche 4**

Comparer avec ce qui a été relevé à la tâche 4 :
- **Libellés de langue** : s'ils ne sont ni `English`/`French` ni `Anglais`/`Français`, ajouter au test « reconnaît les noms de langue en français… » une ligne `'<libellé EN>,<libellé FR>,reach,atteindre'` avec les libellés observés. Le texte de l'implémentation est ajusté à l'étape 5.
- **Nombre de colonnes** : s'il n'y en a pas 4 dans l'ordre `langue source, langue cible, texte source, texte traduit`, **s'arrêter** et le signaler au contrôleur avant d'aller plus loin. Le parseur et la spec supposent cet ordre.

Ne jamais mettre les vrais mots de l'utilisateur dans les tests : le dépôt est public.

- [ ] **Step 4 : Vérifier que les tests échouent**

Run: `npx vitest run src/domain/keys.test.ts src/domain/csv.test.ts`
Expected: FAIL, avec « Failed to resolve import "./keys" » et « Failed to resolve import "./csv" ».

- [ ] **Step 5 : Implémenter**

`src/domain/keys.ts` :

```ts
import type { CardDirection } from './types'

/** Forme canonique d'un texte : NFC, espaces réduits, minuscules. */
export function normalizeText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function cardId(wordKey: string, direction: CardDirection): string {
  return `${wordKey}:${direction}`
}
```

`src/domain/csv.ts` :

```ts
import Papa from 'papaparse'
import type { Pair } from './types'

const ENGLISH = new Set(['english', 'anglais', 'en'])
const FRENCH = new Set(['french', 'francais', 'fr'])

function language(label: string): 'en' | 'fr' | null {
  const n = label.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  if (ENGLISH.has(n)) return 'en'
  if (FRENCH.has(n)) return 'fr'
  return null
}

export type ParseResult = { pairs: Pair[]; skipped: number }

/**
 * Lit le CSV de l'export Google Translate → Sheets.
 * Colonnes : langue source, langue cible, texte source, texte traduit.
 * `skipped` compte les lignes non vides qui ne sont pas une paire anglais ↔ français.
 */
export function parseExport(csvText: string): ParseResult {
  const { data } = Papa.parse<string[]>(csvText.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  const pairs: Pair[] = []
  let skipped = 0
  for (const row of data) {
    const [from = '', to = '', source = '', target = ''] = row
    const src = source.trim()
    const tgt = target.trim()
    const a = language(from)
    const b = language(to)
    if (src && tgt && a === 'en' && b === 'fr') pairs.push({ en: src, fr: tgt })
    else if (src && tgt && a === 'fr' && b === 'en') pairs.push({ en: tgt, fr: src })
    else skipped++
  }
  return { pairs, skipped }
}
```

Si l'étape 3 a ajouté des libellés, les ajouter aussi aux ensembles `ENGLISH` et `FRENCH`, **en minuscules et sans accents** : c'est la forme à laquelle `language()` ramène chaque libellé avant de comparer.

- [ ] **Step 6 : Vérifier que les tests passent**

Run: `npx vitest run src/domain/keys.test.ts src/domain/csv.test.ts`
Expected: PASS (2 + 7 tests, plus ceux ajoutés à l'étape 3).

- [ ] **Step 7 : Commit**

```bash
git add src/domain/types.ts src/domain/keys.ts src/domain/keys.test.ts src/domain/csv.ts src/domain/csv.test.ts
git commit -m "Types du domaine et lecture de l'export CSV" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Planification FSRS et jour d'étude

**Files:**
- Create: `src/domain/scheduler.ts`, `src/domain/studyDay.ts`
- Test: `src/domain/scheduler.test.ts`, `src/domain/studyDay.test.ts`

**Interfaces:**
- Consumes: `FsrsState`, `Grade` (tâche 5).
- Produces (`src/domain/scheduler.ts`) : `newFsrsState(now: Date): FsrsState`, `rate(state: FsrsState, grade: Grade, now: Date): FsrsState`, `isNew(state: FsrsState): boolean`
- Produces (`src/domain/studyDay.ts`) : `studyDay(date: Date): string` (format `AAAA-MM-JJ`)

- [ ] **Step 1 : Écrire les tests**

`src/domain/scheduler.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { isNew, newFsrsState, rate } from './scheduler'

const now = new Date('2026-09-27T10:00:00.000Z')
const DAY = 86_400_000
const dueIn = (due: string) => new Date(due).getTime() - now.getTime()

describe('scheduler', () => {
  it('crée une carte nouvelle, due tout de suite', () => {
    const state = newFsrsState(now)
    expect(isNew(state)).toBe(true)
    expect(state.due).toBe(now.toISOString())
    expect(state.last_review).toBeUndefined()
  })

  it('« Pas su » sur une carte nouvelle la reprogramme au lendemain', () => {
    const next = rate(newFsrsState(now), 'pas-su', now)
    expect(isNew(next)).toBe(false)
    expect(dueIn(next.due)).toBe(DAY)
    expect(next.last_review).toBe(now.toISOString())
  })

  it('« Su » donne un intervalle plus long que « Pas su », d’au moins 2 jours', () => {
    const su = rate(newFsrsState(now), 'su', now)
    const pasSu = rate(newFsrsState(now), 'pas-su', now)
    expect(dueIn(su.due)).toBeGreaterThanOrEqual(2 * DAY)
    expect(dueIn(su.due)).toBeGreaterThan(dueIn(pasSu.due))
  })

  it('fonctionne sur un état relu depuis du JSON', () => {
    const first = rate(newFsrsState(now), 'su', now)
    const later = new Date(first.due)
    const reread = JSON.parse(JSON.stringify(first))
    const second = rate(reread, 'su', later)
    expect(new Date(second.due).getTime()).toBeGreaterThan(later.getTime() + 3 * DAY)
  })
})
```

`src/domain/studyDay.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { studyDay } from './studyDay'

describe('studyDay', () => {
  it('compte encore pour la veille avant 4 h du matin', () => {
    expect(studyDay(new Date(2026, 8, 27, 3, 59))).toBe('2026-09-26')
  })

  it('bascule sur le jour même à 4 h pile', () => {
    expect(studyDay(new Date(2026, 8, 27, 4, 0))).toBe('2026-09-27')
  })

  it('reste sur le même jour jusqu’à minuit', () => {
    expect(studyDay(new Date(2026, 8, 27, 23, 59))).toBe('2026-09-27')
  })

  it('complète mois et jour sur deux chiffres', () => {
    expect(studyDay(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run: `npx vitest run src/domain/scheduler.test.ts src/domain/studyDay.test.ts`
Expected: FAIL, avec « Failed to resolve import ».

- [ ] **Step 3 : Implémenter**

`src/domain/scheduler.ts` :

```ts
import { createEmptyCard, fsrs, Rating, State, type Card } from 'ts-fsrs'
import type { FsrsState, Grade } from './types'

// Pas d'étapes d'apprentissage en minutes : un mot raté revient le lendemain,
// la répétition immédiate est gérée par la session (voir session.ts).
const scheduler = fsrs({ enable_short_term: false })

function fromCard(card: Card): FsrsState {
  const { due, last_review, ...rest } = card
  return {
    ...rest,
    due: due.toISOString(),
    ...(last_review ? { last_review: last_review.toISOString() } : {}),
  }
}

export function newFsrsState(now: Date): FsrsState {
  return fromCard(createEmptyCard(now))
}

export function rate(state: FsrsState, grade: Grade, now: Date): FsrsState {
  const rating = grade === 'su' ? Rating.Good : Rating.Again
  return fromCard(scheduler.next(state, now, rating).card)
}

export function isNew(state: FsrsState): boolean {
  return state.state === State.New
}
```

`src/domain/studyDay.ts` :

```ts
const CUTOFF_HOURS = 4

/** Jour d'étude local au format AAAA-MM-JJ ; un jour commence à 4 h du matin. */
export function studyDay(date: Date): string {
  const shifted = new Date(date.getTime() - CUTOFF_HOURS * 3_600_000)
  const month = String(shifted.getMonth() + 1).padStart(2, '0')
  const day = String(shifted.getDate()).padStart(2, '0')
  return `${shifted.getFullYear()}-${month}-${day}`
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run: `npx vitest run src/domain/scheduler.test.ts src/domain/studyDay.test.ts`
Expected: PASS (4 + 4 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/domain/scheduler.ts src/domain/scheduler.test.ts src/domain/studyDay.ts src/domain/studyDay.test.ts
git commit -m "Planification FSRS et jour d'étude" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Fusion d'un export

**Files:**
- Create: `src/test/builders.ts`, `src/domain/merge.ts`
- Test: `src/domain/merge.test.ts`

**Interfaces:**
- Consumes: `normalizeText`, `cardId` (tâche 5) ; `newFsrsState` (tâche 6).
- Produces (`src/domain/merge.ts`) :
  - `type MergeStats = { added: number; removed: number; restored: number }`
  - `type MergeResult = { words: Word[]; newCards: StoredCard[]; stats: MergeStats }`
  - `mergeImport(words: Word[], pairs: Pair[], now: Date): MergeResult`. Renvoie **tous** les mots à jour, mais seulement les cartes à créer.
- Produces (`src/test/builders.ts`, pour les tests suivants) :
  - `word(key: string, overrides?: Partial<Word>): Word` ;
  - `card(key: string, direction: CardDirection, options?: { due?: string; lastReview?: string; introducedAt?: string }): StoredCard`. Sans `lastReview`, la carte est nouvelle ; avec `lastReview`, elle est en état Review et `introducedAt` vaut par défaut `lastReview`.

- [ ] **Step 1 : Écrire les fabriques de test et les tests**

`src/test/builders.ts` :

```ts
import { cardId } from '../domain/keys'
import { newFsrsState } from '../domain/scheduler'
import type { CardDirection, StoredCard, Word } from '../domain/types'

export function word(key: string, overrides: Partial<Word> = {}): Word {
  return { key, en: key, fr: [`${key}-fr`], status: 'actif', addedAt: '2026-09-01T10:00:00.000Z', order: 0, ...overrides }
}

type CardOptions = { due?: string; lastReview?: string; introducedAt?: string }

/** Carte nouvelle si aucune option ; carte déjà révisée si `lastReview` est donné. */
export function card(key: string, direction: CardDirection, options: CardOptions = {}): StoredCard {
  const base = newFsrsState(new Date('2026-09-01T10:00:00.000Z'))
  const reviewed = options.lastReview !== undefined
  return {
    id: cardId(key, direction),
    wordKey: key,
    direction,
    fsrs: {
      ...base,
      ...(reviewed ? { state: 2, stability: 3, difficulty: 5, reps: 1, scheduled_days: 3, last_review: options.lastReview } : {}),
      due: options.due ?? base.due,
    },
    ...(options.introducedAt ? { introducedAt: options.introducedAt } : reviewed ? { introducedAt: options.lastReview } : {}),
  }
}
```

`src/domain/merge.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { word } from '../test/builders'
import { mergeImport } from './merge'
import { isNew } from './scheduler'

const now = new Date('2026-09-27T10:00:00.000Z')

describe('mergeImport', () => {
  it('crée un mot actif et ses deux cartes nouvelles pour une paire inconnue', () => {
    const result = mergeImport([], [{ en: 'reach', fr: 'atteindre' }], now)
    expect(result.words).toEqual([
      { key: 'reach', en: 'reach', fr: ['atteindre'], status: 'actif', addedAt: now.toISOString(), order: 0 },
    ])
    expect(result.newCards.map((c) => c.id)).toEqual(['reach:en-fr', 'reach:fr-en'])
    expect(result.newCards.every((c) => isNew(c.fsrs) && c.wordKey === 'reach')).toBe(true)
    expect(result.stats).toEqual({ added: 1, removed: 0, restored: 0 })
  })

  it('regroupe les paires de même mot anglais et dédoublonne les traductions', () => {
    const result = mergeImport(
      [],
      [
        { en: 'Reach', fr: 'atteindre' },
        { en: '  reach ', fr: 'parvenir à' },
        { en: 'REACH', fr: 'Atteindre' },
      ],
      now,
    )
    expect(result.words).toHaveLength(1)
    expect(result.words[0]).toMatchObject({ key: 'reach', en: 'Reach', fr: ['atteindre', 'parvenir à'] })
    expect(result.newCards).toHaveLength(2)
  })

  it('garde la progression d’un mot connu et remplace ses traductions par celles de l’export', () => {
    const known = word('reach', { fr: ['atteindre', 'ancienne'], order: 4, addedAt: '2026-01-01T00:00:00.000Z' })
    const result = mergeImport([known], [{ en: 'reach', fr: 'atteindre' }, { en: 'reach', fr: 'parvenir à' }], now)
    expect(result.words).toEqual([{ ...known, fr: ['atteindre', 'parvenir à'] }])
    expect(result.newCards).toEqual([])
    expect(result.stats).toEqual({ added: 0, removed: 0, restored: 0 })
  })

  it('réactive un mot retiré qui revient dans l’export', () => {
    const result = mergeImport([word('reach', { status: 'retiré' })], [{ en: 'reach', fr: 'atteindre' }], now)
    expect(result.words[0].status).toBe('actif')
    expect(result.newCards).toEqual([])
    expect(result.stats).toEqual({ added: 0, removed: 0, restored: 1 })
  })

  it('marque « retiré » un mot actif absent de l’export, sans recompter un mot déjà retiré', () => {
    const result = mergeImport(
      [word('reach'), word('gone', { status: 'retiré' })],
      [{ en: 'other', fr: 'autre' }],
      now,
    )
    expect(result.words.find((w) => w.key === 'reach')?.status).toBe('retiré')
    expect(result.words.find((w) => w.key === 'gone')?.status).toBe('retiré')
    expect(result.stats).toEqual({ added: 1, removed: 1, restored: 0 })
  })

  it('numérote les nouveaux mots à la suite, dans l’ordre de l’export', () => {
    const result = mergeImport([word('old', { order: 7 })], [
      { en: 'old', fr: 'vieux' },
      { en: 'first', fr: 'premier' },
      { en: 'second', fr: 'deuxième' },
    ], now)
    expect(result.words.map((w) => [w.key, w.order])).toEqual([['old', 7], ['first', 8], ['second', 9]])
  })

  it('ne modifie pas les mots reçus en entrée', () => {
    const known = word('reach')
    const frozen = structuredClone(known)
    mergeImport([known], [], now)
    expect(known).toEqual(frozen)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run: `npx vitest run src/domain/merge.test.ts`
Expected: FAIL, avec « Failed to resolve import "./merge" ».

- [ ] **Step 3 : Implémenter**

`src/domain/merge.ts` :

```ts
import { cardId, normalizeText } from './keys'
import { newFsrsState } from './scheduler'
import type { Pair, StoredCard, Word } from './types'

export type MergeStats = { added: number; removed: number; restored: number }
export type MergeResult = { words: Word[]; newCards: StoredCard[]; stats: MergeStats }

type Group = { en: string; fr: string[] }

function groupPairs(pairs: Pair[]): Map<string, Group> {
  const groups = new Map<string, Group>()
  for (const pair of pairs) {
    const key = normalizeText(pair.en)
    const group = groups.get(key) ?? { en: pair.en.trim().replace(/\s+/g, ' '), fr: [] }
    const fr = pair.fr.trim().replace(/\s+/g, ' ')
    if (!group.fr.some((existing) => normalizeText(existing) === normalizeText(fr))) group.fr.push(fr)
    groups.set(key, group)
  }
  return groups
}

/**
 * Fusionne l'export (reflet exact de la liste Google Translate) avec les mots connus.
 * Renvoie tous les mots à jour et uniquement les cartes à créer ; les cartes existantes ne changent pas.
 */
export function mergeImport(words: Word[], pairs: Pair[], now: Date): MergeResult {
  const groups = groupPairs(pairs)
  const stats: MergeStats = { added: 0, removed: 0, restored: 0 }
  const newCards: StoredCard[] = []
  let nextOrder = words.reduce((max, w) => Math.max(max, w.order), -1) + 1

  const updated = words.map((word): Word => {
    const group = groups.get(word.key)
    if (!group) {
      if (word.status === 'actif') stats.removed++
      return { ...word, status: 'retiré' }
    }
    if (word.status === 'retiré') stats.restored++
    return { ...word, fr: group.fr, status: 'actif' }
  })

  const known = new Set(words.map((w) => w.key))
  for (const [key, group] of groups) {
    if (known.has(key)) continue
    updated.push({ key, en: group.en, fr: group.fr, status: 'actif', addedAt: now.toISOString(), order: nextOrder++ })
    for (const direction of ['en-fr', 'fr-en'] as const) {
      newCards.push({ id: cardId(key, direction), wordKey: key, direction, fsrs: newFsrsState(now) })
    }
    stats.added++
  }

  return { words: updated, newCards, stats }
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run: `npx vitest run src/domain/merge.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/test/builders.ts src/domain/merge.ts src/domain/merge.test.ts
git commit -m "Fusion d'un export Google Translate" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : File de la prochaine session

**Files:**
- Create: `src/domain/queue.ts`
- Test: `src/domain/queue.test.ts`

**Interfaces:**
- Consumes: `isNew` (tâche 6), `studyDay` (tâche 6), les types (tâche 5), `word` et `card` (tâche 7, tests).
- Produces: `type QueueInput = { words: Word[]; cards: StoredCard[]; settings: Settings; now: Date }`, `buildQueue(input: QueueInput): StoredCard[]`

- [ ] **Step 1 : Écrire les tests**

`src/domain/queue.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { card, word } from '../test/builders'
import { DEFAULT_SETTINGS } from './types'
import { buildQueue } from './queue'

// Heure locale : ces tests ne dépendent pas du fuseau de la machine.
const now = new Date(2026, 8, 27, 10, 0)
const at = (day: number, hour = 10) => new Date(2026, 8, day, hour, 0).toISOString()
const ids = (cards: { id: string }[]) => cards.map((c) => c.id)
const settings = DEFAULT_SETTINGS

describe('buildQueue', () => {
  it('met les cartes dues en premier, les plus en retard d’abord', () => {
    const words = [word('a', { order: 0 }), word('b', { order: 1 }), word('c', { order: 2 })]
    const cards = [
      card('a', 'en-fr', { lastReview: at(20), due: at(25) }),
      card('b', 'en-fr', { lastReview: at(20), due: at(22) }),
      card('c', 'en-fr', { lastReview: at(20), due: at(26) }),
    ]
    expect(ids(buildQueue({ words, cards, settings, now }))).toEqual(['b:en-fr', 'a:en-fr', 'c:en-fr'])
  })

  it('inclut une carte due plus tard dans la journée d’étude, pas celle due demain', () => {
    const words = [word('a'), word('b')]
    const cards = [
      card('a', 'en-fr', { lastReview: at(24), due: at(27, 22) }),
      card('b', 'en-fr', { lastReview: at(24), due: at(28, 5) }),
    ]
    expect(ids(buildQueue({ words, cards, settings, now }))).toEqual(['a:en-fr'])
  })

  it('ignore les mots retirés', () => {
    const words = [word('a', { status: 'retiré' })]
    const cards = [card('a', 'en-fr', { lastReview: at(20), due: at(22) }), card('a', 'fr-en')]
    expect(buildQueue({ words, cards, settings, now })).toEqual([])
  })

  it('ajoute les nouvelles cartes après les dues, par ordre d’ajout, dans la limite du jour', () => {
    const words = [word('d', { order: 0 }), word('n2', { order: 2 }), word('n1', { order: 1 }), word('n3', { order: 3 })]
    const cards = [
      card('d', 'en-fr', { lastReview: at(20), due: at(22) }),
      card('d', 'fr-en', { lastReview: at(20), due: at(30) }),
      ...['n1', 'n2', 'n3'].flatMap((k) => [card(k, 'en-fr'), card(k, 'fr-en')]),
    ]
    const queue = buildQueue({ words, cards, settings: { newPerDay: 2 }, now })
    expect(ids(queue)).toEqual(['d:en-fr', 'n1:en-fr', 'n2:en-fr'])
  })

  it('déduit de la limite les cartes déjà introduites ce jour d’étude', () => {
    const words = [word('seen', { order: 0 }), word('n1', { order: 1 }), word('n2', { order: 2 })]
    const cards = [
      card('seen', 'en-fr', { lastReview: at(27, 8), due: at(30) }),
      card('seen', 'fr-en'),
      card('n1', 'en-fr'), card('n1', 'fr-en'),
      card('n2', 'en-fr'), card('n2', 'fr-en'),
    ]
    expect(ids(buildQueue({ words, cards, settings: { newPerDay: 2 }, now }))).toEqual(['n1:en-fr'])
  })

  it('ne propose la carte fr-en nouvelle qu’une fois la carte en-fr déjà révisée', () => {
    const words = [word('a', { order: 0 }), word('b', { order: 1 })]
    const cards = [
      card('a', 'en-fr', { lastReview: at(25), due: at(29) }),
      card('a', 'fr-en'),
      card('b', 'en-fr'),
      card('b', 'fr-en'),
    ]
    expect(ids(buildQueue({ words, cards, settings, now }))).toEqual(['a:fr-en', 'b:en-fr'])
  })

  it('exclut un mot dont l’autre sens a été révisé ce jour d’étude', () => {
    const words = [word('a')]
    const cards = [
      card('a', 'en-fr', { lastReview: at(27, 7), due: at(30) }),
      card('a', 'fr-en', { lastReview: at(20), due: at(22) }),
    ]
    expect(buildQueue({ words, cards, settings, now })).toEqual([])
  })

  it('ne met qu’un sens par mot quand les deux sont dus', () => {
    const words = [word('a')]
    const cards = [
      card('a', 'en-fr', { lastReview: at(20), due: at(26) }),
      card('a', 'fr-en', { lastReview: at(19), due: at(24) }),
    ]
    expect(ids(buildQueue({ words, cards, settings, now }))).toEqual(['a:fr-en'])
  })

  it('n’ajoute aucune nouvelle carte si la limite est à 0', () => {
    const words = [word('a')]
    const cards = [card('a', 'en-fr'), card('a', 'fr-en')]
    expect(buildQueue({ words, cards, settings: { newPerDay: 0 }, now })).toEqual([])
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run: `npx vitest run src/domain/queue.test.ts`
Expected: FAIL, avec « Failed to resolve import "./queue" ».

- [ ] **Step 3 : Implémenter**

`src/domain/queue.ts` :

```ts
import { isNew } from './scheduler'
import { studyDay } from './studyDay'
import type { Settings, StoredCard, Word } from './types'

export type QueueInput = { words: Word[]; cards: StoredCard[]; settings: Settings; now: Date }

const sameDay = (iso: string | undefined, today: string) => iso !== undefined && studyDay(new Date(iso)) === today

/**
 * Cartes de la prochaine session : d'abord les cartes dues (les plus en retard d'abord),
 * puis les nouvelles dans la limite du jour. Au plus une carte par mot, et aucune carte
 * d'un mot dont l'autre sens a déjà été révisé ce jour d'étude.
 */
export function buildQueue({ words, cards, settings, now }: QueueInput): StoredCard[] {
  const today = studyDay(now)
  const active = new Map(words.filter((w) => w.status === 'actif').map((w) => [w.key, w]))
  const blocked = new Set(cards.filter((c) => sameDay(c.fsrs.last_review, today)).map((c) => c.wordKey))
  const taken = new Set<string>()
  const queue: StoredCard[] = []

  const due = cards
    .filter((c) => active.has(c.wordKey) && !blocked.has(c.wordKey) && !isNew(c.fsrs))
    .filter((c) => studyDay(new Date(c.fsrs.due)) <= today)
    .sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due))
  for (const c of due) {
    if (taken.has(c.wordKey)) continue
    taken.add(c.wordKey)
    queue.push(c)
  }

  const introducedToday = cards.filter((c) => sameDay(c.introducedAt, today)).length
  let remaining = Math.max(0, settings.newPerDay - introducedToday)
  const byWord = new Map<string, Partial<Record<StoredCard['direction'], StoredCard>>>()
  for (const c of cards) byWord.set(c.wordKey, { ...byWord.get(c.wordKey), [c.direction]: c })

  const ordered = [...active.values()].sort((a, b) => a.order - b.order)
  for (const word of ordered) {
    if (remaining === 0) break
    if (blocked.has(word.key) || taken.has(word.key)) continue
    const pair = byWord.get(word.key)
    const enFr = pair?.['en-fr']
    const frEn = pair?.['fr-en']
    const candidate = enFr && isNew(enFr.fsrs) ? enFr : enFr && frEn && isNew(frEn.fsrs) ? frEn : undefined
    if (!candidate) continue
    taken.add(word.key)
    queue.push(candidate)
    remaining--
  }

  return queue
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run: `npx vitest run src/domain/queue.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/domain/queue.ts src/domain/queue.test.ts
git commit -m "File de révision" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Déroulement d'une session

**Files:**
- Create: `src/domain/session.ts`
- Test: `src/domain/session.test.ts`

**Interfaces:**
- Consumes: `rate` (tâche 6), `card` (tâche 7, tests).
- Produces :
  - `type SessionState = { queue: StoredCard[]; firstAnswers: Record<string, Grade>; total: number; previous?: {...} }`
  - `type Step = { state: SessionState; save?: StoredCard }`. `save` est la carte à écrire en base, s'il y en a une.
  - `startSession(queue)`, `currentCard(state)`, `answer(state, grade, now): Step`, `canUndo(state)`, `undo(state): Step`, `progress(state): { done; total }`, `summary(state): { total; percent }`

- [ ] **Step 1 : Écrire les tests**

`src/domain/session.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { card } from '../test/builders'
import { answer, canUndo, currentCard, progress, startSession, summary, undo } from './session'
import { isNew } from './scheduler'

const now = new Date('2026-09-27T10:00:00.000Z')
const a = card('a', 'en-fr')
const b = card('b', 'en-fr')

describe('session', () => {
  it('commence sur la première carte de la file', () => {
    const state = startSession([a, b])
    expect(currentCard(state)?.id).toBe('a:en-fr')
    expect(progress(state)).toEqual({ done: 0, total: 2 })
    expect(canUndo(state)).toBe(false)
  })

  it('« Su » retire la carte et renvoie sa nouvelle planification à enregistrer', () => {
    const { state, save } = answer(startSession([a, b]), 'su', now)
    expect(state.queue.map((c) => c.id)).toEqual(['b:en-fr'])
    expect(save?.id).toBe('a:en-fr')
    expect(isNew(save!.fsrs)).toBe(false)
    expect(save?.introducedAt).toBe(now.toISOString())
    expect(progress(state)).toEqual({ done: 1, total: 2 })
  })

  it('« Pas su » renvoie la carte en fin de file et l’enregistre', () => {
    const { state, save } = answer(startSession([a, b]), 'pas-su', now)
    expect(state.queue.map((c) => c.id)).toEqual(['b:en-fr', 'a:en-fr'])
    expect(save?.fsrs.last_review).toBe(now.toISOString())
    expect(progress(state)).toEqual({ done: 0, total: 2 })
  })

  it('ne replanifie pas une carte déjà répondue dans la session', () => {
    let step = answer(startSession([a]), 'pas-su', now)
    const firstSave = step.save
    step = answer(step.state, 'pas-su', now)
    expect(step.save).toBeUndefined()
    expect(step.state.queue).toEqual([firstSave])
    step = answer(step.state, 'su', now)
    expect(step.save).toBeUndefined()
    expect(step.state.queue).toEqual([])
  })

  it('garde introducedAt d’une carte déjà introduite', () => {
    const seen = card('s', 'en-fr', { lastReview: '2026-09-20T10:00:00.000Z', due: '2026-09-27T09:00:00.000Z' })
    const { save } = answer(startSession([seen]), 'su', now)
    expect(save?.introducedAt).toBe('2026-09-20T10:00:00.000Z')
  })

  it('« Annuler » remet la file et renvoie la carte d’avant la réponse, une seule fois', () => {
    const started = startSession([a, b])
    const answered = answer(started, 'su', now).state
    const undone = undo(answered)
    expect(undone.state.queue).toEqual([a, b])
    expect(undone.save).toEqual(a)
    expect(canUndo(undone.state)).toBe(false)
    expect(undo(undone.state).save).toBeUndefined()
  })

  it('après « Annuler », la réponse suivante replanifie à nouveau la carte', () => {
    const answered = answer(startSession([a]), 'pas-su', now).state
    const redo = answer(undo(answered).state, 'su', now)
    expect(redo.save).toBeDefined()
    expect(redo.state.queue).toEqual([])
  })

  it('calcule le pourcentage sur la première réponse à chaque carte', () => {
    let state = startSession([a, b])
    state = answer(state, 'pas-su', now).state // a : raté
    state = answer(state, 'su', now).state // b : su
    state = answer(state, 'su', now).state // a : su au 2e essai, ne compte pas
    expect(currentCard(state)).toBeUndefined()
    expect(summary(state)).toEqual({ total: 2, percent: 50 })
  })

  it('permet d’annuler la dernière réponse d’une session terminée', () => {
    const finished = answer(startSession([a]), 'su', now).state
    expect(currentCard(finished)).toBeUndefined()
    expect(canUndo(finished)).toBe(true)
    const undone = undo(finished)
    expect(currentCard(undone.state)).toEqual(a)
    expect(undone.save).toEqual(a)
  })

  it('ne fait rien quand la file est vide', () => {
    const empty = startSession([])
    expect(answer(empty, 'su', now)).toEqual({ state: empty })
    expect(summary(empty)).toEqual({ total: 0, percent: 0 })
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run: `npx vitest run src/domain/session.test.ts`
Expected: FAIL, avec « Failed to resolve import "./session" ».

- [ ] **Step 3 : Implémenter**

`src/domain/session.ts` :

```ts
import { rate } from './scheduler'
import type { Grade, StoredCard } from './types'

type Snapshot = { queue: StoredCard[]; firstAnswers: Record<string, Grade> }

/** `queue[0]` est la carte affichée. `previous` permet d'annuler la dernière réponse. */
export type SessionState = Snapshot & { total: number; previous?: Snapshot }

/** `save` : carte à écrire en base, s'il y en a une. */
export type Step = { state: SessionState; save?: StoredCard }

export function startSession(queue: StoredCard[]): SessionState {
  return { queue, firstAnswers: {}, total: queue.length }
}

export function currentCard(state: SessionState): StoredCard | undefined {
  return state.queue[0]
}

/**
 * Seule la première réponse à une carte met à jour sa planification.
 * « Pas su » renvoie la carte en fin de file jusqu'à ce qu'elle soit sue.
 */
export function answer(state: SessionState, grade: Grade, now: Date): Step {
  const [card, ...rest] = state.queue
  if (!card) return { state }
  const isFirst = !(card.id in state.firstAnswers)
  const updated = isFirst
    ? { ...card, fsrs: rate(card.fsrs, grade, now), introducedAt: card.introducedAt ?? now.toISOString() }
    : card
  return {
    state: {
      queue: grade === 'su' ? rest : [...rest, updated],
      firstAnswers: isFirst ? { ...state.firstAnswers, [card.id]: grade } : state.firstAnswers,
      total: state.total,
      previous: { queue: state.queue, firstAnswers: state.firstAnswers },
    },
    save: isFirst ? updated : undefined,
  }
}

export function canUndo(state: SessionState): boolean {
  return state.previous !== undefined
}

/** Annule la dernière réponse ; `save` remet la carte en base dans son état d'avant. */
export function undo(state: SessionState): Step {
  if (!state.previous) return { state }
  const { queue, firstAnswers } = state.previous
  return { state: { queue, firstAnswers, total: state.total }, save: queue[0] }
}

export function progress(state: SessionState): { done: number; total: number } {
  return { done: state.total - state.queue.length, total: state.total }
}

export function summary(state: SessionState): { total: number; percent: number } {
  const answers = Object.values(state.firstAnswers)
  const known = answers.filter((g) => g === 'su').length
  return { total: state.total, percent: answers.length === 0 ? 0 : Math.round((known / answers.length) * 100) }
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run: `npx vitest run src/domain/session.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/domain/session.ts src/domain/session.test.ts
git commit -m "Déroulement d'une session de révision" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10 : Stockage IndexedDB

**Files:**
- Create: `src/storage/db.ts`
- Test: `src/storage/db.test.ts`

**Interfaces:**
- Consumes: les types et `DEFAULT_SETTINGS` (tâche 5), `word` et `card` (tâche 7, tests).
- Produces :
  - `type Snapshot = { words: Word[]; cards: StoredCard[]; settings: Settings; syncMeta: SyncMeta | null }`
  - `type Store = { load(); saveCard(card); saveSettings(settings); applySync(words, newCards, meta); replaceAll(snapshot) }`. Toutes les méthodes renvoient des `Promise` ; `load` renvoie un `Snapshot`.
  - `openStore(name?: string): Promise<Store>`. Le nom par défaut est `'vocab-review'`.

La transaction d'écriture suit chaque requête dès sa création (fonction génératrice), puis attend toutes les requêtes avec `Promise.allSettled`. Sans ça, une erreur au milieu laisse des rejets de promesses non gérés et risque de valider une écriture partielle.

- [ ] **Step 1 : Écrire les tests**

`src/storage/db.test.ts` :

```ts
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { card, word } from '../test/builders'
import { DEFAULT_SETTINGS, type StoredCard } from '../domain/types'
import { openStore } from './db'

let counter = 0
const freshStore = () => openStore(`test-${counter++}`)
const meta = { fileId: 'f1', modifiedTime: '2026-09-27T09:00:00.000Z', syncedAt: '2026-09-27T10:00:00.000Z' }

describe('openStore', () => {
  it('renvoie une base vide avec les réglages par défaut', async () => {
    const store = await freshStore()
    expect(await store.load()).toEqual({ words: [], cards: [], settings: DEFAULT_SETTINGS, syncMeta: null })
  })

  it('enregistre une synchro puis la relit', async () => {
    const store = await freshStore()
    await store.applySync([word('a')], [card('a', 'en-fr'), card('a', 'fr-en')], meta)
    const snap = await store.load()
    expect(snap.words).toEqual([word('a')])
    expect(snap.cards.map((c) => c.id).sort()).toEqual(['a:en-fr', 'a:fr-en'])
    expect(snap.syncMeta).toEqual(meta)
  })

  it('n’écrit rien si une partie de la synchro échoue', async () => {
    const store = await freshStore()
    const broken = { wordKey: 'a' } as StoredCard // pas d'id : IndexedDB refuse
    await expect(store.applySync([word('a')], [broken], meta)).rejects.toThrow()
    expect(await store.load()).toEqual({ words: [], cards: [], settings: DEFAULT_SETTINGS, syncMeta: null })
  })

  it('met à jour une carte et les réglages', async () => {
    const store = await freshStore()
    await store.applySync([word('a')], [card('a', 'en-fr')], meta)
    const reviewed = card('a', 'en-fr', { lastReview: '2026-09-27T10:00:00.000Z', due: '2026-09-30T10:00:00.000Z' })
    await store.saveCard(reviewed)
    await store.saveSettings({ newPerDay: 5 })
    const snap = await store.load()
    expect(snap.cards).toEqual([reviewed])
    expect(snap.settings).toEqual({ newPerDay: 5 })
  })

  it('remplace toutes les données lors d’une restauration', async () => {
    const store = await freshStore()
    await store.applySync([word('old')], [card('old', 'en-fr')], meta)
    const restored = { words: [word('new')], cards: [card('new', 'fr-en')], settings: { newPerDay: 3 }, syncMeta: null }
    await store.replaceAll(restored)
    expect(await store.load()).toEqual(restored)
  })
})

describe('openStore — restauration invalide', () => {
  it('garde les données actuelles si la restauration échoue', async () => {
    const store = await freshStore()
    await store.applySync([word('keep')], [card('keep', 'en-fr')], meta)
    const before = await store.load()
    const broken = { words: [word('x')], cards: [{ wordKey: 'x' } as StoredCard], settings: DEFAULT_SETTINGS, syncMeta: null }
    await expect(store.replaceAll(broken)).rejects.toThrow()
    expect(await store.load()).toEqual(before)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run: `npx vitest run src/storage/db.test.ts`
Expected: FAIL, avec « Failed to resolve import "./db" ».

- [ ] **Step 3 : Implémenter**

`src/storage/db.ts` :

```ts
import { openDB, type DBSchema, type IDBPTransaction } from 'idb'
import { DEFAULT_SETTINGS, type Settings, type StoredCard, type SyncMeta, type Word } from '../domain/types'

export type Snapshot = { words: Word[]; cards: StoredCard[]; settings: Settings; syncMeta: SyncMeta | null }

export type Store = {
  load(): Promise<Snapshot>
  saveCard(card: StoredCard): Promise<void>
  saveSettings(settings: Settings): Promise<void>
  /** Écrit une synchro en une seule transaction : tout ou rien. */
  applySync(words: Word[], newCards: StoredCard[], meta: SyncMeta): Promise<void>
  /** Remplace toutes les données (restauration) en une seule transaction. */
  replaceAll(snapshot: Snapshot): Promise<void>
}

interface VocabDB extends DBSchema {
  words: { key: string; value: Word }
  cards: { key: string; value: StoredCard }
  kv: { key: 'settings' | 'syncMeta'; value: Settings | SyncMeta }
}

type WriteTx = IDBPTransaction<VocabDB, ('words' | 'cards' | 'kv')[], 'readwrite'>

export async function openStore(name = 'vocab-review'): Promise<Store> {
  const db = await openDB<VocabDB>(name, 1, {
    upgrade(database) {
      database.createObjectStore('words', { keyPath: 'key' })
      database.createObjectStore('cards', { keyPath: 'id' })
      database.createObjectStore('kv')
    },
  })

  /**
   * Exécute les écritures produites par `requests` dans une seule transaction.
   * Au premier échec, IndexedDB annule tout ; chaque requête est suivie dès sa création
   * pour qu'aucun rejet ne reste non géré.
   */
  async function write(requests: (tx: WriteTx) => Iterable<Promise<unknown>>): Promise<void> {
    const tx = db.transaction(['words', 'cards', 'kv'], 'readwrite')
    const pending: Promise<unknown>[] = []
    let failure: unknown
    try {
      for (const request of requests(tx)) pending.push(request)
    } catch (error) {
      failure = error
      tx.abort()
    }
    const results = await Promise.allSettled([...pending, tx.done])
    if (failure !== undefined) throw failure
    const rejected = results.find((r) => r.status === 'rejected')
    if (rejected) throw rejected.reason
  }

  return {
    async load() {
      const tx = db.transaction(['words', 'cards', 'kv'])
      const [words, cards, settings, syncMeta] = await Promise.all([
        tx.objectStore('words').getAll(),
        tx.objectStore('cards').getAll(),
        tx.objectStore('kv').get('settings'),
        tx.objectStore('kv').get('syncMeta'),
      ])
      return {
        words,
        cards,
        settings: (settings as Settings | undefined) ?? DEFAULT_SETTINGS,
        syncMeta: (syncMeta as SyncMeta | undefined) ?? null,
      }
    },
    async saveCard(card) {
      await db.put('cards', card)
    },
    async saveSettings(settings) {
      await db.put('kv', settings, 'settings')
    },
    applySync(words, newCards, meta) {
      return write(function* (tx) {
        for (const w of words) yield tx.objectStore('words').put(w)
        for (const c of newCards) yield tx.objectStore('cards').put(c)
        yield tx.objectStore('kv').put(meta, 'syncMeta')
      })
    },
    replaceAll(snapshot) {
      return write(function* (tx) {
        yield tx.objectStore('words').clear()
        yield tx.objectStore('cards').clear()
        yield tx.objectStore('kv').clear()
        for (const w of snapshot.words) yield tx.objectStore('words').put(w)
        for (const c of snapshot.cards) yield tx.objectStore('cards').put(c)
        yield tx.objectStore('kv').put(snapshot.settings, 'settings')
        if (snapshot.syncMeta) yield tx.objectStore('kv').put(snapshot.syncMeta, 'syncMeta')
      })
    },
  }
}
```

- [ ] **Step 4 : Vérifier que les tests passent, sans erreur non gérée**

Run: `npx vitest run src/storage/db.test.ts`
Expected: PASS (6 tests), et **aucune** ligne « Errors » ni « Unhandled » dans le résumé.

- [ ] **Step 5 : Commit**

```bash
git add src/storage/db.ts src/storage/db.test.ts
git commit -m "Stockage IndexedDB transactionnel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11 : Sauvegarde et restauration

**Files:**
- Create: `src/storage/backup.ts`
- Test: `src/storage/backup.test.ts`

**Interfaces:**
- Consumes: `Snapshot` (tâche 10), `word` et `card` (tâche 7, tests).
- Produces :
  - `type Backup = Snapshot & { app: 'vocab-review'; version: 1; exportedAt: string }`
  - `class InvalidBackupError extends Error`
  - `makeBackup(snapshot: Snapshot, now: Date): Backup`
  - `backupFileName(now: Date): string` (`vocab-review-AAAA-MM-JJ.json`, date locale)
  - `parseBackup(text: string): Snapshot`, qui lève `InvalidBackupError` si le fichier n'est pas valide

- [ ] **Step 1 : Écrire les tests**

`src/storage/backup.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { card, word } from '../test/builders'
import { backupFileName, InvalidBackupError, makeBackup, parseBackup } from './backup'
import type { Snapshot } from './db'

const now = new Date(2026, 8, 7, 10, 0)
const snapshot: Snapshot = {
  words: [word('reach', { fr: ['atteindre', 'parvenir à'] }), word('gone', { status: 'retiré', order: 1 })],
  cards: [card('reach', 'en-fr', { lastReview: '2026-09-01T10:00:00.000Z', due: '2026-09-04T10:00:00.000Z' }), card('reach', 'fr-en')],
  settings: { newPerDay: 12 },
  syncMeta: { fileId: 'f1', modifiedTime: '2026-09-01T09:00:00.000Z', syncedAt: '2026-09-01T10:00:00.000Z' },
}
const withChange = (change: (b: Record<string, unknown>) => void) => {
  const b = JSON.parse(JSON.stringify(makeBackup(snapshot, now)))
  change(b)
  return JSON.stringify(b)
}

describe('sauvegarde', () => {
  it('relit à l’identique ce qu’elle a exporté', () => {
    const text = JSON.stringify(makeBackup(snapshot, now))
    expect(parseBackup(text)).toEqual(snapshot)
  })

  it('accepte une sauvegarde sans infos de synchro', () => {
    const text = JSON.stringify(makeBackup({ ...snapshot, syncMeta: null }, now))
    expect(parseBackup(text).syncMeta).toBeNull()
  })

  it('nomme le fichier avec la date locale', () => {
    expect(backupFileName(now)).toBe('vocab-review-2026-09-07.json')
  })

  it.each([
    ['du texte qui n’est pas du JSON', 'pas du json'],
    ['un autre fichier JSON', JSON.stringify({ hello: 'world' })],
    ['une version inconnue', withChange((b) => (b.version = 2))],
    ['un mot sans traductions', withChange((b) => ((b.words as Record<string, unknown>[])[0].fr = 'atteindre'))],
    ['un statut inconnu', withChange((b) => ((b.words as Record<string, unknown>[])[0].status = 'archivé'))],
    ['une carte sans date due', withChange((b) => delete (b.cards as { fsrs: Record<string, unknown> }[])[0].fsrs.due)],
    ['un sens de carte inconnu', withChange((b) => ((b.cards as Record<string, unknown>[])[0].direction = 'es-fr'))],
    ['des réglages absents', withChange((b) => delete b.settings)],
  ])('refuse %s', (_label, text) => {
    expect(() => parseBackup(text)).toThrow(InvalidBackupError)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run: `npx vitest run src/storage/backup.test.ts`
Expected: FAIL, avec « Failed to resolve import "./backup" ».

- [ ] **Step 3 : Implémenter**

`src/storage/backup.ts` :

```ts
import type { Snapshot } from './db'

export type Backup = Snapshot & { app: 'vocab-review'; version: 1; exportedAt: string }

export class InvalidBackupError extends Error {
  constructor(reason: string) {
    super(`Sauvegarde invalide : ${reason}`)
    this.name = 'InvalidBackupError'
  }
}

export function makeBackup(snapshot: Snapshot, now: Date): Backup {
  return { app: 'vocab-review', version: 1, exportedAt: now.toISOString(), ...snapshot }
}

/** Nom du fichier, avec la date locale : vocab-review-AAAA-MM-JJ.json */
export function backupFileName(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `vocab-review-${now.getFullYear()}-${month}-${day}.json`
}

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isWord(v: unknown): boolean {
  return (
    isObject(v) && isString(v.key) && isString(v.en) && Array.isArray(v.fr) && v.fr.every(isString) &&
    (v.status === 'actif' || v.status === 'retiré') && isString(v.addedAt) && isNumber(v.order)
  )
}

function isCard(v: unknown): boolean {
  if (!isObject(v) || !isObject(v.fsrs)) return false
  const f = v.fsrs
  return (
    isString(v.id) && isString(v.wordKey) && (v.direction === 'en-fr' || v.direction === 'fr-en') &&
    (v.introducedAt === undefined || isString(v.introducedAt)) &&
    isString(f.due) && (f.last_review === undefined || isString(f.last_review)) &&
    ['stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state'].every((k) =>
      isNumber(f[k]),
    )
  )
}

function isSyncMeta(v: unknown): boolean {
  return isObject(v) && isString(v.fileId) && isString(v.modifiedTime) && isString(v.syncedAt)
}

/** Lit et vérifie un fichier de sauvegarde ; lève InvalidBackupError sinon. */
export function parseBackup(text: string): Snapshot {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new InvalidBackupError('ce n’est pas du JSON')
  }
  if (!isObject(data) || data.app !== 'vocab-review') throw new InvalidBackupError('ce n’est pas une sauvegarde Vocab Review')
  if (data.version !== 1) throw new InvalidBackupError(`version ${String(data.version)} inconnue`)
  if (!Array.isArray(data.words) || !data.words.every(isWord)) throw new InvalidBackupError('mots illisibles')
  if (!Array.isArray(data.cards) || !data.cards.every(isCard)) throw new InvalidBackupError('cartes illisibles')
  if (!isObject(data.settings) || !isNumber(data.settings.newPerDay)) throw new InvalidBackupError('réglages illisibles')
  if (data.syncMeta !== null && !isSyncMeta(data.syncMeta)) throw new InvalidBackupError('infos de synchro illisibles')
  return {
    words: data.words as Snapshot['words'],
    cards: data.cards as Snapshot['cards'],
    settings: { newPerDay: data.settings.newPerDay },
    syncMeta: data.syncMeta as Snapshot['syncMeta'],
  }
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run: `npx vitest run src/storage/backup.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/storage/backup.ts src/storage/backup.test.ts
git commit -m "Sauvegarde et restauration JSON" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12 : Synchro de bout en bout et messages

**Files:**
- Create: `src/sync.ts`, `src/ui/messages.ts`
- Test: `src/sync.test.ts`, `src/ui/messages.test.ts`

**Interfaces:**
- Consumes: `parseExport` (tâche 5), `mergeImport` et `MergeResult` (tâche 7), `DriveApi` et `DriveError` (tâche 4), `Snapshot` (tâche 10).
- Produces (`src/sync.ts`) :
  - `type SyncError = 'offline' | 'auth-denied' | 'auth-failed' | 'state-mismatch' | 'no-export' | 'unrecognized-format' | 'drive-error'`
  - `type SyncOutcome = { kind: 'need-auth' } | { kind: 'up-to-date' } | { kind: 'merged'; merge: MergeResult; meta: SyncMeta } | { kind: 'error'; error: SyncError; status?: number }`
  - `type SyncInput = { token: string | null; freshToken: boolean; online: boolean; snapshot: Pick<Snapshot, 'words' | 'syncMeta'>; drive: DriveApi; now: Date }`
  - `runSync(input: SyncInput): Promise<SyncOutcome>`. Calcule la fusion sans rien écrire : c'est l'appelant qui écrit, avec `store.applySync`.
- Produces (`src/ui/messages.ts`) : `EXPORT_HELP: string`, `mergeMessage(stats)`, `errorMessage(error, status?)`, `syncMessage(outcome sans 'need-auth')`

- [ ] **Step 1 : Écrire les tests**

`src/sync.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { word } from './test/builders'
import { DriveError, type DriveApi, type DriveFile } from './google/drive'
import { runSync, type SyncInput } from './sync'

const now = new Date('2026-09-27T10:00:00.000Z')
const file: DriveFile = { id: 'f1', name: 'Saved translations', modifiedTime: '2026-09-27T09:00:00.000Z' }

function fakeDrive(options: { file?: DriveFile | null; csv?: string; error?: Error } = {}): DriveApi & { exports: number } {
  const drive = {
    exports: 0,
    async findLatestExport() {
      if (options.error) throw options.error
      return options.file === undefined ? file : options.file
    },
    async exportCsv() {
      drive.exports++
      return options.csv ?? 'English,French,reach,atteindre\n'
    },
  }
  return drive
}

const input = (overrides: Partial<SyncInput> = {}): SyncInput => ({
  token: 'tok',
  freshToken: false,
  online: true,
  snapshot: { words: [], syncMeta: null },
  drive: fakeDrive(),
  now,
  ...overrides,
})

describe('runSync', () => {
  it('signale l’absence de réseau avant tout', async () => {
    expect(await runSync(input({ online: false, token: null }))).toEqual({ kind: 'error', error: 'offline' })
  })

  it('demande une connexion Google sans jeton utilisable', async () => {
    expect(await runSync(input({ token: null }))).toEqual({ kind: 'need-auth' })
  })

  it('fusionne le dernier export et prépare les infos de synchro', async () => {
    const outcome = await runSync(input({ snapshot: { words: [word('gone')], syncMeta: null } }))
    expect(outcome.kind).toBe('merged')
    if (outcome.kind !== 'merged') return
    expect(outcome.merge.stats).toEqual({ added: 1, removed: 1, restored: 0 })
    expect(outcome.meta).toEqual({ fileId: 'f1', modifiedTime: file.modifiedTime, syncedAt: now.toISOString() })
  })

  it('ne crée qu’un mot pour une expression enregistrée dans les deux sens', async () => {
    const drive = fakeDrive({ csv: 'English,French,reach,atteindre\nFrench,English,atteindre,Reach\n' })
    const outcome = await runSync(input({ drive }))
    if (outcome.kind !== 'merged') throw new Error(outcome.kind)
    expect(outcome.merge.words.map((w) => [w.en, w.fr])).toEqual([['reach', ['atteindre']]])
    expect(outcome.merge.newCards).toHaveLength(2)
  })

  it('ne retélécharge pas un export déjà importé', async () => {
    const drive = fakeDrive()
    const syncMeta = { fileId: 'f1', modifiedTime: file.modifiedTime, syncedAt: '2026-09-26T10:00:00.000Z' }
    expect(await runSync(input({ drive, snapshot: { words: [], syncMeta } }))).toEqual({ kind: 'up-to-date' })
    expect(drive.exports).toBe(0)
  })

  it('réimporte un export modifié depuis la dernière synchro', async () => {
    const syncMeta = { fileId: 'f1', modifiedTime: '2026-09-20T09:00:00.000Z', syncedAt: '2026-09-20T10:00:00.000Z' }
    expect((await runSync(input({ snapshot: { words: [], syncMeta } }))).kind).toBe('merged')
  })

  it('signale l’absence d’export dans Drive', async () => {
    expect(await runSync(input({ drive: fakeDrive({ file: null }) }))).toEqual({ kind: 'error', error: 'no-export' })
  })

  it('refuse un export sans aucune paire reconnue, pour ne pas tout marquer « retiré »', async () => {
    const drive = fakeDrive({ csv: 'Spanish,French,hola,bonjour\n' })
    const outcome = await runSync(input({ drive, snapshot: { words: [word('keep')], syncMeta: null } }))
    expect(outcome).toEqual({ kind: 'error', error: 'unrecognized-format' })
  })

  it('redemande une connexion sur un 401 avec un ancien jeton', async () => {
    expect(await runSync(input({ drive: fakeDrive({ error: new DriveError(401) }) }))).toEqual({ kind: 'need-auth' })
  })

  it('abandonne sur un 401 avec un jeton tout neuf', async () => {
    const outcome = await runSync(input({ freshToken: true, drive: fakeDrive({ error: new DriveError(401) }) }))
    expect(outcome).toEqual({ kind: 'error', error: 'auth-failed' })
  })

  it('remonte les autres erreurs Drive avec leur code', async () => {
    const outcome = await runSync(input({ drive: fakeDrive({ error: new DriveError(503) }) }))
    expect(outcome).toEqual({ kind: 'error', error: 'drive-error', status: 503 })
  })

  it('traite un échec réseau de fetch comme une absence de connexion', async () => {
    const outcome = await runSync(input({ drive: fakeDrive({ error: new TypeError('Load failed') }) }))
    expect(outcome).toEqual({ kind: 'error', error: 'offline' })
  })
})
```

`src/ui/messages.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { errorMessage, mergeMessage, syncMessage } from './messages'

describe('messages', () => {
  it('résume une synchro avec les bons pluriels', () => {
    expect(mergeMessage({ added: 12, removed: 1, restored: 0 })).toBe('12 nouveaux mots · 1 retiré')
    expect(mergeMessage({ added: 1, removed: 0, restored: 2 })).toBe('1 nouveau mot · 0 retiré · 2 revenus')
  })

  it('indique le code HTTP d’une erreur Drive', () => {
    expect(errorMessage('drive-error', 503)).toBe('Erreur Google Drive (503).')
  })

  it('explique comment exporter quand aucun export n’est trouvé', () => {
    expect(errorMessage('no-export')).toContain('Exporter vers Google Sheets')
  })

  it('dit « Déjà à jour » quand rien n’a changé', () => {
    expect(syncMessage({ kind: 'up-to-date' })).toBe('Déjà à jour.')
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run: `npx vitest run src/sync.test.ts src/ui/messages.test.ts`
Expected: FAIL, avec « Failed to resolve import ».

- [ ] **Step 3 : Implémenter**

`src/sync.ts` :

```ts
import { parseExport } from './domain/csv'
import { mergeImport, type MergeResult } from './domain/merge'
import type { SyncMeta } from './domain/types'
import { DriveError, type DriveApi } from './google/drive'
import type { Snapshot } from './storage/db'

export type SyncError =
  | 'offline'
  | 'auth-denied'
  | 'auth-failed'
  | 'state-mismatch'
  | 'no-export'
  | 'unrecognized-format'
  | 'drive-error'

export type SyncOutcome =
  | { kind: 'need-auth' }
  | { kind: 'up-to-date' }
  | { kind: 'merged'; merge: MergeResult; meta: SyncMeta }
  | { kind: 'error'; error: SyncError; status?: number }

export type SyncInput = {
  /** Jeton utilisable, ou null s'il faut passer par Google. */
  token: string | null
  /** Vrai si le jeton vient d'être obtenu : un 401 ne relance alors pas une redirection. */
  freshToken: boolean
  online: boolean
  snapshot: Pick<Snapshot, 'words' | 'syncMeta'>
  drive: DriveApi
  now: Date
}

/** Récupère le dernier export et calcule la fusion ; n'écrit rien. */
export async function runSync({ token, freshToken, online, snapshot, drive, now }: SyncInput): Promise<SyncOutcome> {
  if (!online) return { kind: 'error', error: 'offline' }
  if (!token) return { kind: 'need-auth' }
  try {
    const file = await drive.findLatestExport(token)
    if (!file) return { kind: 'error', error: 'no-export' }
    const last = snapshot.syncMeta
    if (last && last.fileId === file.id && last.modifiedTime === file.modifiedTime) return { kind: 'up-to-date' }

    const { pairs } = parseExport(await drive.exportCsv(token, file.id))
    if (pairs.length === 0) return { kind: 'error', error: 'unrecognized-format' }

    return {
      kind: 'merged',
      merge: mergeImport(snapshot.words, pairs, now),
      meta: { fileId: file.id, modifiedTime: file.modifiedTime, syncedAt: now.toISOString() },
    }
  } catch (error) {
    if (error instanceof DriveError) {
      if (error.status === 401) return freshToken ? { kind: 'error', error: 'auth-failed' } : { kind: 'need-auth' }
      return { kind: 'error', error: 'drive-error', status: error.status }
    }
    if (error instanceof TypeError) return { kind: 'error', error: 'offline' } // échec réseau de fetch
    throw error
  }
}
```

`src/ui/messages.ts` :

```ts
import type { MergeStats } from '../domain/merge'
import type { SyncError, SyncOutcome } from '../sync'

export const EXPORT_HELP =
  'Sur un ordinateur, ouvre translate.google.com → Enregistrées → Exporter vers Google Sheets, puis relance la synchro.'

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

export function mergeMessage({ added, removed, restored }: MergeStats): string {
  const parts = [plural(added, 'nouveau mot', 'nouveaux mots'), plural(removed, 'retiré', 'retirés')]
  if (restored > 0) parts.push(plural(restored, 'revenu', 'revenus'))
  return parts.join(' · ')
}

export function errorMessage(error: SyncError, status?: number): string {
  switch (error) {
    case 'offline':
      return 'Pas de connexion. Tu peux quand même réviser.'
    case 'auth-denied':
      return 'Accès Google refusé.'
    case 'auth-failed':
      return 'Connexion Google impossible.'
    case 'state-mismatch':
      return 'Connexion interrompue, réessaie.'
    case 'no-export':
      return `Aucun export trouvé dans ton Drive. ${EXPORT_HELP}`
    case 'unrecognized-format':
      return 'Format de l’export non reconnu. Rien n’a été modifié.'
    case 'drive-error':
      return `Erreur Google Drive (${status ?? '?'}).`
  }
}

export function syncMessage(outcome: Exclude<SyncOutcome, { kind: 'need-auth' }>): string {
  switch (outcome.kind) {
    case 'up-to-date':
      return 'Déjà à jour.'
    case 'merged':
      return mergeMessage(outcome.merge.stats)
    case 'error':
      return errorMessage(outcome.error, outcome.status)
  }
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run: `npx vitest run src/sync.test.ts src/ui/messages.test.ts`
Expected: PASS (12 + 4 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/sync.ts src/sync.test.ts src/ui/messages.ts src/ui/messages.test.ts
git commit -m "Synchro de bout en bout et messages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13 : Interface

**Files:**
- Create: `src/ui/App.tsx`, `src/ui/Home.tsx`, `src/ui/Review.tsx`, `src/ui/Settings.tsx`, `src/ui/share.ts`, `src/styles.css`
- Modify: `src/main.tsx` (remplacé)
- Delete: `src/ui/Diagnostic.tsx`
- Test: pas de test automatique. L'interface est vérifiée à la main au format iPhone (étape 5).

**Interfaces:**
- Consumes: tout ce qui précède (`openStore`, `buildQueue`, `isNew`, session, `runSync`, `beginAuth`, `consumeRedirect`, `usableToken`, `createDriveApi`, config, messages, backup).
- Produces: l'app complète.

- [ ] **Step 1 : Écrire les composants**

`src/ui/App.tsx` :

```tsx
import { useEffect, useRef, useState } from 'preact/hooks'
import { EXPORT_FILE_NAMES, GOOGLE_CLIENT_ID, redirectUri } from '../config'
import { buildQueue } from '../domain/queue'
import { isNew } from '../domain/scheduler'
import type { StoredCard } from '../domain/types'
import { beginAuth, consumeRedirect, usableToken, type Token } from '../google/auth'
import { createDriveApi } from '../google/drive'
import { openStore, type Snapshot, type Store } from '../storage/db'
import { runSync } from '../sync'
import { Home } from './Home'
import { errorMessage, syncMessage } from './messages'
import { Review } from './Review'
import { Settings } from './Settings'

type Screen = { name: 'home' } | { name: 'review'; queue: StoredCard[] } | { name: 'settings' }

const drive = createDriveApi(EXPORT_FILE_NAMES)

export function App() {
  const [store, setStore] = useState<Store | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [message, setMessage] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [persistDenied, setPersistDenied] = useState(false)
  const token = useRef<Token | null>(null)

  useEffect(() => {
    void start()
  }, [])

  async function start() {
    let opened: Store
    let loaded: Snapshot
    try {
      opened = await openStore()
      loaded = await opened.load()
    } catch {
      setMessage('Stockage indisponible sur ce navigateur (navigation privée ?).')
      return
    }
    setStore(opened)
    setSnapshot(loaded)
    navigator.storage?.persist?.().then((ok) => setPersistDenied(!ok), () => setPersistDenied(true))

    const outcome = consumeRedirect(location.hash, localStorage, Date.now())
    if (outcome.kind === 'none') return
    history.replaceState(null, '', location.pathname + location.search)
    if (outcome.kind === 'error') setMessage(errorMessage(outcome.error))
    if (outcome.kind === 'token') {
      token.current = outcome.token
      if (outcome.resumeSync) await sync(opened, loaded, true)
    }
  }

  async function sync(target: Store, current: Snapshot, freshToken: boolean) {
    setSyncing(true)
    setMessage(null)
    try {
      const outcome = await runSync({
        token: usableToken(token.current, Date.now()),
        freshToken,
        online: navigator.onLine,
        snapshot: current,
        drive,
        now: new Date(),
      })
      if (outcome.kind === 'need-auth') {
        token.current = null
        const request = { clientId: GOOGLE_CLIENT_ID, redirectUri: redirectUri(), state: crypto.randomUUID() }
        location.assign(beginAuth(request, localStorage))
        return
      }
      if (outcome.kind === 'merged') {
        await target.applySync(outcome.merge.words, outcome.merge.newCards, outcome.meta)
        setSnapshot(await target.load())
      }
      setMessage(syncMessage(outcome))
    } catch (error) {
      setMessage(`Erreur inattendue : ${String(error)}`)
    } finally {
      setSyncing(false)
    }
  }

  async function reload() {
    if (store) setSnapshot(await store.load())
  }

  if (!store || !snapshot) return <main class="screen">{message ?? 'Chargement…'}</main>

  if (screen.name === 'review') {
    return (
      <Review
        queue={screen.queue}
        words={snapshot.words}
        onSave={(card) => store.saveCard(card)}
        onExit={async () => {
          await reload()
          setScreen({ name: 'home' })
        }}
      />
    )
  }

  if (screen.name === 'settings') {
    return (
      <Settings
        snapshot={snapshot}
        persistDenied={persistDenied}
        onSaveSettings={async (settings) => {
          await store.saveSettings(settings)
          await reload()
        }}
        onRestore={async (restored) => {
          await store.replaceAll(restored)
          await reload()
        }}
        onBack={() => setScreen({ name: 'home' })}
      />
    )
  }

  const queue = buildQueue({ ...snapshot, now: new Date() })
  const newCount = queue.filter((c) => isNew(c.fsrs)).length
  return (
    <Home
      dueCount={queue.length - newCount}
      newCount={newCount}
      lastSync={snapshot.syncMeta?.syncedAt ?? null}
      syncing={syncing}
      message={message}
      onReview={() => {
        setMessage(null)
        setScreen({ name: 'review', queue })
      }}
      onSync={() => void sync(store, snapshot, false)}
      onSettings={() => setScreen({ name: 'settings' })}
    />
  )
}
```

`src/ui/Home.tsx` :

```tsx
type Props = {
  dueCount: number
  newCount: number
  lastSync: string | null
  syncing: boolean
  message: string | null
  onReview: () => void
  onSync: () => void
  onSettings: () => void
}

const formatDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

export function Home(props: Props) {
  const empty = props.dueCount + props.newCount === 0
  return (
    <main class="screen home">
      <header class="topbar">
        <h1>Vocab</h1>
        <button class="ghost" onClick={props.onSettings}>
          Réglages
        </button>
      </header>

      <section class="counts">
        <div>
          <strong>{props.dueCount}</strong>
          <span>à revoir</span>
        </div>
        <div>
          <strong>{props.newCount}</strong>
          <span>nouvelles</span>
        </div>
      </section>

      <button class="primary big" disabled={empty} onClick={props.onReview}>
        {empty ? 'Rien à réviser' : 'Réviser'}
      </button>

      {props.message && (
        <p class="message" role="status">
          {props.message}
        </p>
      )}

      <footer class="sync">
        <button class="secondary" disabled={props.syncing} onClick={props.onSync}>
          {props.syncing ? 'Synchronisation…' : 'Synchroniser'}
        </button>
        <small>{props.lastSync ? `Dernière synchro : ${formatDate(props.lastSync)}` : 'Jamais synchronisé'}</small>
      </footer>
    </main>
  )
}
```

`src/ui/Review.tsx` :

```tsx
import { useMemo, useState } from 'preact/hooks'
import { answer, canUndo, currentCard, progress, startSession, summary, undo, type Step } from '../domain/session'
import type { Grade, StoredCard, Word } from '../domain/types'

type Props = {
  queue: StoredCard[]
  words: Word[]
  onSave: (card: StoredCard) => Promise<void>
  onExit: () => void
}

export function Review({ queue, words, onSave, onExit }: Props) {
  const [state, setState] = useState(() => startSession(queue))
  const [flipped, setFlipped] = useState(false)
  const byKey = useMemo(() => new Map(words.map((w) => [w.key, w])), [words])

  async function apply(step: Step) {
    setState(step.state)
    setFlipped(false)
    if (step.save) await onSave(step.save)
  }

  const card = currentCard(state)
  if (!card) {
    const { total, percent } = summary(state)
    return (
      <main class="screen done">
        <h2>Terminé</h2>
        <p>
          {total} {total > 1 ? 'cartes' : 'carte'} · {percent} % sues
        </p>
        <button class="primary big" onClick={onExit}>
          Retour
        </button>
        {canUndo(state) && (
          <button class="ghost" onClick={() => void apply(undo(state))}>
            Annuler la dernière réponse
          </button>
        )}
      </main>
    )
  }

  const word = byKey.get(card.wordKey)
  const english = word?.en ?? card.wordKey
  const french = word?.fr.join(' ; ') ?? ''
  const [front, back] = card.direction === 'en-fr' ? [english, french] : [french, english]
  const { done, total } = progress(state)
  const grade = (g: Grade) => void apply(answer(state, g, new Date()))
  const size = (text: string) => (text.length > 40 ? ' long' : '')

  return (
    <main class="screen review">
      <header class="topbar">
        <button class="ghost" onClick={onExit}>
          Fermer
        </button>
        <span class="progress">
          {done} / {total}
        </span>
        <button class="ghost" disabled={!canUndo(state)} onClick={() => void apply(undo(state))}>
          Annuler
        </button>
      </header>

      <button class="card" onClick={() => setFlipped(true)} aria-label={flipped ? 'Carte retournée' : 'Retourner la carte'}>
        <span class="direction">{card.direction === 'en-fr' ? 'Anglais → Français' : 'Français → Anglais'}</span>
        <span class={`front${size(front)}`}>{front}</span>
        {flipped ? <span class={`back${size(back)}`}>{back}</span> : <span class="hint">Touche pour voir la réponse</span>}
      </button>

      <footer class="answers">
        {flipped && (
          <>
            <button class="fail" onClick={() => grade('pas-su')}>
              Pas su
            </button>
            <button class="pass" onClick={() => grade('su')}>
              Su
            </button>
          </>
        )}
      </footer>
    </main>
  )
}
```

`src/ui/share.ts` :

```ts
/** Propose le fichier via la feuille de partage (iOS : « Enregistrer dans Fichiers »), sinon le télécharge. */
export async function shareOrDownload(fileName: string, text: string): Promise<void> {
  const file = new File([text], fileName, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (error) {
      if ((error as Error).name !== 'AbortError') throw error
    }
    return
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
```

`src/ui/Settings.tsx` :

```tsx
import { useState } from 'preact/hooks'
import type { Settings as SettingsValue } from '../domain/types'
import { backupFileName, makeBackup, parseBackup } from '../storage/backup'
import type { Snapshot } from '../storage/db'
import { EXPORT_HELP } from './messages'
import { shareOrDownload } from './share'

type Props = {
  snapshot: Snapshot
  persistDenied: boolean
  onSaveSettings: (settings: SettingsValue) => Promise<void>
  onRestore: (snapshot: Snapshot) => Promise<void>
  onBack: () => void
}

export function Settings({ snapshot, persistDenied, onSaveSettings, onRestore, onBack }: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const active = snapshot.words.filter((w) => w.status === 'actif').length

  async function exportBackup() {
    const now = new Date()
    try {
      await shareOrDownload(backupFileName(now), JSON.stringify(makeBackup(snapshot, now)))
    } catch (error) {
      setMessage(`Export impossible : ${String(error)}`)
    }
  }

  async function restore(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const restored = parseBackup(await file.text())
      if (!confirm('Remplacer toutes les données actuelles ?')) return
      await onRestore(restored)
      setMessage(`Sauvegarde restaurée : ${restored.words.length} mots.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  function changeNewPerDay(event: Event) {
    const value = Math.round(Number((event.currentTarget as HTMLInputElement).value))
    if (Number.isFinite(value) && value >= 0 && value <= 100) void onSaveSettings({ newPerDay: value })
  }

  return (
    <main class="screen settings">
      <header class="topbar">
        <button class="ghost" onClick={onBack}>
          Retour
        </button>
        <h1>Réglages</h1>
        <span />
      </header>

      <section>
        <label class="row">
          Nouvelles cartes par jour
          <input type="number" inputMode="numeric" min={0} max={100} value={snapshot.settings.newPerDay} onChange={changeNewPerDay} />
        </label>
        <p class="note">{active} mots actifs.</p>
      </section>

      <section>
        <h2>Sauvegarde</h2>
        <button class="secondary" onClick={() => void exportBackup()}>
          Exporter une sauvegarde
        </button>
        <label class="secondary file">
          Restaurer une sauvegarde
          <input type="file" accept="application/json,.json" onChange={(e) => void restore(e)} />
        </label>
        {persistDenied && <p class="note warning">Le stockage de l’app n’est pas garanti sur cet appareil : fais des sauvegardes régulières.</p>}
        {message && (
          <p class="message" role="status">
            {message}
          </p>
        )}
      </section>

      <section>
        <h2>Ajouter des mots</h2>
        <p class="note">{EXPORT_HELP}</p>
      </section>
    </main>
  )
}
```

- [ ] **Step 2 : Styles et point d'entrée**

`src/styles.css` :

```css
:root {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --text: #16181d;
  --muted: #5d6573;
  --accent: #1f6feb;
  --accent-text: #ffffff;
  --pass: #1a7f37;
  --fail: #cf222e;
  --border: #d8dce3;
  color-scheme: light dark;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-text-size-adjust: 100%;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1115;
    --surface: #1b1e24;
    --text: #eceff4;
    --muted: #9aa3b2;
    --accent: #4c8dff;
    --pass: #3fb950;
    --fail: #f85149;
    --border: #30353e;
  }
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
  background: var(--bg);
  color: var(--text);
}

button,
input,
label.file {
  font: inherit;
  -webkit-tap-highlight-color: transparent;
}

button {
  cursor: pointer;
  border: none;
  border-radius: 14px;
  min-height: 48px;
  padding: 0 18px;
  touch-action: manipulation;
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}

.screen {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100dvh;
  max-width: 560px;
  margin: 0 auto;
  padding: calc(env(safe-area-inset-top) + 12px) 16px calc(env(safe-area-inset-bottom) + 16px);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.topbar h1 {
  margin: 0;
  font-size: 1.4rem;
}

.ghost {
  background: transparent;
  color: var(--accent);
  padding: 0 8px;
}

.primary {
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 600;
}

.secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  background: var(--surface);
  color: var(--accent);
  border: 1px solid var(--border);
  border-radius: 14px;
  font-weight: 600;
}

.big {
  min-height: 64px;
  font-size: 1.2rem;
}

.counts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8vh;
}

.counts div {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 8px;
  background: var(--surface);
  border-radius: 18px;
}

.counts strong {
  font-size: 2.6rem;
}

.counts span,
.note,
.sync small {
  color: var(--muted);
}

.message {
  margin: 0;
  padding: 12px 14px;
  background: var(--surface);
  border-left: 4px solid var(--accent);
  border-radius: 8px;
}

.sync {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}

.review .progress {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.card {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 24px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 24px;
  text-align: center;
  white-space: pre-line;
}

.card .direction,
.card .hint {
  color: var(--muted);
  font-size: 0.9rem;
}

.card .front {
  font-size: 2rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.card .back {
  padding-top: 18px;
  border-top: 1px solid var(--border);
  font-size: 1.5rem;
  color: var(--accent);
  overflow-wrap: anywhere;
}

.card .long {
  font-size: 1.25rem;
  font-weight: 500;
}

.answers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-height: 64px;
}

.answers button {
  min-height: 64px;
  font-size: 1.15rem;
  font-weight: 600;
  color: #ffffff;
}

.answers .fail {
  background: var(--fail);
}

.answers .pass {
  background: var(--pass);
}

.done {
  justify-content: center;
  text-align: center;
}

.settings section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings h2 {
  margin: 8px 0 0;
  font-size: 1.05rem;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.row input {
  width: 80px;
  min-height: 44px;
  padding: 0 10px;
  font-size: 1rem;
  text-align: center;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
}

label.file input {
  display: none;
}

.warning {
  color: var(--fail);
}
```

`src/main.tsx` (remplace la version de diagnostic) :

```tsx
import { render } from 'preact'
import { App } from './ui/App'
import './styles.css'

render(<App />, document.getElementById('app')!)
```

- [ ] **Step 3 : Supprimer l'écran de diagnostic**

Run: `git rm src/ui/Diagnostic.tsx`

- [ ] **Step 4 : Vérifier tests et build**

Run: `npm test && npm run build`
Expected: 88 tests PASS (plus ceux ajoutés à la tâche 5, étape 3), build sans erreur.

- [ ] **Step 5 : Vérification à la main au format iPhone**

1. Lancer `npm run dev` et ouvrir `http://localhost:5173/vocab-review/` dans le navigateur, en vue mobile (375×812).
2. **Premier lancement** : l'accueil affiche 0 et 0, « Rien à réviser » (bouton désactivé) et « Jamais synchronisé », sans erreur dans la console.
3. Remplir la base de test en exécutant ce script dans la console de la page. Il ajoute 5 mots, dont 2 déjà révisés et dus, et une phrase longue :

```js
const now = new Date(); const iso = (d) => d.toISOString();
const fresh = () => ({ due: iso(now), stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 0 });
const reviewed = () => ({ due: iso(new Date(now - 864e5)), stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 3, learning_steps: 0, reps: 1, lapses: 0, state: 2, last_review: iso(new Date(now - 4 * 864e5)) });
const long = 'I would have been able to get there on time if the train had not been cancelled at the very last minute';
const entries = [['reach', ['atteindre', 'parvenir à']], ['thoroughly', ['minutieusement']], ['to cope with', ['faire face à']], ['shortcoming', ['défaut', 'lacune']], [long, ["J'aurais pu arriver à l'heure si le train n'avait pas été annulé à la toute dernière minute"]]];
const words = entries.map(([en, fr], order) => ({ key: en.toLowerCase(), en, fr, status: 'actif', addedAt: iso(now), order }));
const cards = words.flatMap((w, i) => [
  { id: w.key + ':en-fr', wordKey: w.key, direction: 'en-fr', fsrs: i < 2 ? reviewed() : fresh(), ...(i < 2 ? { introducedAt: iso(new Date(now - 4 * 864e5)) } : {}) },
  { id: w.key + ':fr-en', wordKey: w.key, direction: 'fr-en', fsrs: fresh() },
]);
const req = indexedDB.open('vocab-review', 1);
req.onsuccess = () => { const db = req.result; const tx = db.transaction(['words', 'cards'], 'readwrite'); words.forEach((w) => tx.objectStore('words').put(w)); cards.forEach((c) => tx.objectStore('cards').put(c)); tx.oncomplete = () => location.reload(); };
```

4. Vérifier en parcourant l'app :
   - l'accueil affiche **2 à revoir** et **3 nouvelles** ;
   - « Réviser » montre la carte `reach` ; toucher la carte fait apparaître « atteindre ; parvenir à » et les deux boutons ;
   - « Pas su » : la carte suivante s'affiche et « Annuler » devient actif ; « Annuler » ramène `reach` ;
   - la phrase longue s'affiche en plus petit, et les boutons restent visibles une fois la carte retournée ;
   - toucher deux fois très vite « Su » ne compte qu'une réponse : le compteur avance de 1 et la carte suivante s'affiche au recto ;
   - en fin de session, « N cartes · X % sues » et « Annuler la dernière réponse » s'affichent ; ce bouton ramène la dernière carte ;
   - « Retour » : l'accueil se met à jour, et `reach`, ratée, n'est plus due aujourd'hui ;
   - Réglages : changer « Nouvelles cartes par jour » à 5, revenir puis rouvrir les réglages : la valeur 5 est conservée.
5. Ne pas tester « Synchroniser » ici : sans session Google dans ce navigateur, l'app redirige vers Google. C'est testé sur iPhone à la tâche 14.

- [ ] **Step 6 : Commit**

```bash
git add src/ui src/styles.css src/main.tsx
git commit -m "Interface : accueil, révision, réglages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14 : Recette sur iPhone et mise en ligne

**Files:** aucun, sauf correctifs éventuels.

- [ ] **Step 1 : Publier**

Run: `git push`
Expected: le workflow « Déploiement » est vert.

- [ ] **Step 2 : [Avec l'utilisateur] Recette sur iPhone**

L'app déjà installée à la tâche 4 se met à jour toute seule. Si l'ancienne version s'affiche encore, la fermer et la rouvrir. Cocher avec l'utilisateur :
- [ ] L'accueil s'ouvre depuis l'icône, en plein écran, sans barre Safari.
- [ ] « Synchroniser » → redirection Google → retour dans l'app → « N nouveaux mots · 0 retiré ».
- [ ] « Synchroniser » une seconde fois → « Déjà à jour. ».
- [ ] Une session complète au pouce : retourner la carte, « Su », « Pas su », « Annuler », écran de fin.
- [ ] Mode avion → rouvrir l'app → la révision fonctionne, et « Synchroniser » affiche « Pas de connexion. Tu peux quand même réviser. ».
- [ ] Fermer complètement l'app (balayer vers le haut), la rouvrir : la progression est conservée.
- [ ] Réglages → « Exporter une sauvegarde » → la feuille de partage iOS s'ouvre → Enregistrer dans Fichiers.
- [ ] Réglages → « Restaurer une sauvegarde » → choisir ce fichier → confirmer → « Sauvegarde restaurée : N mots. ».
- [ ] Enregistrer un nouveau mot dans Google Translate, refaire l'export sur ordinateur, « Synchroniser » → « 1 nouveau mot · 0 retiré ».

- [ ] **Step 3 : Corriger si besoin**

Pour tout point en échec, utiliser superpowers:systematic-debugging. Chaque correctif fait l'objet de son propre commit.

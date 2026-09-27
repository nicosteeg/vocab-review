# Vocab Review — spec de conception

Date : 2026-09-27 · Statut : validée en discussion, en relecture

## 1. Objectif

Une app personnelle pour réviser le vocabulaire anglais enregistré dans Google Translate, utilisée surtout sur iPhone.

**Critère de réussite :** après un export depuis Google Translate, un seul bouton sur l'iPhone récupère les nouveaux mots. Ensuite, quelques minutes de révision par jour au pouce, sans jamais perdre la progression.

### Ce qui a été demandé

- Réviser le vocabulaire anglais issu des traductions enregistrées dans Google Translate.
- Usage principal sur smartphone, un iPhone.
- Pour un seul utilisateur.
- Révision en flashcards avec répétition espacée, dans les deux sens (EN→FR et FR→EN), chacun avec sa propre progression.
- Récupération des mots via une connexion Google.
- Hébergement sur GitHub Pages.
- Une sauvegarde et une restauration manuelles de la progression.

### Hypothèses

- On ne garde que les paires anglais ↔ français. Les autres paires de langues sont ignorées.
- L'interface est en français.
- La progression reste sur l'appareil : pas de synchro entre appareils.
- La révision marche hors ligne. Seule la synchro a besoin du réseau.
- Google Translate est la seule source de mots : pas d'ajout manuel dans l'app.

### Contrainte de départ

Google Translate n'a **pas d'API** pour les traductions enregistrées. La seule sortie officielle est translate.google.com → **Enregistrées** → **Exporter vers Google Sheets**. Elle crée une feuille dans le Drive de l'utilisateur et n'existe que sur le web, pas dans l'app mobile. L'app lit donc cette feuille via l'API Google Drive.

### Hors périmètre (version 1)

- Liste ou recherche de mots.
- Statistiques détaillées, série de jours.
- Prononciation audio.
- Notifications.
- Synchro entre appareils.
- Import CSV manuel.
- Ajout de mots à la main.
- Modes de révision autres que les flashcards.

## 2. Architecture

- **PWA statique, sans serveur** : Vite + TypeScript + Preact.
- **Service worker** (`vite-plugin-pwa`) :
  - l'app se lance et révise hors ligne ;
  - elle s'installe sur iOS depuis Safari (Partager → Sur l'écran d'accueil) ;
  - manifest en `display: standalone`, scope et `start_url` = `/vocab-review/`, avec une `apple-touch-icon`.
- **Stockage** : IndexedDB via la bibliothèque `idb`. Au démarrage, l'app appelle `navigator.storage.persist()`.
- **Répétition espacée** : la bibliothèque `ts-fsrs`, avec ses paramètres par défaut.
- **Lecture du CSV** : `papaparse`.
- **Déploiement** : une GitHub Action build puis publie sur GitHub Pages à chaque push sur `main`. L'URL est `https://<compte>.github.io/vocab-review/` et la `base` Vite est `/vocab-review/`.

### Découpage en modules

Chaque module a un seul rôle. Toute la logique métier (`domain/`) est faite de fonctions pures, sans accès au réseau, au stockage ni à l'horloge : la date `now` est toujours passée en paramètre.

| Module | Rôle | Dépend de |
|---|---|---|
| `src/domain/csv.ts` | `parseExport(csvText)` → `{ pairs: {en, fr}[], skipped }`. Reconnaît les langues et remet les paires dans le sens EN/FR. | papaparse |
| `src/domain/merge.ts` | `mergeImport(words, cards, pairs, now)` → nouvel état + stats (`added`, `removed`, `restored`, `updated`). | — |
| `src/domain/scheduler.ts` | Enveloppe `ts-fsrs` : `newCard(now)`, `rate(card, 'su' \| 'pas-su', now)`. | ts-fsrs |
| `src/domain/studyDay.ts` | Donne le « jour d'étude » d'une date : un jour change à 4 h du matin, heure locale. | — |
| `src/domain/session.ts` | `buildQueue(...)`, puis `answer(state, rating, now)` et `undo(state)`. Machine à états d'une session. | scheduler, studyDay |
| `src/storage/db.ts` | Lecture et écriture IndexedDB : mots, cartes, réglages, infos de synchro. Écritures groupées en une seule transaction. | idb |
| `src/storage/backup.ts` | `exportBackup()` → JSON ; `validateBackup(json)` ; `restoreBackup(json)`, qui remplace toutes les données. | db |
| `src/google/auth.ts` | Connexion OAuth par redirection : `startAuth()`, `consumeRedirect()`, `getToken()`. | — |
| `src/google/drive.ts` | `findLatestExport(token)` et `exportCsv(token, fileId)`, via `fetch`. | — |
| `src/sync.ts` | Enchaîne les étapes : auth → drive → csv → merge → db. Renvoie un résultat typé (succès + stats, ou erreur connue). | tous |
| `src/ui/*` | `App` (navigation par simple état, sans routeur), `Home`, `Review`, `Settings`. | sync, session, db, backup |
| `src/config.ts` | Identifiant client OAuth (non secret) et constantes. | — |

## 3. Données

```ts
type Word = {
  key: string;            // texte anglais normalisé (identifiant)
  en: string;             // texte affiché, tel qu'il est apparu la 1re fois
  fr: string[];           // traductions françaises, dans l'ordre de l'export
  status: 'actif' | 'retiré';
  addedAt: string;        // ISO, date de la 1re synchro qui l'a apporté
  order: number;          // rang d'ajout, sert à l'ordre des nouvelles cartes
};

type CardDirection = 'en-fr' | 'fr-en';

type StoredCard = {
  id: string;             // `${key}:${direction}`
  wordKey: string;
  direction: CardDirection;
  fsrs: FsrsCard;         // état ts-fsrs (due, stability, difficulty, state, last_review, …)
  introducedAt?: string;  // ISO, date de la 1re révision (absent tant que la carte est nouvelle)
};

type Settings = { newPerDay: number };                       // défaut : 10
type SyncMeta = { fileId: string; modifiedTime: string; syncedAt: string };
```

**Normalisation de la clé :** NFC, trim, espaces multiples réduits à un seul, minuscules.

Deux paires qui ont la même clé anglaise donnent **un seul mot**, qui porte plusieurs traductions. Les doublons de traduction sont retirés en comparant les versions normalisées.

## 4. Synchronisation

### 4.1 Connexion Google (iOS, sans popup)

L'app utilise le flux OAuth 2.0 « client-side web app » (`response_type=token`), en **redirection pleine page**. Un popup ne marche pas de façon fiable dans une PWA iOS en mode standalone.

1. `startAuth()` :
   - tire un `state` au hasard et le met dans `sessionStorage` avec un indicateur « synchro en attente » ;
   - redirige vers `https://accounts.google.com/o/oauth2/v2/auth` avec `client_id`, `redirect_uri` = `location.origin + BASE_URL`, `response_type=token`, `scope=https://www.googleapis.com/auth/drive.readonly`, `include_granted_scopes=true` et `state`.
2. Au chargement, `consumeRedirect()` :
   - lit le fragment d'URL et vérifie le `state` ;
   - garde `access_token` et son expiration **en mémoire uniquement** ;
   - nettoie l'URL avec `history.replaceState` ;
   - si une synchro était en attente, la relance automatiquement.
3. Le projet Google Cloud reste en mode **Test**, avec l'utilisateur comme seul testeur. Pas de validation Google nécessaire ; l'écran « application non vérifiée » est attendu la première fois.

### 4.2 Trouver et lire l'export

1. **Recherche** : `GET https://www.googleapis.com/drive/v3/files`
   - `q = mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (name contains 'Saved translations' or name contains '<nom FR à confirmer>')`
   - `orderBy=modifiedTime desc`, `pageSize=1`, `fields=files(id,name,modifiedTime)`
2. Si `fileId` et `modifiedTime` sont les mêmes que dans `SyncMeta` → « Déjà à jour », rien d'autre.
3. **Export** : `GET https://www.googleapis.com/drive/v3/files/{id}/export?mimeType=text/csv`. Ça exporte le premier onglet.

**Format attendu, à confirmer sur un vrai export :** 4 colonnes `langue source, langue cible, texte source, texte traduit`, a priori sans ligne d'en-tête.

**Reconnaissance des langues :** on compare en ignorant la casse et les accents.
- EN : `english`, `anglais`, `en`.
- FR : `french`, `francais`, `fr`.

Une ligne FR→EN est remise dans le sens `{ en: cible, fr: source }`. Les lignes d'autres langues et les lignes vides comptent dans `skipped`.

### 4.3 Règles de fusion (`mergeImport`)

L'export est considéré comme le reflet exact de la liste Google Translate :

| Cas | Effet |
|---|---|
| Clé absente en base | Nouveau `Word` actif, avec 2 cartes FSRS neuves (`en-fr`, `fr-en`). |
| Clé présente, active | Progression conservée. `fr` est remplacé par les traductions de l'export. |
| Clé présente, `retiré` | Repasse en `actif`, progression conservée, `fr` mis à jour. |
| Mot actif absent de l'export | Passe en `retiré`. Ses cartes ne sortent plus en révision, mais leur état est conservé. |

**Garde-fou :** si l'export ne contient **aucune** paire EN↔FR reconnue, la synchro s'arrête (« Format non reconnu ») et rien n'est écrit. Sans ça, un format illisible ferait passer tous les mots en « retiré ».

Toutes les écritures d'une synchro (mots, cartes, `SyncMeta`) se font dans **une seule transaction IndexedDB**.

**Résultat affiché :** « N nouveaux mots · M retirés », en ajoutant « · K revenus » s'il y en a.

## 5. Révision

### 5.1 Algorithme

- `ts-fsrs` avec les paramètres par défaut.
- Deux notes seulement : « Pas su » → `Rating.Again`, « Su » → `Rating.Good`.

### 5.2 Constitution de la file (`buildQueue`)

Seuls les mots `actif` comptent. Le jour d'étude change à 4 h du matin, heure locale.

1. **Cartes dues** : `fsrs.due <= now`, de la plus en retard à la moins en retard.
2. **Nouvelles cartes**, dans la limite de `newPerDay` moins le nombre de cartes déjà introduites ce jour d'étude (d'après `introducedAt`). Ordre : par `order` croissant, `en-fr` d'abord.
   - Une carte `fr-en` neuve n'est proposée que si la carte `en-fr` du même mot a déjà été révisée au moins une fois.
3. **Un sens par mot et par jour** : une carte est exclue si l'autre carte du même mot a été révisée ce jour d'étude, ou si elle est déjà dans la file.

### 5.3 Déroulement d'une session (`session.ts`)

- On montre le recto (mot anglais, ou traductions françaises pour `fr-en`). Toucher n'importe où retourne la carte.
- Le verso montre la réponse. Pour `en-fr`, toutes les traductions sont séparées par « ; ».
- **« Su »** : `rate(card, 'su')`, la carte est enregistrée et quitte la file.
- **« Pas su »** : `rate(card, 'pas-su')`, la carte est enregistrée et **remise en fin de file**. La session continue jusqu'à ce que la file soit vide.
- **« Annuler »** (un seul niveau) : restaure l'état de la carte d'avant la dernière réponse (en base aussi) et remet la carte en tête de file.
- **Fin de session** : « X cartes · Y % sues ». Le pourcentage se calcule sur la première réponse à chaque carte.
- Chaque réponse est écrite en base tout de suite : quitter l'app en cours de session ne perd rien.

### 5.4 Écrans

- **Accueil** :
  - « À revoir : N », « Nouvelles : M » ;
  - gros bouton « Réviser », désactivé s'il n'y a aucune carte ;
  - bouton « Synchroniser », avec la date de la dernière synchro ;
  - accès aux réglages.
- **Révision** : la carte occupe l'écran, et les deux boutons sont en bas, à portée de pouce (au moins 56 px de haut, en respectant `safe-area-inset-bottom`). Le bouton « Annuler » et la progression (« 12 / 30 ») sont en haut.
- **Réglages** :
  - nouvelles cartes par jour ;
  - « Exporter une sauvegarde » et « Restaurer une sauvegarde » ;
  - lien d'aide « Comment exporter depuis Google Translate ».

## 6. Sauvegarde

- **Export :**
  - JSON `{ app: 'vocab-review', version: 1, exportedAt, words, cards, settings, syncMeta }`, nommé `vocab-review-AAAA-MM-JJ.json` ;
  - sur iOS, partage via `navigator.share({ files })` pour l'enregistrer dans Fichiers ou iCloud Drive ;
  - s'il n'est pas disponible, un simple lien de téléchargement.
- **Restauration :**
  - choix du fichier, puis `validateBackup` (champ `app`, `version` connue, structure des mots et cartes) ;
  - confirmation : « Remplacer toutes les données actuelles ? » ;
  - remplacement complet en une seule transaction ;
  - un fichier invalide ne modifie rien.

## 7. Gestion des erreurs

`sync()` renvoie soit un succès, soit l'une des erreurs connues ci-dessous. Aucune erreur ne modifie les données.

| Erreur | Message et comportement |
|---|---|
| `offline` (`navigator.onLine` false, ou échec réseau) | « Pas de connexion. Tu peux quand même réviser. » |
| `auth-denied` (fragment avec `error=access_denied`) | « Accès Google refusé. » |
| `auth-expired` (401 de Drive) | Une nouvelle redirection automatique. Au deuxième 401 d'affilée : « Connexion Google impossible. » |
| `state-mismatch` | Retour ignoré, et « Connexion interrompue, réessaie. » |
| `no-export` | Explication pas à pas : translate.google.com → Enregistrées → Exporter vers Google Sheets. |
| `unrecognized-format` (0 paire reconnue) | « Format de l'export non reconnu. » Rien n'est modifié. |
| `drive-error` (autre code HTTP) | « Erreur Google Drive (code). » |

Au démarrage, si `navigator.storage.persist()` est refusé, les réglages le signalent discrètement et suggèrent de faire une sauvegarde.

## 8. Tests

- **Vitest, en écrivant les tests avant le code**, pour tout `src/domain/` :
  - lecture du CSV : alias de langues, guillemets, virgules et retours à la ligne dans les champs, ligne d'en-tête éventuelle, lignes ignorées ;
  - fusion : les quatre cas du tableau 4.3, doublons, garde-fou « 0 paire » ;
  - `studyDay` : bascule à 4 h ;
  - `buildQueue` : ordre des cartes dues, limite des nouvelles, `fr-en` bloquée tant que `en-fr` n'a pas été vue, un sens par mot et par jour ;
  - session : « Su », « Pas su » (remise en fin de file), « Annuler », calcul du pourcentage de la fin de session.
- **`google/`** : `fetch` et `location` simulés. Construction de l'URL d'auth, lecture et nettoyage du fragment, vérification du `state`, recherche, export, 401.
- **`storage/`** : avec `fake-indexeddb`. Transactions de synchro et de restauration, export → validation → restauration à l'identique, rejet d'un fichier invalide.
- **Vérification à la main** :
  - dans le navigateur, en format mobile, sur `localhost` ;
  - puis sur iPhone : installation sur l'écran d'accueil, connexion Google depuis l'app installée, synchro avec le vrai export, session de révision, mode avion, relance de l'app (progression conservée), sauvegarde puis restauration.

## 9. Mise en place Google Cloud (guide fourni dans `docs/google-cloud-setup.md`)

1. Créer un projet Google Cloud et activer **Google Drive API**.
2. Écran de consentement OAuth : type « Externe », statut **Test**, ajouter son propre compte comme utilisateur test, avec le scope `drive.readonly`.
3. Identifiants → ID client OAuth de type **Application Web** :
   - origines JavaScript autorisées : `https://<compte>.github.io` et `http://localhost:5173` ;
   - URI de redirection autorisées : `https://<compte>.github.io/vocab-review/` et `http://localhost:5173/vocab-review/`.
4. Copier l'ID client dans `src/config.ts`. Il n'est pas secret et peut être commité.

## 10. Risques et points à vérifier tôt

1. **Connexion Google depuis la PWA installée sur iOS.**
   - Hypothèse : la redirection vers `accounts.google.com` s'ouvre dans la vue navigateur intégrée d'iOS, puis revient dans l'app quand l'URL de retour est dans le scope.
   - C'est à vérifier **sur l'iPhone dès la première étape du plan**, avant de construire le reste.
   - La PWA installée a ses propres cookies, séparés de Safari : il faudra se connecter à Google une fois depuis l'app.
   - Solution de repli si ça ne marche pas : l'import CSV manuel, actuellement hors périmètre.
2. **Format réel de l'export** (nom du fichier, colonnes, ligne d'en-tête, noms de langue). Il faut quelques lignes d'un vrai export avant de coder `csv.ts`.
3. **Flux OAuth « token » (implicite).** Google le supporte encore pour les apps web côté client. Le flux par code + PKCE demanderait un secret client pour le type « Application Web », donc un serveur, ce qui sort de ce projet.

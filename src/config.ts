export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** Adresse de retour OAuth : la racine de l'app, en local comme sur GitHub Pages. */
export function redirectUri(): string {
  return `${location.origin}${import.meta.env.BASE_URL}`
}

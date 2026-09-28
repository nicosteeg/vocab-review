import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/vocab-review/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      // SPIKE JETABLE : la page de test du sélecteur ne doit pas être remplacée par l'app
      workbox: { navigateFallbackDenylist: [/picker-test/] },
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

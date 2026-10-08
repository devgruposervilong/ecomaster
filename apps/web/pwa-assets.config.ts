import { defineConfig } from '@vite-pwa/assets-generator/config'
import { minimal2023Preset } from '@vite-pwa/assets-generator/presets/minimal-2023'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { sizes: [512], padding: 0 },
  },
  images: ['public/logo-eco-master.png'],
})

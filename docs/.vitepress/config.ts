import { defineConfig, type DefaultTheme } from 'vitepress'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

// Deployed at https://bbuchsbaum.github.io/neuroatlasjs/
const base = '/neuroatlasjs/'
const version: string = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf-8'),
).version

// TypeDoc (via typedoc-vitepress-theme) writes the API sidebar here on `docs:api`.
// Load it defensively so `vitepress dev` works even before the first generation.
function apiSidebar(): DefaultTheme.SidebarItem[] {
  try {
    const json = readFileSync(
      fileURLToPath(new URL('../api/typedoc-sidebar.json', import.meta.url)),
      'utf-8',
    )
    return JSON.parse(json) as DefaultTheme.SidebarItem[]
  } catch {
    return [{ text: 'Run `npm run docs:api` to generate the reference', link: '/api/' }]
  }
}

export default defineConfig({
  base,
  lang: 'en-US',
  title: 'neuroatlasjs',
  titleTemplate: ':title · neuroatlasjs',
  description:
    'Typed brain atlases for JavaScript: validated region tables on volumes and surfaces, parcel summaries, and projection back to the brain.',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['meta', { name: 'theme-color', content: '#0f9b8e' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'neuroatlasjs — typed brain atlases for JavaScript' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Validated region tables on label volumes and surfaces, parcel summaries, and projection back to the brain.',
      },
    ],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      {
        text: `v${version}`,
        items: [
          { text: 'Source', link: 'https://github.com/bbuchsbaum/neuroatlasjs' },
          { text: 'neuroimjs', link: 'https://bbuchsbaum.github.io/neuroimjs/' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          collapsed: false,
          items: [
            { text: 'What is neuroatlasjs?', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Working with Atlases',
          collapsed: false,
          items: [
            { text: 'Naming & Finding Regions', link: '/guide/regions' },
            { text: 'Locating Regions', link: '/guide/locating' },
            { text: 'Summarizing Data by Parcel', link: '/guide/reducing' },
            { text: 'Parcel Values & Projection', link: '/guide/parcel-values' },
            { text: 'Surface Atlases', link: '/guide/surfaces' },
            { text: 'Without neuroimjs', link: '/guide/plain-arrays' },
          ],
        },
        {
          text: 'Reference',
          collapsed: false,
          items: [
            { text: 'Copies & Guarantees', link: '/guide/guarantees' },
            { text: 'Errors', link: '/guide/errors' },
            { text: 'API Reference', link: '/api/' },
          ],
        },
      ],
      '/api/': [{ text: 'API Reference', items: apiSidebar() }],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/bbuchsbaum/neuroatlasjs' }],

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/bbuchsbaum/neuroatlasjs/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026–present Bradley Buchsbaum',
    },

    outline: { level: [2, 3] },
  },

  // Example sources are included into pages; they are not pages themselves.
  srcExclude: ['snippets/**'],
})

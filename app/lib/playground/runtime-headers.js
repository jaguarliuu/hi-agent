export const WEBCONTAINER_HEADERS = [
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
];

export function getWebcontainerHeaderEntries() {
  return [
    {
      source: '/:path*',
      headers: WEBCONTAINER_HEADERS
    }
  ];
}

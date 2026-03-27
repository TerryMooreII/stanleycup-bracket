const logoModules = import.meta.glob('../assets/logos/*.svg', { eager: true, query: '?url', import: 'default' })

const logoMap = {}
for (const [path, url] of Object.entries(logoModules)) {
  const filename = path.split('/').pop().replace('.svg', '')
  logoMap[filename] = url
}

export function getLogoUrl(abbreviation) {
  return logoMap[abbreviation] || logoMap['NHL'] || ''
}

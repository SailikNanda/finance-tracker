// Capacitor 5 expects tar's old default export. Keep the Android 5/JDK 17
// project compatible with maintained tar 7 without reverting security fixes.
import fs from 'node:fs'
const path = new URL('../node_modules/@capacitor/cli/dist/util/template.js', import.meta.url)
const original = 'const tar_1 = tslib_1.__importDefault(require("tar"));'
const compatible = 'const tar_1 = { default: require("tar") };'
const source = fs.readFileSync(path, 'utf8')
if (source.includes(original)) fs.writeFileSync(path, source.replace(original, compatible))
else if (!source.includes(compatible)) throw new Error('Capacitor tar adapter changed; review compatibility before building')
console.log('Capacitor template extraction uses patched tar 7')

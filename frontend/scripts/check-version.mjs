import fs from 'node:fs'
const packageInfo = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)))
const gradle = fs.readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8')
const nativeVersion = gradle.match(/versionName "([^"]+)"/)?.[1]
if (nativeVersion !== packageInfo.version) throw new Error(`Android ${nativeVersion} differs from package.json ${packageInfo.version}`)
console.log(`Web and Android versions agree: ${packageInfo.version}`)

import fs from 'node:fs'
const version = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error('Version must be X.Y.Z')
const base = new URL('../', import.meta.url)
const pkgPath = new URL('package.json', base)
const lockPath = new URL('package-lock.json', base)
const gradlePath = new URL('android/app/build.gradle', base)
const pkg = JSON.parse(fs.readFileSync(pkgPath))
const lock = JSON.parse(fs.readFileSync(lockPath))
let gradle = fs.readFileSync(gradlePath, 'utf8')
const code = gradle.match(/versionCode (\d+)/)?.[1]
if (!code || !/versionName "[^"]+"/.test(gradle)) throw new Error('Android version fields missing')
if (pkg.version !== version) gradle = gradle.replace(/versionCode \d+/, `versionCode ${Number(code) + 1}`)
gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${version}"`)
pkg.version = lock.version = lock.packages[''].version = version
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
fs.writeFileSync(gradlePath, gradle)
console.log(`Version set to ${version}; Android versionCode ${gradle.match(/versionCode (\d+)/)[1]}`)

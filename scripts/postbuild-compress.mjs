import { brotliCompressSync, constants as zlibConstants, createGzip } from 'node:zlib'
import { createReadStream, createWriteStream, promises as fs } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { extname, join } from 'node:path'

const DIST_DIR = join(process.cwd(), 'dist')
const COMPRESSIBLE = new Set(['.js', '.css', '.html'])

const ensureDist = async () => {
  try {
    const stat = await fs.stat(DIST_DIR)
    if (!stat.isDirectory()) throw new Error('dist is not a directory')
  } catch (err) {
    throw new Error('dist not found. Run npm run build first.')
  }
}

const gzipFile = async (file) => {
  const gzPath = `${file}.gz`
  const source = createReadStream(file)
  const dest = createWriteStream(gzPath)
  const gzip = createGzip({ level: zlibConstants.Z_BEST_COMPRESSION })
  await pipeline(source, gzip, dest)
  return gzPath
}

const brotliFile = async (file) => {
  const data = await fs.readFile(file)
  const compressed = brotliCompressSync(data, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
    },
  })
  const brPath = `${file}.br`
  await fs.writeFile(brPath, compressed)
  return brPath
}

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const run = async () => {
  await ensureDist()
  const entries = await fs.readdir(DIST_DIR)
  const files = entries
    .map((name) => join(DIST_DIR, name))
    .filter((f) => COMPRESSIBLE.has(extname(f)))

  if (files.length === 0) {
    console.log('No compressible assets found in dist/')
    return
  }

  console.log(`Compressing ${files.length} asset(s) in dist/...`)
  for (const file of files) {
    const gz = await gzipFile(file)
    const br = await brotliFile(file)
    const [origStat, gzStat, brStat] = await Promise.all([fs.stat(file), fs.stat(gz), fs.stat(br)])
    console.log(
      `${file.replace(`${DIST_DIR}/`, '')}: ${formatSize(origStat.size)} | gzip ${formatSize(
        gzStat.size
      )} | br ${formatSize(brStat.size)}`
    )
  }
  console.log('Done.')
}

run().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})

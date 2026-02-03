import { readFile, writeFile } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'

const sizes = [192, 512, 1024]
const sourcePath = new URL('../public/kickball.png', import.meta.url)
const pngBuffer = await readFile(sourcePath)
const base64 = pngBuffer.toString('base64')
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <image href="data:image/png;base64,${base64}" x="0" y="0" width="1024" height="1024" />
</svg>
`

await Promise.all(
  sizes.map(async (size) => {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: size },
    })
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()
    const outputPath = new URL(`../public/icon-${size}.png`, import.meta.url)
    await writeFile(outputPath, pngBuffer)
  }),
)

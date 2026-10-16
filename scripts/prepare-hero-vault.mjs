import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const projectRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const inputPath = resolve(process.argv[2] ?? resolve(projectRoot, 'attached_assets/0_high_security_vault_1791709125989.glb'));
const outputPath = resolve(process.argv[3] ?? resolve(projectRoot, 'artifacts/armoreum/public/armoreum-vault.glb'));
const source = await readFile(inputPath);

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function makeBrandGradientPng(size = 128) {
  const stops = [
    [0, [223, 255, 115]],
    [0.26, [126, 240, 48]],
    [0.55, [22, 199, 82]],
    [0.78, [0, 163, 111]],
    [1, [231, 250, 226]],
  ];
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    scanlines[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const position = (x / (size - 1)) * 0.68 + (y / (size - 1)) * 0.32;
      let index = 0;
      while (index < stops.length - 2 && position > stops[index + 1][0]) index += 1;
      const [startAt, start] = stops[index];
      const [endAt, end] = stops[index + 1];
      const mix = (position - startAt) / (endAt - startAt);
      const offset = row + 1 + x * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        scanlines[offset + channel] = Math.round(start[channel] + (end[channel] - start[channel]) * mix);
      }
      scanlines[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

let offset = 12;
let gltf;
let binary;
while (offset < source.length) {
  const length = source.readUInt32LE(offset);
  const type = source.readUInt32LE(offset + 4);
  offset += 8;
  const chunk = source.subarray(offset, offset + length);
  if (type === 0x4e4f534a) gltf = JSON.parse(chunk.toString('utf8').trim());
  if (type === 0x004e4942) binary = chunk;
  offset += length;
}
if (!gltf || !binary) throw new Error('Input is not a valid binary glTF file.');

const rootNode = gltf.nodes.find((node) => node.name === 'GLTF_SceneRootNode');
const groundNodeIndex = gltf.nodes.findIndex((node) => node.name === 'Circle_6');
if (rootNode && groundNodeIndex >= 0) {
  rootNode.children = rootNode.children.filter((index) => index !== groundNodeIndex);
}

const accentMaterial = gltf.materials.find((material) => material.name === 'A.001');
if (!accentMaterial) throw new Error('Could not find the model’s orange accent material.');

let binaryWithAssets = binary;
function appendPng(png) {
  const byteOffset = (binaryWithAssets.length + 3) & ~3;
  binaryWithAssets = Buffer.concat([
    binaryWithAssets,
    Buffer.alloc(byteOffset - binaryWithAssets.length),
    png,
  ]);
  return gltf.bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: png.length,
  }) - 1;
}
function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]);
}
function makeCircularLabel(text, radius, fontSize, repeats = 3) {
  const characters = text.repeat(repeats).split('');
  return characters.map((character, index) => {
    const brandCharacter = text.startsWith('armoreum') && index % text.length < 'armoreum'.length;
    const angle = -Math.PI / 2 + (index / characters.length) * Math.PI * 2;
    const x = 512 + Math.cos(angle) * radius;
    const y = 512 + Math.sin(angle) * radius;
    const rotation = (angle * 180 / Math.PI) + 90;
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" transform="rotate(${rotation.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="#fff" font-family="DejaVu Sans,sans-serif" font-size="${fontSize}" font-weight="700" font-style="${brandCharacter ? 'italic' : 'normal'}" text-anchor="middle" dominant-baseline="middle">${escapeXml(character)}</text>`;
  }).join('');
}
async function renderTexture(fileName, { transparentBlack = false, circleLabel = false } = {}) {
  const svgPath = resolve(projectRoot, 'artifacts/armoreum/scripts/assets', fileName);
  let svg = await readFile(svgPath, 'utf8');
  if (circleLabel) {
    svg = svg.replace(
      '<!-- ARMOREUM_ARC_TEXT -->',
      makeCircularLabel('armoreum • HIGH SECURITY • ', 400, 34),
    );
  }
  const args = ['svg:-'];
  if (transparentBlack) args.push('-fuzz', '2%', '-transparent', '#000000');
  if (transparentBlack) {
    args.push('-colors', '4', '-dither', 'none', 'PNG8:-');
  } else {
    args.push('-depth', '8', 'PNG32:-');
  }
  return execFileSync('magick', args, {
    input: svg,
    maxBuffer: 16 * 1024 * 1024,
  });
}
function replaceImage(index, name, png) {
  const image = gltf.images[index];
  if (!image) throw new Error(`Missing expected source texture at image index ${index}.`);
  image.name = name;
  const existingView = gltf.bufferViews[image.bufferView];
  if (
    existingView &&
    existingView.buffer === 0 &&
    png.length <= existingView.byteLength
  ) {
    const start = existingView.byteOffset ?? 0;
    png.copy(binaryWithAssets, start);
    binaryWithAssets.fill(0, start + png.length, start + existingView.byteLength);
    existingView.byteLength = png.length;
  } else {
    image.bufferView = appendPng(png);
  }
  image.mimeType = 'image/png';
  delete image.uri;
}

replaceImage(0, 'armoreum-high-security-display', await renderTexture('armoreum-vault-display.svg', { transparentBlack: true, circleLabel: true }));
replaceImage(2, 'armoreum-alphanumeric-keypad', await renderTexture('armoreum-alphanumeric-keypad.svg'));
gltf.asset.extras.title = 'armoreum High Security';
const gradientPng = makeBrandGradientPng();
const gradientBufferView = appendPng(gradientPng);
const imageIndex = gltf.images.push({
  name: 'armoreum-green-gradient',
  bufferView: gradientBufferView,
  mimeType: 'image/png',
}) - 1;
const samplerIndex = (gltf.samplers ??= []).push({
  magFilter: 9729,
  minFilter: 9729,
  wrapS: 33071,
  wrapT: 33071,
}) - 1;
const textureIndex = gltf.textures.push({
  name: 'armoreum-green-gradient',
  sampler: samplerIndex,
  source: imageIndex,
}) - 1;
accentMaterial.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
accentMaterial.pbrMetallicRoughness.baseColorTexture = { index: textureIndex, texCoord: 0 };
accentMaterial.emissiveFactor = [0.015, 0.12, 0.035];
gltf.buffers[0].byteLength = binaryWithAssets.length;

const jsonBytes = Buffer.from(JSON.stringify(gltf));
const jsonPadding = Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20);
const paddedJson = Buffer.concat([jsonBytes, jsonPadding]);
const binaryPadding = Buffer.alloc((4 - (binaryWithAssets.length % 4)) % 4);
const paddedBinary = Buffer.concat([binaryWithAssets, binaryPadding]);
const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBinary.length;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(paddedJson.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(paddedBinary.length, 0);
binaryHeader.writeUInt32LE(0x004e4942, 4);
await writeFile(outputPath, Buffer.concat([header, jsonHeader, paddedJson, binaryHeader, paddedBinary]));
console.log(`Wrote branded vault model to ${outputPath}; detached ground pad node: ${groundNodeIndex >= 0}.`);

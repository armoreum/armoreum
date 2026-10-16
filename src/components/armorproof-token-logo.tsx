import { useState, type CSSProperties } from 'react';
import { ImageOff } from 'lucide-react';

/** Frame the visible artwork, not transparent padding added for square metadata.
 * This changes presentation only; the original asset is never rewritten.
 */
function artworkFrame(image: HTMLImageElement): CSSProperties {
  const sampleScale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * sampleScale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * sampleScale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return {};
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return {};
  const basis = Math.min(canvas.width, canvas.height);
  const zoom = Math.max(1, basis / Math.min(right - left + 1, bottom - top + 1));
  const offsetX = (canvas.width / 2 - (left + right + 1) / 2) / basis * 100;
  const offsetY = (canvas.height / 2 - (top + bottom + 1) / 2) / basis * 100;
  return { transform: `scale(${zoom}) translate(${offsetX}%, ${offsetY}%)` };
}

export function ArmorProofTokenLogo({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState<CSSProperties>({});
  if (!src || failed) {
    return <span className="ap-avatar" role="img" aria-label={`${name} logo unavailable`} title="Token logo unavailable">
      <ImageOff size={18} aria-hidden="true" />
    </span>;
  }
  return <span className="ap-avatar">
    <img src={src} alt={`${name} logo`} loading="lazy" decoding="async" style={frame}
      onError={() => setFailed(true)}
      onLoad={event => {
        // External logos without CORS remain visible using ordinary cover framing.
        try { setFrame(artworkFrame(event.currentTarget)); } catch { setFrame({}); }
      }} />
  </span>;
}

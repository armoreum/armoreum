import { useEffect, useRef } from 'react';

const publicAsset = (fileName: string) =>
  `${import.meta.env.BASE_URL}${fileName}`;

export function LandingHeroModel() {
  const modelHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = modelHost.current;
    if (!host) return;

    let disposed = false;
    let viewer: HTMLElement | null = null;
    let firstTouch: { x: number; y: number; at: number } | null = null;
    let touchStart: { x: number; y: number; at: number } | null = null;

    const activateControls = () => {
      if (!viewer || viewer.hasAttribute('camera-controls')) return;
      viewer.setAttribute('camera-controls', '');
      host.setAttribute('data-controls-active', 'true');
    };
    const onDoubleClick = () => activateControls();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      activateControls();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      touchStart = { x: event.clientX, y: event.clientY, at: Date.now() };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !touchStart) return;
      const start = touchStart;
      touchStart = null;
      const now = Date.now();
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > 14 || now - start.at > 350) {
        firstTouch = null;
        return;
      }

      const isSecondTap =
        firstTouch !== null &&
        now - firstTouch.at <= 450 &&
        Math.hypot(event.clientX - firstTouch.x, event.clientY - firstTouch.y) <= 36;
      if (isSecondTap) {
        firstTouch = null;
        activateControls();
      } else {
        firstTouch = { x: event.clientX, y: event.clientY, at: now };
      }
    };
    const onPointerCancel = () => {
      touchStart = null;
      firstTouch = null;
    };
    const onWheel = () => {
      firstTouch = null;
    };

    host.addEventListener('dblclick', onDoubleClick);
    host.addEventListener('keydown', onKeyDown);
    host.addEventListener('pointerdown', onPointerDown, { passive: true });
    host.addEventListener('pointerup', onPointerUp, { passive: true });
    host.addEventListener('pointercancel', onPointerCancel, { passive: true });
    host.addEventListener('wheel', onWheel, { passive: true });

    void import('@google/model-viewer')
      .then(() => {
        if (disposed) return;

        viewer = document.createElement('model-viewer');
        viewer.setAttribute('src', publicAsset('armoreum-vault.glb'));
        viewer.setAttribute('alt', 'armoreum high security vault');
        viewer.setAttribute('loading', 'eager');
        viewer.setAttribute('camera-orbit', '118deg 72deg 760%');
        viewer.setAttribute('field-of-view', '32deg');
        viewer.setAttribute('environment-image', 'neutral');
        viewer.setAttribute('exposure', '1.12');
        viewer.setAttribute('shadow-intensity', '0');
        viewer.setAttribute('interaction-prompt', 'none');
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          viewer.setAttribute('autoplay', '');
        }

        host.append(viewer);
      })
      .catch((error: unknown) => {
        console.error('Could not load the landing hero 3D model.', error);
      });

    return () => {
      disposed = true;
      host.removeEventListener('dblclick', onDoubleClick);
      host.removeEventListener('keydown', onKeyDown);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointercancel', onPointerCancel);
      host.removeEventListener('wheel', onWheel);
      viewer?.remove();
    };
  }, []);

  return (
    <div
      ref={modelHost}
      className="hero-3d-model"
      role="group"
      tabIndex={0}
      aria-label="3D armoreum vault. Double-click, tap twice, or press Enter to enable controls; then drag to rotate and pinch or scroll to zoom."
    />
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { DEFAULT_WEDDING_ID, isValidWeddingId, weddingBundleBaseUrl } from "./wedding-data";
import { WEDDING_GALLERY_IMAGE_IDS, WEDDING_GALLERY_SLIDES } from "./weddingGallerySlides";
import "./WeddingGalleryPage.css";

const CONFIG = {
  slideCount: 10,
  spacingX: 45,
  pWidth: 14,
  pHeight: 18,
  camZ: 30,
  wallAngleY: -0.25,
  snapDelay: 200,
  lerpSpeed: 0.06,
} as const;

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      const mats = obj.material;
      if (Array.isArray(mats)) mats.forEach((m) => m.dispose());
      else mats?.dispose();
    }
    if (obj instanceof THREE.LineSegments) {
      obj.geometry?.dispose();
      const m = obj.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else (m as THREE.Material | undefined)?.dispose?.();
    }
  });
}

export function WeddingGalleryPage() {
  const { weddingId = "" } = useParams();
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const uiLayerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const [exitVeil, setExitVeil] = useState(false);
  const EXIT_VEIL_MS = 480;

  useEffect(() => {
    const prev = document.title;
    document.title = "갤러리";
    return () => {
      document.title = prev;
    };
  }, []);

  useLayoutEffect(() => {
    if (!isValidWeddingId(weddingId)) return;
    const page = pageRef.current;
    const mount = canvasMountRef.current;
    const uiRoot = uiLayerRef.current;
    if (!page || !mount || !uiRoot) return;

    let disposed = false;
    let raf = 0;
    let snapTimer: ReturnType<typeof setTimeout> | null = null;
    const totalGalleryWidth = CONFIG.slideCount * CONFIG.spacingX;

    const measure = (): { w: number; h: number } => {
      const w = Math.max(1, Math.floor(page.clientWidth));
      const h = Math.max(1, Math.floor(page.clientHeight));
      return { w, h };
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f7f5);
    scene.fog = new THREE.Fog(0xf7f7f5, 10, 110);

    const { w: iw, h: ih } = measure();
    const camera = new THREE.PerspectiveCamera(45, iw / ih, 0.1, 1000);
    camera.position.set(0, 0, CONFIG.camZ);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(iw, ih);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const galleryGroup = new THREE.Group();
    scene.add(galleryGroup);

    const textureLoader = new THREE.TextureLoader();
    const paintingGroups: THREE.Group[] = [];

    const imageUrls = WEDDING_GALLERY_IMAGE_IDS.map(
      (id) => `${weddingBundleBaseUrl(weddingId)}static/Gallery/${id}.png`
    );

    const mouse = { x: 0, y: 0 };
    let currentScroll = 0;
    let targetScroll = 0;

    const updateUI = (scrollX: number): void => {
      const rawIndex = Math.round(scrollX / CONFIG.spacingX);
      const safeIndex =
        ((rawIndex % CONFIG.slideCount) + CONFIG.slideCount) % CONFIG.slideCount;
      uiRoot.querySelectorAll<HTMLElement>("[data-gallery-slide]").forEach((el, i) => {
        el.classList.toggle("wedding-gallery-page__slide--active", i === safeIndex);
      });
    };

    const snapToNearest = (): void => {
      const index = Math.round(targetScroll / CONFIG.spacingX);
      targetScroll = index * CONFIG.spacingX;
    };

    const ac = new AbortController();
    const { signal } = ac;

    const onWheel = (e: WheelEvent): void => {
      targetScroll += e.deltaY * 0.1;
      if (snapTimer) window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(snapToNearest, CONFIG.snapDelay);
    };

    let touchStart = 0;
    const onTouchStart = (e: TouchEvent): void => {
      touchStart = e.touches[0]?.clientX ?? 0;
      if (snapTimer) window.clearTimeout(snapTimer);
    };
    const onTouchMove = (e: TouchEvent): void => {
      const t = e.touches[0];
      if (!t) return;
      const diff = touchStart - t.clientX;
      targetScroll += diff * 0.6;
      touchStart = t.clientX;
      if (snapTimer) window.clearTimeout(snapTimer);
    };
    const onTouchEnd = (): void => {
      snapToNearest();
    };

    const onMouseMove = (e: MouseEvent): void => {
      const r = page.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };

    const syncSize = (): void => {
      const { w, h } = measure();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      syncSize();
    });
    ro.observe(page);

    page.addEventListener("wheel", onWheel, { passive: true, signal });
    page.addEventListener("touchstart", onTouchStart, { passive: true, signal });
    page.addEventListener("touchmove", onTouchMove, { passive: true, signal });
    page.addEventListener("touchend", onTouchEnd, { signal });
    page.addEventListener("mousemove", onMouseMove, { signal });

    const lerp = reduceMotion ? 0.22 : CONFIG.lerpSpeed;
    const mouseTilt = reduceMotion ? 0 : 0.05;

    const animate = (): void => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      currentScroll += (targetScroll - currentScroll) * lerp;
      const xMove = currentScroll * Math.cos(CONFIG.wallAngleY);
      const zMove = currentScroll * Math.sin(CONFIG.wallAngleY);
      camera.position.x = xMove;
      camera.position.z = CONFIG.camZ - zMove;
      paintingGroups.forEach((group, i) => {
        const originalX = i * CONFIG.spacingX;
        const distFromCam = currentScroll - originalX;
        const shift = Math.round(distFromCam / totalGalleryWidth) * totalGalleryWidth;
        group.position.x = originalX + shift;
      });
      camera.rotation.x = mouse.y * mouseTilt;
      camera.rotation.y = -mouse.x * mouseTilt;
      updateUI(currentScroll);
      renderer.render(scene, camera);
    };

    void (async () => {
      for (let i = 0; i < CONFIG.slideCount; i++) {
        if (disposed) return;
        const group = new THREE.Group();
        group.position.set(i * CONFIG.spacingX, 0, 0);

        const tex = await new Promise<THREE.Texture | null>((resolve) => {
          textureLoader.load(
            imageUrls[i]!,
            (t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
              resolve(t);
            },
            undefined,
            () => resolve(null)
          );
        });

        if (disposed) {
          tex?.dispose();
          return;
        }

        const meshGeo = new THREE.PlaneGeometry(CONFIG.pWidth, CONFIG.pHeight);
        const mat = new THREE.MeshBasicMaterial({
          map: tex ?? undefined,
          color: tex ? 0xffffff : 0xd0d0d0,
        });
        const mesh = new THREE.Mesh(meshGeo, mat);
        const edges = new THREE.EdgesGeometry(meshGeo);
        const outline = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x222222 })
        );

        const shadowGeo = new THREE.PlaneGeometry(CONFIG.pWidth, CONFIG.pHeight);
        const shadowMat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.15,
        });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.position.set(0.8, -0.8, -0.5);

        const lineZ = -1;
        const lineLen = CONFIG.spacingX;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-lineLen / 2, 14, lineZ),
          new THREE.Vector3(lineLen / 2, 14, lineZ),
          new THREE.Vector3(-lineLen / 2, -14, lineZ),
          new THREE.Vector3(lineLen / 2, -14, lineZ),
        ]);
        const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xdddddd }));

        group.add(shadow);
        group.add(mesh);
        group.add(outline);
        group.add(lines);
        galleryGroup.add(group);
        paintingGroups.push(group);
      }

      if (disposed) return;

      galleryGroup.rotation.y = CONFIG.wallAngleY;
      galleryGroup.position.x = 8;
      animate();
    })();

    return () => {
      disposed = true;
      ro.disconnect();
      if (snapTimer) window.clearTimeout(snapTimer);
      ac.abort();
      cancelAnimationFrame(raf);
      disposeObject3D(galleryGroup);
      scene.remove(galleryGroup);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [reduceMotion, weddingId]);

  if (!isValidWeddingId(weddingId)) {
    return <Navigate to={`/${DEFAULT_WEDDING_ID}`} replace />;
  }

  const goHome = () => {
    const path = `/${encodeURIComponent(weddingId)}#gallery`;
    const state = { fromGalleryExit: true as const };
    if (reduceMotion) {
      void navigate(path, { state });
      return;
    }
    setExitVeil(true);
    window.setTimeout(() => {
      void navigate(path, { state });
    }, EXIT_VEIL_MS);
  };

  return (
    <div className="desktop-stage">
      <div className="phone-shell phone-shell--gallery">
        <div ref={pageRef} className="wedding-gallery-page" lang="ko">
          <div ref={canvasMountRef} className="wedding-gallery-page__canvas" aria-hidden />
          <div ref={uiLayerRef} className="wedding-gallery-page__ui">
            {WEDDING_GALLERY_SLIDES.map((slide, i) => (
              <div key={i} className="wedding-gallery-page__slide" data-gallery-slide>
                <span className="wedding-gallery-page__catalogue">{slide.catalogue}</span>
                <h1>
                  {slide.titleLine1}
                  <br />
                  {slide.titleLine2}
                </h1>
                <div className="wedding-gallery-page__description">{slide.description}</div>
                <div className="wedding-gallery-page__meta">
                  {slide.meta.map((m) => (
                    <FragmentRow key={m.label} label={m.label} value={m.value} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="wedding-gallery-page__scroll-hint" aria-hidden>
            Scroll to explore
          </div>
          <div className="wedding-gallery-page__home-anchor">
            <button
              type="button"
              className={`wedding-gallery-page__home${reduceMotion ? "" : " wedding-gallery-page__home--fade-in"}`}
              onClick={goHome}
              aria-label="청첩장으로 돌아가기"
            >
              <svg className="wedding-gallery-page__home-icon" viewBox="0 0 24 24" width="17" height="17" aria-hidden>
                <path fill="currentColor" d="M12 3.8 4.5 10.2V20h4v-6.5h7V20h4V10.2L12 3.8z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {exitVeil ? createPortal(<div className="gallery-nav-white-veil" aria-hidden />, document.body) : null}
    </div>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="wedding-gallery-page__meta-label">{label}</span>
      <span className="wedding-gallery-page__meta-value">{value}</span>
    </>
  );
}

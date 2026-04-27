import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useNavigate } from "react-router-dom";
import { weddingBundleBaseUrl } from "./wedding-data";
import { WEDDING_GALLERY_IMAGE_IDS, WEDDING_GALLERY_SLIDES } from "./weddingGallerySlides";
import "./WeddingGalleryPage.css";

const PAINTING_SCALE = 0.7;

const CONFIG = {
  slideCount: 10,
  spacingX: 45,
  pWidth: 14 * PAINTING_SCALE,
  pHeight: 18 * PAINTING_SCALE,
  camZ: 30,
  wallAngleY: -0.25,
  /** 벽 전체 월드 X — 클수록 화면에서 더 오른쪽 */
  galleryWallOffsetX: 2,
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

export type WeddingGalleryPageProps = {
  weddingId: string;
  reduceMotion: boolean;
  /** 모션 허용 시 홈: 부모가 body 베일 후 라우팅 (베일이 갤러리 위에 유지되도록) */
  onRequestNavigateHome: () => void;
};

export function WeddingGalleryPage({ weddingId, reduceMotion, onRequestNavigateHome }: WeddingGalleryPageProps) {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const uiLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = "갤러리";
    return () => {
      document.title = prev;
    };
  }, []);

  useLayoutEffect(() => {
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

    /** 픽셀당 `targetScroll` 반영 — 클수록 같은 드래그에 더 빨리 이동 */
    const DRAG_SENS = 0.15;
    let activeDragPointerId: number | null = null;
    let dragLastClientX = 0;

    const isOnHomeControl = (target: EventTarget | null): boolean =>
      target instanceof Element && Boolean(target.closest(".wedding-gallery-page__home-anchor"));

    const onPointerDown = (e: PointerEvent): void => {
      if (isOnHomeControl(e.target)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      activeDragPointerId = e.pointerId;
      dragLastClientX = e.clientX;
      page.classList.add("wedding-gallery-page--dragging");
      page.setPointerCapture(e.pointerId);
      if (snapTimer) window.clearTimeout(snapTimer);
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (activeDragPointerId !== e.pointerId) return;
      const diff = dragLastClientX - e.clientX;
      dragLastClientX = e.clientX;
      targetScroll += diff * DRAG_SENS;
      if (snapTimer) window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(snapToNearest, CONFIG.snapDelay);
    };

    const endDrag = (e: PointerEvent): void => {
      if (activeDragPointerId !== e.pointerId) return;
      activeDragPointerId = null;
      page.classList.remove("wedding-gallery-page--dragging");
      try {
        page.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (snapTimer) window.clearTimeout(snapTimer);
      snapToNearest();
    };

    const onMouseMove = (e: MouseEvent): void => {
      if (activeDragPointerId !== null) return;
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

    page.addEventListener("pointerdown", onPointerDown, { signal, capture: true });
    page.addEventListener("pointermove", onPointerMove, { signal, capture: true });
    page.addEventListener("pointerup", endDrag, { signal, capture: true });
    page.addEventListener("pointercancel", endDrag, { signal, capture: true });
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
        shadow.position.set(0.8 * PAINTING_SCALE, -0.8 * PAINTING_SCALE, -0.5);

        const lineZ = -1;
        const lineLen = CONFIG.spacingX;
        const halfH = CONFIG.pHeight / 2;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-lineLen / 2, halfH, lineZ),
          new THREE.Vector3(lineLen / 2, halfH, lineZ),
          new THREE.Vector3(-lineLen / 2, -halfH, lineZ),
          new THREE.Vector3(lineLen / 2, -halfH, lineZ),
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
      galleryGroup.position.x = CONFIG.galleryWallOffsetX;
      animate();
    })();

    return () => {
      disposed = true;
      page.classList.remove("wedding-gallery-page--dragging");
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

  const goHome = () => {
    const state = { fromGalleryExit: true as const };
    const next = {
      pathname: `/${encodeURIComponent(weddingId)}`,
      search: "",
      hash: "",
    } as const;
    if (reduceMotion) {
      void navigate(next, { state });
      return;
    }
    onRequestNavigateHome();
  };

  return (
    <>
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
            좌우로 드래그해 이동
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
          {!reduceMotion ? <div className="wedding-gallery-page__from-white" aria-hidden /> : null}
        </div>
      </div>
    </>
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

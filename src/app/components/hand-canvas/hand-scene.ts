import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class HandScene {
  scene: THREE.Scene | null = null;
  camera: THREE.PerspectiveCamera | null = null;
  renderer: THREE.WebGLRenderer | null = null;
  handModel: THREE.Group | null = null;
  orbit: OrbitControls | null = null;
  transmitLight: THREE.PointLight | null = null;
  gestureRing: THREE.Mesh | null = null;
  handMaterials: THREE.Material[] = [];
  baseEmissive = new THREE.Color(0x000000);

  private destroyed = false;

  constructor(
    private container: HTMLDivElement,
    private pixelRatio: number,
  ) {}

  init(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(5, 7, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(this.pixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 3;
    this.orbit.maxDistance = 20;

    this.setupLights();
    this.setupFloor();
  }

  onOrbitStart(onStart: () => void): void {
    this.orbit?.addEventListener('start', onStart);
  }

  onOrbitChange(onChange: () => void): void {
    this.orbit?.addEventListener('change', onChange);
  }

  private setupLights(): void {
    if (!this.scene) return;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(0, 5, 0);
    this.scene.add(directionalLight);

    this.transmitLight = new THREE.PointLight(0x4f46e5, 0, 8, 2);
    this.transmitLight.position.set(0, 2, 3);
    this.scene.add(this.transmitLight);
  }

  setupGestureRing(): void {
    if (!this.scene) return;

    const ringGeo = new THREE.TorusGeometry(2.5, 0.03, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4f46e5,
      transparent: true,
      opacity: 0,
    });
    this.gestureRing = new THREE.Mesh(ringGeo, ringMat);
    this.gestureRing.rotation.x = Math.PI / 2;
    this.gestureRing.position.y = 0.5;
    this.scene.add(this.gestureRing);
  }

  private setupFloor(): void {
    if (!this.scene) return;

    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    this.scene.add(plane);

    this.scene.add(new THREE.GridHelper());
    this.scene.add(new THREE.AxesHelper(10));
  }

  loadHandModel(
    onLoaded: () => void,
    onProgress: (pct: number) => void,
    onError: () => void,
  ): void {
    if (!this.scene) return;

    const loader = new GLTFLoader();
    loader.load(
      '/hand/scene.gltf',
      (gltf) => {
        if (this.destroyed || !this.scene) return;
        this.handModel = gltf.scene;
        this.handModel.position.y = -1;
        this.scene.add(this.handModel);

        this.handModel.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of mats) {
              if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
                this.handMaterials.push(mat);
                this.baseEmissive.copy(mat.emissive);
              }
            }
          }
        });

        this.setupGestureRing();
        onLoaded();
      },
      (progress) => {
        if (progress.total > 0) {
          onProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      },
      () => {
        console.error('[HandScene] Failed to load hand model');
        onError();
      },
    );
  }

  updateEnvironmentColors(): void {
    if (!this.scene) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const backgroundColor = rootStyle.getPropertyValue('--p-surface-50').trim() || '#ffffff';
    const gridColor = rootStyle.getPropertyValue('--p-surface-500').trim() || '#808080';

    this.scene.background = new THREE.Color(backgroundColor);

    this.scene.traverse((child) => {
      if (child instanceof THREE.GridHelper) {
        child.material.color.set(new THREE.Color(gridColor));
        child.material.needsUpdate = true;
      }
    });
  }

  resetCamera(): void {
    if (!this.camera || !this.orbit) return;
    this.camera.position.set(5, 7, 5);
    this.orbit.target.set(0, 0, 0);
    this.orbit.update();
  }

  onResize(width: number, height: number): void {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.orbit?.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.destroyed = true;
    this.orbit?.dispose();
    this.orbit = null;

    if (this.scene) {
      this.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const m of mats) {
            if (m instanceof THREE.Material) m.dispose();
          }
        }
        if (child instanceof THREE.Light && 'dispose' in child) {
          (child as unknown as { dispose: () => void }).dispose();
        }
      });
      this.scene = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.handMaterials = [];
    this.camera = null;
    this.handModel = null;
    this.transmitLight = null;
  }
}

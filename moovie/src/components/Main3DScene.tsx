import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { ThemePalette } from "../types";

interface Main3DSceneProps {
  colors: string[]; // [primary, secondary, tertiary]
  mouse: { x: number; y: number };
  activeZ: number; // mapped perspective scroller
  selectedPalette: ThemePalette;
}

export default function Main3DScene({ colors, mouse, activeZ, selectedPalette }: Main3DSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Keep mouse coords in state refs for rendering animation loop
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetZRef = useRef(10);
  const colorsRef = useRef<string[]>(colors);

  useEffect(() => {
    mouseRef.current = mouse;
  }, [mouse]);

  useEffect(() => {
    targetZRef.current = activeZ;
  }, [activeZ]);

  useEffect(() => {
    colorsRef.current = colors;
  }, [colors]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Dimensions setup
    let width = container.clientWidth;
    let height = container.clientHeight;

    // 2. Scene, camera and renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#030303"); // Pure black space background

    // Perspective camera
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // 3. Immersive Ambient Lighting System (The LED Bleed core)
    // Primary spotlight illuminating the active 3D card coordinate
    const spotlight = new THREE.SpotLight(colorsRef.current[0], 15);
    spotlight.position.set(0, 4, 8);
    spotlight.angle = Math.PI / 4;
    spotlight.penumbra = 0.8;
    scene.add(spotlight);

    // Secondary soft backlight for nebula glow
    const pointLight = new THREE.PointLight(colorsRef.current[1], 10, 35);
    pointLight.position.set(-5, -3, 3);
    scene.add(pointLight);

    // Tertiary subtle fill light mapping other shades
    const ambientLight = new THREE.AmbientLight(colorsRef.current[2], 0.25);
    scene.add(ambientLight);

    // 4. Create premium infinite Stardust fields with rich color variations matching the login space
    const starsCount = 750;
    const starsGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starsCount * 3);
    const colorsData = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
      const idx = i * 3;
      // Spread stars around a wide cylinder/frustum bounds
      positions[idx] = (Math.random() - 0.5) * 65;
      positions[idx + 1] = (Math.random() - 0.5) * 65;
      positions[idx + 2] = (Math.random() - 0.5) * 45; // deep spread

      // Color variation matching ProfileWarpView's beautiful theme (#FF4D57, #3B82F6, #A855F7, white)
      const rng = Math.random();
      if (rng < 0.28) {
        // Rose Red: #FF4D57
        colorsData[idx] = 1.0;
        colorsData[idx + 1] = 0.3;
        colorsData[idx + 2] = 0.34;
      } else if (rng < 0.56) {
        // Cosmic Blue: #3B82F6
        colorsData[idx] = 0.23;
        colorsData[idx + 1] = 0.51;
        colorsData[idx + 2] = 0.96;
      } else if (rng < 0.8) {
        // Astral Purple: #A855F7
        colorsData[idx] = 0.66;
        colorsData[idx + 1] = 0.33;
        colorsData[idx + 2] = 0.97;
      } else {
        // Pure Starlight (White/Golden)
        colorsData[idx] = 1.0;
        colorsData[idx + 1] = 0.98;
        colorsData[idx + 2] = 0.9;
      }
    }

    starsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute("color", new THREE.BufferAttribute(colorsData, 3));

    // Simple custom round star visual via canvases
    const createCircularTexture = () => {
      const pCanvas = document.createElement("canvas");
      pCanvas.width = 16;
      pCanvas.height = 16;
      const pCtx = pCanvas.getContext("2d");
      if (pCtx) {
        const grad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, "rgba(255, 255, 255, 1)");
        grad.addColorStop(0.3, "rgba(255, 255, 255, 0.8)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        pCtx.fillStyle = grad;
        pCtx.fillRect(0, 0, 16, 16);
      }
      return new THREE.CanvasTexture(pCanvas);
    };

    const starsMaterial = new THREE.PointsMaterial({
      size: 0.32, // larger size for beautiful glowing particle depth perception
      vertexColors: true,
      map: createCircularTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // 5. Dual Colored Nebulae dust (Soft mesh spheres with additive blending)
    const nebulaGeometry1 = new THREE.SphereGeometry(15, 24, 24);
    const nebulaMaterial1 = new THREE.MeshBasicMaterial({
      color: colorsRef.current[0],
      transparent: true,
      opacity: 0.18, // increased opacity for premium atmospheric glow
      wireframe: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    const nebula1 = new THREE.Mesh(nebulaGeometry1, nebulaMaterial1);
    nebula1.position.set(-6, 2, -10);
    scene.add(nebula1);

    const nebulaGeometry2 = new THREE.SphereGeometry(20, 24, 24);
    const nebulaMaterial2 = new THREE.MeshBasicMaterial({
      color: colorsRef.current[1] || "#3B82F6",
      transparent: true,
      opacity: 0.12, // secondary cosmic nebula cloud
      wireframe: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    const nebula2 = new THREE.Mesh(nebulaGeometry2, nebulaMaterial2);
    nebula2.position.set(8, -4, -12);
    scene.add(nebula2);

    // 6. Responsive resizer
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;

      renderer.setSize(width, height);
      camera.aspect = width / height;

      // Adjust camera values for narrowing viewports
      if (width < 768) {
        camera.fov = 70;
      } else {
        camera.fov = 55;
      }
      camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Trigger first calc

    // 7. Core Render Loop
    let clock = new THREE.Clock();
    let frameId: number;

    const animate = () => {
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Lerp camera deep perspective coordinates
      camera.position.z += (targetZRef.current - camera.position.z) * 0.12;

      // Parallax rotation of entire scene based on active mouse coordinates
      const targetRotationX = mouseRef.current.y * 0.15;
      const targetRotationY = mouseRef.current.x * 0.15;

      scene.rotation.x += (targetRotationX - scene.rotation.x) * 0.08;
      scene.rotation.y += (targetRotationY - scene.rotation.y) * 0.08;

      // Rotate stardust mesh slightly
      stars.rotation.y = elapsedTime * 0.008;
      stars.rotation.x = elapsedTime * 0.003;

      // Premium galactic forward travel mechanism: animate individual particle depths towards positive Z
      const positionsAttr = starsGeometry.getAttribute("position") as THREE.BufferAttribute;
      if (positionsAttr) {
        const array = positionsAttr.array as Float32Array;
        const particleSpeed = 0.055; // Gentle majestic stardust speed

        for (let i = 0; i < array.length; i += 3) {
          array[i + 2] += particleSpeed;

          // Cycle back when the particle passes camera's active Z plane
          if (array[i + 2] > camera.position.z) {
            array[i + 2] = camera.position.z - 35; // recycle deep behind the camera plane
            array[i] = (Math.random() - 0.5) * 65;
            array[i + 1] = (Math.random() - 0.5) * 65;
          }
        }
        positionsAttr.needsUpdate = true;
      }

      // Pulse and rotate nebulae
      nebula1.rotation.y = -elapsedTime * 0.02;
      nebula1.scale.setScalar(1 + Math.sin(elapsedTime * 0.4) * 0.04);

      nebula2.rotation.y = elapsedTime * 0.015;
      nebula2.scale.setScalar(1 + Math.cos(elapsedTime * 0.3) * 0.05);

      // Interpolate ambient lighting color changes for fluid blending transitions
      const targetPrimary = new THREE.Color(colorsRef.current[0]);
      const targetSecondary = new THREE.Color(colorsRef.current[1]);

      spotlight.color.lerp(targetPrimary, 0.05);
      pointLight.color.lerp(targetSecondary, 0.05);
      nebulaMaterial1.color.lerp(targetPrimary, 0.05);
      nebulaMaterial2.color.lerp(targetSecondary, 0.05);

      // Rotate spotlight slightly with mouse coordinates
      spotlight.position.x = mouseRef.current.x * 3;
      spotlight.position.y = 4 + mouseRef.current.y * 2;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    animate();

    // 8. Cleanup operations on dismantle
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frameId);
      
      // Dispose materials/geometry to free WebGL context
      starsGeometry.dispose();
      starsMaterial.dispose();
      nebulaGeometry1.dispose();
      nebulaMaterial1.dispose();
      nebulaGeometry2.dispose();
      nebulaMaterial2.dispose();
      renderer.dispose();
      
      if (container && renderer.domElement) {
        try {
          container.removeChild(renderer.domElement);
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full z-0 pointer-events-none bg-black overflow-hidden"
      id="three_ambient_stage"
    />
  );
}

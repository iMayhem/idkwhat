import * as THREE from "three";

/**
 * ResponsiveViewportEngine adjusts the Three.js PerspectiveCamera configuration
 * dynamically for varying client screen sizes, resolving potential object clipping on narrow displays.
 */
export function calculateResponsiveViewport(
  width: number,
  height: number,
  defaultFov: number = 55
): { fov: number; aspect: number; scaleFactor: number } {
  const aspect = width / height;
  let fov = defaultFov;
  let scaleFactor = 1.0;

  if (aspect < 1.0) {
    // Portait aspect ratio (Mobile displays, e.g., phones)
    // Vertically expand the camera field of view to keep wide assets completely visible
    fov = defaultFov + (1.0 - aspect) * 28;
    scaleFactor = Math.max(0.65, aspect * 1.1); // Scaler for 3D elements bounding box
  } else if (aspect < 1.4) {
    // Medium aspect Ratio (Tablets, e.g., iPads)
    fov = defaultFov + (1.4 - aspect) * 12;
    scaleFactor = 0.9;
  }

  // Keep FOV healthy to prevent extreme optical distortion at edges
  fov = Math.min(85, Math.max(35, fov));

  return { fov, aspect, scaleFactor };
}

export function updateCameraFrustum(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  defaultFov?: number
) {
  const { fov, aspect } = calculateResponsiveViewport(width, height, defaultFov);
  camera.fov = fov;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}

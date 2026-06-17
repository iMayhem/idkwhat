/**
 * PosterDepthShader implements GLSL vertex and fragment codes to create high-fidelity
 * holographic mouse-responsive depth parallax and displacement effects.
 */

export const PosterDepthShader = {
  uniforms: {
    uTexture: { value: null },
    uMouse: { value: [0.0, 0.0] }, // normal coordinate [-1, 1]
    uHoverValue: { value: 0.0 }, // [0, 1] transition of hovering
    uResolution: { value: [1.0, 1.0] },
    uParallaxStrength: { value: 0.07 },
  },

  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform vec2 uMouse;
    uniform float uHoverValue;

    void main() {
      vUv = uv;
      vNormal = normal;
      vPosition = position;

      // Introduce dynamic physical mesh extrusion (bending out on hover)
      vec3 pos = position;
      
      // Calculate depth offset based on mouse proximity and hover strength
      float dist = distance(vUv, vec2(0.5) + uMouse * 0.15);
      float extrude = (1.0 - smoothstep(0.0, 0.8, dist)) * uHoverValue * 0.45;
      
      pos.z += extrude;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D uTexture;
    uniform vec2 uMouse;
    uniform float uHoverValue;
    uniform float uParallaxStrength;
    varying vec2 vUv;

    void main() {
      // Direct uv shift for holographic parallax perspective shift
      vec2 parallaxUv = vUv;
      
      // Create separate layers representing a multi-plane visual depth offset
      vec2 offset = uMouse * uParallaxStrength * (uHoverValue * 0.5 + 0.5);
      
      // Shift UV texture slightly to simulate depth background layer
      parallaxUv += offset * (1.0 - texture2D(uTexture, vUv).r * 0.4);

      vec4 texColor = texture2D(uTexture, parallaxUv);
      
      // Highlight glow reflecting off the surface based on virtual mouse source
      float highlight = max(0.0, 1.0 - distance(vUv, vec2(0.5) + uMouse * 0.4) * 1.5) * uHoverValue;
      
      // Combine base texture, chromatic aberration on edges and metallic highlight shine
      vec4 finalColor = texColor;
      finalColor.rgb += vec3(0.18, 0.12, 0.22) * highlight;

      // Boost contrast on hover
      if (uHoverValue > 0.01) {
        finalColor.rgb = mix(finalColor.rgb, finalColor.rgb * 1.15, uHoverValue);
      }

      gl_FragColor = vec4(finalColor.rgb, 1.0);
    }
  `
};

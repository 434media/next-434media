"use client"

import { useRef, useMemo, useEffect, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useTexture } from "@react-three/drei"
// @ts-expect-error - three.js types
import * as THREE from "three"

const RADIUS = 2
const EARTH_TEXTURE = "https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg"
const BUMP_TEXTURE = "https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png"

// ============================================================================
// Atmosphere — fresnel glow around the globe
// ============================================================================

function Atmosphere() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        atmosphereColor: { value: new THREE.Color("#88bbff") },
        intensity: { value: 0.6 },
        fresnelPower: { value: 3.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 atmosphereColor;
        uniform float intensity;
        uniform float fresnelPower;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, normalize(-vPosition))), fresnelPower);
          gl_FragColor = vec4(atmosphereColor, fresnel * intensity);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
  }, [])

  return (
    <mesh scale={[1.15, 1.15, 1.15]}>
      <sphereGeometry args={[RADIUS, 64, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

// ============================================================================
// Rotating Globe with Earth texture
// ============================================================================

function RotatingGlobe() {
  const groupRef = useRef<THREE.Group>(null)

  const [earthTexture, bumpTexture] = useTexture([EARTH_TEXTURE, BUMP_TEXTURE])

  useMemo(() => {
    if (earthTexture) {
      earthTexture.colorSpace = THREE.SRGBColorSpace
      earthTexture.anisotropy = 16
    }
    if (bumpTexture) {
      bumpTexture.anisotropy = 8
    }
  }, [earthTexture, bumpTexture])

  const geometry = useMemo(() => new THREE.SphereGeometry(RADIUS, 64, 64), [])

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05
    }
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          map={earthTexture}
          bumpMap={bumpTexture}
          bumpScale={0.04}
          roughness={0.7}
          metalness={0.0}
        />
      </mesh>
    </group>
  )
}

// ============================================================================
// Scene
// ============================================================================

function Scene() {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(0, 0, RADIUS * 3.2)
    camera.lookAt(0, 0, 0)
  }, [camera])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 4, 10]} intensity={1.4} color="#ffffff" />
      <directionalLight position={[-6, 2, -4]} intensity={0.4} color="#88ccff" />
      <RotatingGlobe />
      <Atmosphere />
    </>
  )
}

// ============================================================================
// Export
// ============================================================================

export default function Globe3D() {
  return (
    <div className="w-full h-full">
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        camera={{ fov: 45, near: 0.1, far: 1000, position: [0, 0, RADIUS * 3.2] }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}

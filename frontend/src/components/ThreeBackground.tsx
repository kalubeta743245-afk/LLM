import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function FloatingShape({ position, rotationSpeed, color, shape }: { position: [number, number, number]; rotationSpeed: number; color: string; shape: 'box' | 'icosahedron' | 'torus' }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((_, delta) => {
    ref.current.rotation.x += delta * rotationSpeed * 0.3
    ref.current.rotation.y += delta * rotationSpeed * 0.5
  })

  const Geometry = useMemo(() => {
    switch (shape) {
      case 'box': return <boxGeometry args={[1, 1, 1]} />
      case 'icosahedron': return <icosahedronGeometry args={[0.8, 0]} />
      case 'torus': return <torusGeometry args={[0.6, 0.25, 8, 12]} />
    }
  }, [shape])

  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6} position={position}>
      <mesh ref={ref} castShadow>
        {Geometry}
        <MeshDistortMaterial
          color={color}
          flatShading
          roughness={0.8}
          metalness={0}
          distort={0.1}
        />
      </mesh>
    </Float>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, -2, -3]} intensity={0.3} color="#FFD23F" />
      <FloatingShape position={[-3.5, 1.5, -2]} rotationSpeed={0.8} color="#FFD23F" shape="icosahedron" />
      <FloatingShape position={[4, -1, -3]} rotationSpeed={0.6} color="#FF6B9D" shape="box" />
      <FloatingShape position={[2.5, 2.5, -4]} rotationSpeed={1.0} color="#C5E063" shape="torus" />
      <FloatingShape position={[-4, -2, -5]} rotationSpeed={0.7} color="#4A90E2" shape="icosahedron" />
    </>
  )
}

export default function ThreeBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}

import { EffectComposer, Bloom, SMAA, Vignette } from '@react-three/postprocessing'

export default function Effects(){
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={1} luminanceThreshold={0.45} luminanceSmoothing={0.25} mipmapBlur />
      <Vignette eskil={false} offset={0.3} darkness={0.5} />
      <SMAA />
    </EffectComposer>
  )
}

import { Stars } from '@react-three/drei'

/**
 * Procedural star background.
 * - radius: how far the stars are placed from the origin
 * - depth:  thickness of the star "shell"
 * - count:  how many stars
 * - factor: controls star size variance
 * - fade:   makes stars fade as they get closer to the camera
 * - speed:  subtle twinkle/rotation
 */
export default function Starfield() {
    return (
        <Stars
            radius={80}    // distance from center
            depth={40}     // star field thickness
            count={8000}   // number of stars
            factor={4}     // size factor (spread)
            saturation={0} // keep them white/blueish
            fade           // fade near camera
            speed={0.2}    // gentle movement/twinkle
        />
    )
}

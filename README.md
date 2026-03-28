# Project Atlas: Journey to Mars 2047

Project Atlas is a high-fidelity, cinematic 3D web experience mapping the multi-stage mission from Earth to the Martian surface. Designed for high performance and deep immersion, it transforms standard web browsing into a physical journey through space.

---

## The Vision
The mission of Project Atlas is to push the boundaries of web-native 3D storytelling. By combining advanced rendering techniques with a narrative-driven scroll lifecycle, the project provides a tangible sense of scale—from the lush atmosphere of Earth to the desolate, cold plains of Jezero Crater.

---

## Technical Highlights

### 1. Cinematic 3D Scene Management
The experience is built on **Three.js (r128)**, utilizing a modular loader system that prioritizes critical assets (Earth and Astronaut) for immediate landing delivery.
- **Dynamic Lighting**: Real-time directional and ambient lighting simulates the harsh contrast of deep space.
- **Atmospheric Bloom**: Custom-tuned inner and outer glow shaders create a realistic planetary silhouette.
- **Smooth Interpolation**: Movement across the 225-million kilometer journey is handled by **GSAP (ScrollTrigger)**, mapping user scroll progress to intricate camera and asset coordinates.

### 2. High-Performance HUD
Inspired by aerospace command centers, the interface utilizes a **glassmorphism** design system:
- **Liquid-Filtered Rail**: Mission navigation utilizes an SVG-distorted "liquid" filter for a fluid, high-tech interface feel.
- **Real-Time Instrumentation**: Mission metrics (Stage, Distance in millions of km, and Temperature) update dynamically at 60 FPS.
- **Raycasted Interactivity**: Advanced raycasting enables high-precision interaction with the 3D scene, allowing users to hover over mission-critical objects to reveal context-sensitive data cards.

### 3. Integrated Audio Engine
Sound is more than an add-on; it's a core mechanic.
- **Ambient Rumble**: A localized mission-drone MP3 is handled via the **Web Audio API** and a `MediaElementSource` to ensure buffer stability.
- **Interactive SFX**: Synced mission "whooshes" and "pings" provide tactile auditory feedback during stage transitions.
- **Autoplay Robustness**: The engine handles strict browser autoplay policies via a sophisticated "once-click" listener system.

### 4. Mobile First & Multi-Device Precision
Project Atlas is built to be hardware-aware:
- **Haptic Feedback**: (Android/Chrome) Small tactical vibrations are synchronized with sound effects for physical mission confirmation.
- **Responsive Layouts**: Fluid typography using the `clamp()` function ensures the HUD remains legible from 4-inch phones to 32-inch monitors.
- **Touch Targets**: Navigation and interactive zones are dynamically scaled for tactile precision on mobile.

---

## Technical Stack
- **Engine**: Three.js
- **Animations**: GSAP (GreenSock)
- **Styling**: Vanilla CSS (Modern Hardware-Accelerated Glassmorphism)
- **Audio**: Web Audio API
- **Deployment**: Optimized for standard web architectures (Single HTML/JS bundle logic)

---

## How it Works
1. **Ignition**: As you scroll, the astronaut and planetary bodies animate along a pre-baked mission path.
2. **Deep Space**: The HUD tracks distance and environment temperature, while the background drone hum deepens.
3. **Arrival**: The camera transitions to a high-orbit view of Mars, concluding the mission.

**Created by Developer as a testament to modern web-native 3D capabilities.**

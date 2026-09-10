import React, { useEffect, useRef } from "react";
import "./HumanHeartBleedingBackground.css";

/**
 * HumanHeartBleedingBackground
 * - Hyperrealistic 3D Beating Human Heart with Lub-Dub Cardiac Cycle
 * - Real-Time 3D Bleeding Blood Droplets & Liquid Viscous Physics
 * - Glowing Arterial Capillaries & Telemetry Shockwaves
 * - Hardware-accelerated Canvas & CSS 3D Liquid Specular Shaders
 */
export function HumanHeartBleedingBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Cardiac Blood Bleed Particle System
    const drops = [];
    const splashes = [];
    const maxDrops = 42;

    // Cardiac cycle timing
    let lastBeatTime = Date.now();

    class BloodDrop {
      constructor() {
        this.reset();
      }

      reset() {
        // Calculate heart position on screen
        const heartCenterX = width > 900 ? width * 0.52 : width * 0.5;
        const heartCenterY = height * 0.46;
        const heartWidth = Math.min(width * 0.42, 420);
        const heartHeight = heartWidth * 0.95;

        // Bleeding origin points relative to heart anatomy
        const originType = Math.random();
        if (originType < 0.65) {
          // Apex (main bleeding tip)
          this.x = heartCenterX + (Math.random() - 0.5) * (heartWidth * 0.14);
          this.y = heartCenterY + heartHeight * 0.42 + (Math.random() - 0.5) * 16;
        } else if (originType < 0.82) {
          // Left Ventricle crevice
          this.x = heartCenterX - heartWidth * 0.18 + (Math.random() - 0.5) * 20;
          this.y = heartCenterY + heartHeight * 0.18 + Math.random() * 40;
        } else {
          // Right Ventricle crevice
          this.x = heartCenterX + heartWidth * 0.16 + (Math.random() - 0.5) * 20;
          this.y = heartCenterY + heartHeight * 0.22 + Math.random() * 40;
        }

        // 3D Depth Layer (0.5 = far/deep background, 1.8 = close foreground)
        this.z = 0.55 + Math.random() * 1.15;
        this.baseRadius = (2.2 + Math.random() * 3.8) * this.z;
        this.radius = this.baseRadius;

        // Gravity & Viscosity Physics
        this.vy = (1.2 + Math.random() * 2.2) * this.z;
        this.vx = (Math.random() - 0.5) * 0.4 * this.z;
        this.gravity = 0.085 * this.z;
        this.viscosityStretch = 1;

        // Visual properties
        this.alpha = 0.75 + Math.random() * 0.25;
        this.sway = Math.random() * Math.PI * 2;
        this.swaySpeed = 0.03 + Math.random() * 0.04;
        this.swayAmount = 0.4 + Math.random() * 0.6;
        this.colorGrad = Math.random();
        this.stagnantLife = Math.random() < 0.2 ? Math.floor(Math.random() * 45) : 0; // swelling drop
      }

      update() {
        if (this.stagnantLife > 0) {
          this.stagnantLife -= 1;
          this.radius = this.baseRadius * (1 + (1 - this.stagnantLife / 45) * 0.5);
          return;
        }

        this.vy += this.gravity;
        this.y += this.vy;
        this.sway += this.swaySpeed;
        this.x += Math.sin(this.sway) * this.swayAmount + this.vx;

        // Viscous teardrop stretch
        this.viscosityStretch = Math.min(2.4, 1 + this.vy * 0.065);

        // Check if reached bottom
        if (this.y > height - 20) {
          // Create 3D impact splash
          splashes.push({
            x: this.x,
            y: height - 16,
            z: this.z,
            r: this.radius * 1.2,
            maxR: this.radius * 4.5,
            alpha: 0.8,
          });
          this.reset();
        }
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 3D depth blur for distant drops
        if (this.z < 0.75) {
          ctx.filter = "blur(1.2px)";
        }

        // Draw 3D Liquid Teardrop
        const rx = this.radius;
        const ry = this.radius * this.viscosityStretch;

        // Radial 3D Blood Gradient
        const grad = ctx.createRadialGradient(
          -rx * 0.35,
          -ry * 0.3,
          rx * 0.15,
          0,
          0,
          Math.max(rx, ry)
        );

        if (this.colorGrad > 0.5) {
          // Oxygenated Arterial Crimson
          grad.addColorStop(0, "#fb7185"); // top-left glow
          grad.addColorStop(0.25, "#f43f5e"); // vibrant crimson
          grad.addColorStop(0.7, "#be123c"); // deep blood red
          grad.addColorStop(1, "#881337"); // shadow rim
        } else {
          // Deep Venous Crimson
          grad.addColorStop(0, "#f43f5e");
          grad.addColorStop(0.3, "#e11d48");
          grad.addColorStop(0.75, "#9f1239");
          grad.addColorStop(1, "#4c0519");
        }

        ctx.fillStyle = grad;
        ctx.shadowColor = "rgba(225, 29, 72, 0.45)";
        ctx.shadowBlur = 6 * this.z;

        ctx.beginPath();
        // Teardrop path with pointed top and rounded belly
        ctx.moveTo(0, -ry);
        ctx.bezierCurveTo(rx * 0.8, -ry * 0.2, rx, ry * 0.6, 0, ry);
        ctx.bezierCurveTo(-rx, ry * 0.6, -rx * 0.8, -ry * 0.2, 0, -ry);
        ctx.fill();

        // 3D Glass Specular Reflection (Glint)
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.ellipse(
          -rx * 0.3,
          -ry * 0.35,
          rx * 0.28,
          ry * 0.2,
          -Math.PI / 5,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Secondary bottom rim light reflection
        ctx.fillStyle = "rgba(255, 200, 210, 0.35)";
        ctx.beginPath();
        ctx.ellipse(
          rx * 0.2,
          ry * 0.45,
          rx * 0.35,
          ry * 0.15,
          Math.PI / 6,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
      }
    }

    // Initialize drops
    for (let i = 0; i < maxDrops; i++) {
      const drop = new BloodDrop();
      drop.y = Math.random() * height;
      drops.push(drop);
    }

    // Animation Loop
    const loop = () => {
      ctx.clearRect(0, 0, width, height);

      // Periodically spawn bursts on heartbeat (every ~1.6s)
      const now = Date.now();
      if (now - lastBeatTime > 1600) {
        lastBeatTime = now;
        for (let b = 0; b < 3; b++) {
          const freshDrop = new BloodDrop();
          freshDrop.stagnantLife = 0;
          freshDrop.vy = 2.4 + Math.random() * 2.0;
          drops.push(freshDrop);
          if (drops.length > maxDrops + 8) {
            drops.shift();
          }
        }
      }

      // Draw and update falling blood drops
      for (let i = 0; i < drops.length; i++) {
        drops[i].update();
        drops[i].draw();
      }

      // Draw and update 3D impact splashes
      for (let s = splashes.length - 1; s >= 0; s--) {
        const sp = splashes[s];
        sp.r += 0.85;
        sp.alpha -= 0.035;

        if (sp.alpha <= 0 || sp.r >= sp.maxR) {
          splashes.splice(s, 1);
          continue;
        }

        ctx.save();
        ctx.strokeStyle = `rgba(225, 29, 72, ${sp.alpha})`;
        ctx.lineWidth = 1.8 * sp.z;
        ctx.shadowColor = "rgba(225, 29, 72, 0.6)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, sp.r * 1.6, sp.r * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner secondary splash ripple
        ctx.strokeStyle = `rgba(254, 205, 211, ${sp.alpha * 0.8})`;
        ctx.lineWidth = 1 * sp.z;
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, sp.r * 0.8, sp.r * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="hh-bleed-container" aria-hidden="true">
      {/* Deep Clinical Ambient Lighting Overlay */}
      <div className="hh-ambient-glow" />

      {/* 3D Anatomical Human Heart Centerpiece */}
      <div className="hh-heart-stage">
        {/* Pulsing Arterial Vascular Aura */}
        <div className="hh-vascular-aura" />

        {/* The 3D Anatomical Human Heart Element */}
        <div className="hh-heart-mesh">
          <img
            src="/human_heart_bg.jpg"
            alt="3D Anatomical Human Heart"
            className="hh-heart-img"
          />

          {/* Heart Surface Specular Sheen & Light Shimmer */}
          <div className="hh-heart-sheen" />

          {/* Glowing Arterial Capillaries & Laser Pulses */}
          <div className="hh-coronary-pulse-glow" />

          {/* 3D Viscous Bleeding Liquid Filaments from Heart Apex */}
          <div className="hh-bleed-nozzle hh-bleed-nozzle-1">
            <span className="hh-bleed-drop hh-bleed-drop-1" />
            <span className="hh-bleed-filament hh-bleed-filament-1" />
          </div>

          <div className="hh-bleed-nozzle hh-bleed-nozzle-2">
            <span className="hh-bleed-drop hh-bleed-drop-2" />
            <span className="hh-bleed-filament hh-bleed-filament-2" />
          </div>

          <div className="hh-bleed-nozzle hh-bleed-nozzle-3">
            <span className="hh-bleed-drop hh-bleed-drop-3" />
            <span className="hh-bleed-filament hh-bleed-filament-3" />
          </div>
        </div>

        {/* Cardiac Shockwave Rings expanding on systolic beats */}
        <div className="hh-cardiac-ring hh-cardiac-ring-1" />
        <div className="hh-cardiac-ring hh-cardiac-ring-2" />
      </div>

      {/* Real-time 3D Bleeding Blood Droplets & Liquid Physics Canvas */}
      <canvas ref={canvasRef} className="hh-blood-canvas" />

      {/* Subtle Crimson Vignette & Depth-of-field Grading */}
      <div className="hh-vignette-overlay" />
    </div>
  );
}

export default HumanHeartBleedingBackground;

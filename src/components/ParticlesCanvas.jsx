import React, { useEffect, useRef } from 'react';

class Particle {
  constructor(x, y, color, opts = {}) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = opts.vx || (Math.random() - 0.5) * 8;
    this.vy = opts.vy || (Math.random() - 0.5) * 8 - 2;
    this.life = opts.life || 1;
    this.decay = opts.decay || 0.015 + Math.random() * 0.01;
    this.size = opts.size || 3 + Math.random() * 4;
    this.gravity = opts.gravity || 0.1;
    this.shape = opts.shape || 'circle';
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.life -= this.decay;
    this.rotation += this.rotSpeed;
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = this.color;
    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.5, this.size * this.life), 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === 'rect') {
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    } else if (this.shape === 'star') {
      let spikes = 5;
      let outerR = Math.max(1, this.size * this.life);
      let innerR = Math.max(0.5, this.size * this.life * 0.5);
      let rot = (Math.PI / 2) * 3;
      let step = Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(0, -outerR);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(Math.cos(rot) * outerR, Math.sin(rot) * outerR);
        rot += step;
        ctx.lineTo(Math.cos(rot) * innerR, Math.sin(rot) * innerR);
        rot += step;
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

export default function ParticlesCanvas() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let animationFrameId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      particlesRef.current.forEach((p) => {
        p.update();
        p.draw(ctx);
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);

    // Register global spawning helpers
    window.spawnBurstParticles = (x, y, color, count = 15) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
        const speed = 3 + Math.random() * 6;
        particlesRef.current.push(new Particle(x, y, color, {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 5,
          gravity: 0.05,
          decay: 0.02,
          shape: ['circle', 'rect', 'star'][Math.floor(Math.random() * 3)]
        }));
      }
    };

    window.spawnCoinParticles = (x, y, count = 10) => {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push(new Particle(x, y, '#FFD700', {
          vx: (Math.random() - 0.5) * 6,
          vy: -3 - Math.random() * 5,
          size: 4 + Math.random() * 4,
          gravity: 0.15,
          decay: 0.01,
          shape: 'circle'
        }));
      }
    };

    window.spawnConfetti = () => {
      const colors = ['#ED1C24', '#00AEEF', '#00A651', '#FFF200', '#FFD700', '#a855f7', '#FF6B35'];
      for (let i = 0; i < 120; i++) {
        particlesRef.current.push(new Particle(
          Math.random() * window.innerWidth,
          -20 - Math.random() * 100,
          colors[Math.floor(Math.random() * colors.length)],
          {
            vx: (Math.random() - 0.5) * 4,
            vy: 1 + Math.random() * 3,
            size: 4 + Math.random() * 6,
            gravity: 0.03,
            decay: 0.003,
            shape: ['rect', 'circle', 'star'][Math.floor(Math.random() * 3)]
          }
        ));
      }
    };

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
      // Clean up globals
      delete window.spawnBurstParticles;
      delete window.spawnCoinParticles;
      delete window.spawnConfetti;
    };
  }, []);

  return <canvas id="particles" ref={canvasRef} />;
}

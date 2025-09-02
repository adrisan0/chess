// Fancy, physics-based capture effects (neon sparks + shockwave)
// Usage: showMagicCaptureEffect(squareElement, {palette, durationMs})

(function(){
  function lerp(a,b,t){ return a + (b-a)*t; }
  function clamp(x,min,max){ return Math.max(min, Math.min(max, x)); }

  function makePalette(){
    const root = getComputedStyle(document.documentElement);
    const neon = root.getPropertyValue('--neon-color')?.trim() || '#00ff99';
    return [neon, '#8be9fd', '#ff79c6', '#ffd166', '#c3f73a'];
  }

  function createCanvasOver(el){
    const board = document.getElementById('board');
    const rectB = board.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.style.position = 'absolute';
    canvas.style.left = (rect.left - rectB.left) + 'px';
    canvas.style.top = (rect.top - rectB.top) + 'px';
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    canvas.style.pointerEvents = 'none';
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    board.appendChild(canvas);
    return { canvas, ctx: canvas.getContext('2d'), dpr, w: canvas.width, h: canvas.height, rect, boardRect: rectB };
  }

  function glowCircle(ctx, x, y, r, color){
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();
  }

  function rand(a,b){ return a + Math.random()*(b-a); }

  function spawnParticles(cx, cy, count, palette, dpr){
    const parts = [];
    for(let i=0;i<count;i++){
      const ang = Math.random()*Math.PI*2;
      const speed = rand(120, 280) * dpr;
      const vel = { x: Math.cos(ang)*speed, y: Math.sin(ang)*speed*0.8 - rand(40,120)*dpr };
      parts.push({
        x: cx, y: cy,
        vx: vel.x, vy: vel.y,
        ax: 0, ay: 900*dpr, // gravity
        drag: 0.9,
        r: rand(2, 5) * dpr,
        life: rand(0.7, 1.2), // seconds
        age: 0,
        spin: rand(-6,6),
        hue: palette[(Math.random()*palette.length)|0],
        kind: Math.random()<0.2 ? 'star' : 'dot'
      });
    }
    return parts;
  }

  function drawStar(ctx, x, y, r, rot, color){
    ctx.save();
    ctx.translate(x,y); ctx.rotate(rot);
    ctx.beginPath();
    for(let i=0;i<5;i++){
      const a = i*(Math.PI*2)/5;
      const rx = Math.cos(a)*r;
      const ry = Math.sin(a)*r;
      ctx.lineTo(rx, ry);
      const a2 = a + Math.PI/5;
      ctx.lineTo(Math.cos(a2)*r*0.45, Math.sin(a2)*r*0.45);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowBlur = r*0.6; ctx.shadowColor = color;
    ctx.fill();
    ctx.restore();
  }

  function showMagicCaptureEffect(square, opts={}){
    try{
      const palette = opts.palette || makePalette();
      const duration = (opts.durationMs||900)/1000;
      const { canvas, ctx, dpr, w, h, rect } = createCanvasOver(square);
      ctx.globalCompositeOperation = 'lighter';
      const cx = w/2, cy = h/2;
      const parts = spawnParticles(cx, cy, Math.max(60, Math.floor((rect.width*rect.height)/600)), palette, dpr);
      // shockwave
      let ringAge = 0; const ringLife = 0.45; // seconds

      let last = performance.now();
      function frame(now){
        const dt = Math.min(0.05, (now - last)/1000);
        last = now;
        ctx.clearRect(0,0,w,h);

        // ring
        ringAge += dt;
        const t = clamp(ringAge/ringLife, 0, 1);
        const ringR = lerp(4*dpr, Math.min(w,h)*0.45, Math.pow(t,0.6));
        const ringAlpha = 1 - t;
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${0.5*ringAlpha})`;
        ctx.lineWidth = lerp(4*dpr, 1*dpr, t);
        ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI*2); ctx.stroke();
        ctx.restore();

        // particles
        for(let i=parts.length-1;i>=0;i--){
          const p = parts[i];
          p.age += dt; if(p.age > p.life){ parts.splice(i,1); continue; }
          p.vx *= Math.pow(p.drag, dt*60);
          p.vy *= Math.pow(p.drag, dt*60);
          p.vx += p.ax*dt; p.vy += p.ay*dt;
          p.x += p.vx*dt; p.y += p.vy*dt;
          const k = 1 - (p.age/p.life);
          const alpha = k;
          if(p.kind === 'dot'){
            glowCircle(ctx, p.x, p.y, p.r*1.6, p.hue);
            ctx.fillStyle = `rgba(255,255,255,${0.6*alpha})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r*0.6, 0, Math.PI*2); ctx.fill();
          } else {
            drawStar(ctx, p.x, p.y, p.r*1.2, p.spin*p.age, p.hue);
          }
        }

        if(parts.length>0 || ringAge < ringLife){
          requestAnimationFrame(frame);
        } else {
          canvas.remove();
        }
      }
      requestAnimationFrame(frame);
      return true;
    }catch(e){
      return false;
    }
  }

  window.showMagicCaptureEffect = showMagicCaptureEffect;
})();


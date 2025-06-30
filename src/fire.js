/**
 * Display a short fire animation at the given board square element.
 * The animation uses a simple particle system rendered on a temporary
 * canvas. It removes the canvas automatically when the effect finishes.
 *
 * @param {HTMLElement} square - The destination board square element.
 */
function showFireEffect(square) {
    if (!square) return;
    const boardRect = boardElement.getBoundingClientRect();
    const rect = square.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.style.position = 'absolute';
    canvas.style.left = (rect.left - boardRect.left + rect.width / 2 - size / 2) + 'px';
    canvas.style.top = (rect.top - boardRect.top + rect.height / 2 - size / 2) + 'px';
    canvas.style.pointerEvents = 'none';
    boardElement.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const particles = [];
    const maxParticles = 40;
    let last = null;
    const duration = 800; // ms
    const start = performance.now();

    function addParticle() {
        particles.push({
            x: size / 2,
            y: size * 0.8,
            vx: (Math.random() - 0.5) * 60,
            vy: -Math.random() * 80 - 60,
            life: 1,
            radius: 4 + Math.random() * 4
        });
    }

    function update(dt) {
        for (const p of particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt * 1.5;
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            if (particles[i].life <= 0) particles.splice(i, 1);
        }
    }

    function draw() {
        ctx.clearRect(0, 0, size, size);
        for (const p of particles) {
            const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
            grd.addColorStop(0, `rgba(255,200,50,${p.life})`);
            grd.addColorStop(1, 'rgba(255,0,0,0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function frame(t) {
        if (!last) last = t;
        const dt = (t - last) / 1000;
        last = t;
        if (particles.length < maxParticles) addParticle();
        addParticle();
        update(dt);
        draw();
        if (t - start < duration || particles.length) {
            requestAnimationFrame(frame);
        } else {
            canvas.remove();
        }
    }
    requestAnimationFrame(frame);
}

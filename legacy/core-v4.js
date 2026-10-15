/* Shared deterministic simulation. Coordinates are in a 390 × 720 world. */
(function (root) {
  'use strict';
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function day() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
  function Game(seed, level) {
    this.seed = seed; this.level = level || 1; this.blocks = []; this.effects = []; this.score = 0; this.shots = 3; this.ball = null; this.elapsed = 0; this.settle = 0; this.done = false; this.combo = 0; this.lastHit = -10;
    var random = rng(seed), cols = 6, rows = Math.min(8, 4 + Math.floor(this.level / 2));
    for (var row = 0; row < rows; row++) for (var col = 0; col < cols; col++) {
      var type = (row === 1 && col === 2) || random() < .10 ? 'tnt' : random() < .18 ? 'steel' : 'brick';
      this.blocks.push({ x: 156 + col * 32, y: 610 - row * 32, w: 30, h: 30, type: type, alive: true, hp: type === 'steel' ? 2 : 1 });
    }
    this.total = this.blocks.length;
  }
  Game.prototype.fire = function (x, y) {
    if (this.done || this.ball || !this.shots) return false;
    var dx = x - 62, dy = y - 480, len = Math.hypot(dx, dy);
    if (len < 15) return false;
    var speed = Math.min(760, 420 + len * 1.2);
    this.ball = { x: 62, y: 480, vx: dx / len * speed, vy: dy / len * speed, life: 0 };
    this.shots--; this.settle = 0; return true;
  };
  Game.prototype.destroy = function (b) {
    if (!b.alive) return;
    b.alive = false; this.combo = this.elapsed - this.lastHit < .85 ? this.combo + 1 : 1; this.lastHit = this.elapsed;
    this.score += 100 + Math.min(10, this.combo - 1) * 20;
    this.effects.push({ x: b.x + 15, y: b.y + 15, type: b.type, life: .7 });
    if (b.type === 'tnt') {
      var queue = this.blocks.filter(function (other) { return other.alive && Math.hypot(other.x - b.x, other.y - b.y) < 83; });
      for (var i = 0; i < queue.length; i++) this.destroy(queue[i]);
    }
  };
  Game.prototype.collapse = function () {
    // Flood fill from ground: unsupported components collapse, including bridges.
    var supported = new Set(), queue = this.blocks.filter(function (b) { return b.alive && b.y === 610; });
    queue.forEach(function (b) { supported.add(b); });
    while (queue.length) {
      var b = queue.pop();
      this.blocks.forEach(function (n) { if (n.alive && !supported.has(n) && ((Math.abs(n.x - b.x) === 32 && n.y === b.y) || (Math.abs(n.y - b.y) === 32 && n.x === b.x))) { supported.add(n); queue.push(n); } });
    }
    var falling = this.blocks.filter(function (b) { return b.alive && !supported.has(b); });
    for (var i = 0; i < falling.length; i++) this.destroy(falling[i]);
  };
  Game.prototype.update = function (dt) {
    if (this.done) return;
    dt = Math.min(dt, .05); this.elapsed += dt;
    this.effects.forEach(function (e) { e.life -= dt; }); this.effects = this.effects.filter(function (e) { return e.life > 0; });
    var ball = this.ball;
    if (ball) {
      // Substeps prevent tunnelling through thin blocks on slow devices.
      for (var s = 0; s < 6; s++) {
        ball.vy += 510 * dt / 6; ball.x += ball.vx * dt / 6; ball.y += ball.vy * dt / 6;
        var hit = this.blocks.find(function (b) { return b.alive && ball.x + 12 > b.x && ball.x - 12 < b.x + b.w && ball.y + 12 > b.y && ball.y - 12 < b.y + b.h; });
        if (hit) { hit.hp--; if (hit.hp <= 0) this.destroy(hit); ball.vx *= -.45; ball.vy = -Math.abs(ball.vy) * .5; this.collapse(); break; }
      }
      ball.life += dt;
      if (ball.y > 650 || ball.x < -25 || ball.x > 420 || ball.life > 3.5) this.ball = null;
    }
    var remaining = this.blocks.filter(function (b) { return b.alive; }).length;
    if (!remaining || (!this.shots && !this.ball)) { this.settle += dt; if (this.settle > .8) this.done = true; }
  };
  Game.prototype.ratio = function () { return 1 - this.blocks.filter(function (b) { return b.alive; }).length / this.total; };
  var api = { Game: Game, hash: hash, day: day };
  if (typeof module !== 'undefined') module.exports = api; else root.DemolitionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

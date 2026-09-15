import React, { useEffect, useMemo, useRef, useState, useContext, useCallback } from 'react';
import { PlayerDataContext, SocketContext } from '../../../App';
import mapImage from '../../../images/map.jpg';
import positionMapCoords from '../positions';
import pawnImages from '../../../constants/pawnImages';
import canPawnMove from './canPawnMove';
import getPositionAfterMove from './getPositionAfterMove';
import { isValidPawnPosition } from './boardPath';
import { toneBoardPixels, STAR_FILL, STAR_STROKE } from './boardTone';
import { getLocalPerspective, rotatePoint } from '../perspective';
import { MIN_SPIN_MS, LANDING_MS, RESULT_HOLD_MS } from '../../Navbar/Dice/diceTiming';
import { useAudioSettings } from '../../../context/AudioContext';
import { playStep, playCapture } from './pawnSound';
import styles from '../Gameboard.module.css';

const SAFE_POSITIONS = [16, 24, 29, 37, 42, 50, 55, 63];
const BOARD_SIZE = 460;
// Minimum gap between board resync requests triggered by an illegal pawn payload.
const RESYNC_THROTTLE_MS = 2000;

// Auto-move waits for the dice's own spin -> land -> hold sequence to fully
// finish (same fixed timing the dice component uses, plus a small buffer) so
// a pawn never starts sliding while the dice is still visibly rolling — and
// this delay never depends on pawn count or move count, only dice timing.
const AUTO_MOVE_DELAY_MS = MIN_SPIN_MS + LANDING_MS + RESULT_HOLD_MS + 150;

// ─── Movement animation timing ────────────────────────────────────────────────
// A pawn hops cell by cell along the route it actually walks, so a 6 reads as
// six distinct hops rather than a teleport. A move that isn't a forward walk
// (a capture sending a token back to its base) slides instead.
const HOP_MS = 105; // per cell stepped
const SLIDE_MS = 300; // non-forward move (capture / reset)
const HOP_LIFT = 9; // px the token rises at the top of a hop
const SLIDE_LIFT = 18;

// ─── Module-level image preload ───────────────────────────────────────────────
// Images are decoded ONCE when the module loads, not on every canvas repaint.
// All subsequent ctx.drawImage() calls are synchronous and zero-decode-cost.
const MAP_IMAGE = (() => {
    const img = new Image();
    img.src = mapImage;
    return img;
})();

const PAWN_IMAGES = (() => {
    const cache = {};
    Object.entries(pawnImages).forEach(([color, src]) => {
        const img = new Image();
        img.src = src;
        cache[color] = img;
    });
    return cache;
})();

const drawStar = (ctx, cx, cy, radius = 9) => {
    const spikes = 5;
    const innerRadius = radius * 0.42;
    let angle = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? radius : innerRadius;
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        angle += step;
    }
    ctx.closePath();
    ctx.fillStyle = STAR_FILL;
    ctx.fill();
    ctx.strokeStyle = STAR_STROKE;
    ctx.lineWidth = 0.9;
    ctx.stroke();
};

// ─── Offscreen pre-rendering ──────────────────────────────────────────────────
// The board image + stars never change, and a pawn token always looks identical
// for a given colour, so both are rasterised ONCE into offscreen canvases. A
// frame then costs one background blit plus one blit per token — no per-frame
// gradient construction and no per-frame compositing-mode switches, which is
// what makes a 60fps movement animation affordable.

let backgroundCanvas = null;

const buildBackground = () => {
    if (backgroundCanvas || !MAP_IMAGE.complete) return backgroundCanvas;
    const canvas = document.createElement('canvas');
    canvas.width = BOARD_SIZE;
    canvas.height = BOARD_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(MAP_IMAGE, 0, 0);
    // Calm the neon artwork once (see boardTone.js). Visual only — nothing about
    // positions or hit areas changes. If pixels can't be read (e.g. the image is ever
    // served cross-origin without CORS) the original artwork is simply kept.
    try {
        const pixels = ctx.getImageData(0, 0, BOARD_SIZE, BOARD_SIZE);
        toneBoardPixels(pixels.data);
        ctx.putImageData(pixels, 0, 0);
    } catch {
        /* keep the untoned board */
    }
    SAFE_POSITIONS.forEach(pos => {
        const { x, y } = positionMapCoords[pos];
        drawStar(ctx, x, y);
    });
    backgroundCanvas = canvas;
    return backgroundCanvas;
};

// Square sprite large enough to hold the token, its ground shadow and any
// 90° counter-rotation of the pair. Anchor is the sprite centre.
const SPRITE_SIZE = 56;
const SPRITE_CENTER = SPRITE_SIZE / 2;

const renderPawnSprite = (img, rotation) => {
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_SIZE;
    canvas.height = SPRITE_SIZE;
    const ctx = canvas.getContext('2d');

    ctx.translate(SPRITE_CENTER, SPRITE_CENTER);
    // The board rotates with the CSS transform on the <canvas>; tokens are
    // counter-rotated so they still read upright from the viewer's seat.
    ctx.rotate((-rotation * Math.PI) / 180);

    // Ground shadow — depth cue, sits just below the token's base
    const shadowGrad = ctx.createRadialGradient(0, 12, 0, 0, 12, 11);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 12, 11, 4.5, 0, 0, 2 * Math.PI);
    ctx.fill();

    ctx.drawImage(img, -17, -15, 35, 30);

    // Glossy highlight + base shading. Drawn with 'source-atop' against the
    // otherwise-transparent sprite, so it is clipped to the token's own
    // silhouette instead of bleeding a rectangle onto the board beneath it.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const glossGrad = ctx.createRadialGradient(-6, -9, 1, -6, -9, 15);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    glossGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.12)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glossGrad;
    ctx.fillRect(-17, -15, 35, 30);

    const baseShadeGrad = ctx.createLinearGradient(0, 4, 0, 15);
    baseShadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    baseShadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    ctx.fillStyle = baseShadeGrad;
    ctx.fillRect(-17, -15, 35, 30);
    ctx.restore();

    return canvas;
};

let spriteCache = { rotation: null, sprites: null };

const buildSprites = rotation => {
    if (spriteCache.rotation === rotation && spriteCache.sprites) return spriteCache.sprites;
    const entries = Object.entries(PAWN_IMAGES);
    if (entries.some(([, img]) => !img.complete)) return null; // retry once decoded
    const sprites = {};
    entries.forEach(([color, img]) => {
        sprites[color] = renderPawnSprite(img, rotation);
    });
    spriteCache = { rotation, sprites };
    return sprites;
};

// Walk the route a pawn actually takes, one cell at a time, so the animation
// follows the board rather than cutting across it. Returns null when the move
// isn't a forward walk (a capture), letting the caller slide instead.
const deriveRoute = (pawn, fromPosition, toPosition) => {
    const cells = [fromPosition];
    let current = fromPosition;
    for (let step = 0; step < 6; step++) {
        // Leaving the base is a single hop that only a 6 allows; every other hop is one cell.
        const next = getPositionAfterMove({ ...pawn, position: current }, current === pawn.basePos ? 6 : 1);
        if (next === current) break;
        cells.push(next);
        current = next;
        if (current === toPosition) return cells;
    }
    return null;
};

const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ─── Stacked-token layout ─────────────────────────────────────────────────────
// Several tokens can legally sit on one cell — two of your own mid-track, or a
// mix of colours on a safe square. They were all drawn at the exact same
// coordinate, so whichever painted last hid the rest completely and a stack was
// indistinguishable from a single token. Tokens sharing a cell are shrunk and
// fanned around the cell centre instead, and the cell gets a count badge.
const SINGLE_SLOT = { dx: 0, dy: 0, scale: 1, count: 1 };

const STACK_LAYOUTS = {
    2: { scale: 0.75, offsets: [[-7, -4], [7, 4]] },
    3: { scale: 0.66, offsets: [[0, -8], [-8, 5], [8, 5]] },
    4: { scale: 0.6, offsets: [[-7, -7], [7, -7], [-7, 7], [7, 7]] },
};

// 5+ on one cell is only reachable on a shared safe square — ring them evenly
// rather than hand-tuning yet more layouts.
const ringLayout = count => {
    const offsets = [];
    for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2;
        offsets.push([Math.cos(angle) * 9, Math.sin(angle) * 9]);
    }
    return { scale: 0.52, offsets };
};

const stackLayout = count => STACK_LAYOUTS[count] || ringLayout(count);

// pawnId -> { dx, dy, scale, count } in canonical canvas space, plus a
// position -> token count map for the badges. Slots are handed out by a stable
// sort on pawn id, so a token keeps its spot in the cluster across repaints
// instead of swapping places every frame.
const buildStackSlots = (pawns, rotation) => {
    const groups = {};
    pawns.forEach(pawn => {
        if (!groups[pawn.position]) groups[pawn.position] = [];
        groups[pawn.position].push(pawn);
    });

    const slots = {};
    const counts = {};

    Object.keys(groups).forEach(position => {
        const group = groups[position];
        counts[position] = group.length;

        if (group.length < 2) {
            slots[group[0]._id] = SINGLE_SLOT;
            return;
        }

        group.sort((a, b) => String(a._id).localeCompare(String(b._id)));
        const { scale, offsets } = stackLayout(group.length);
        group.forEach((pawn, index) => {
            const [dx, dy] = offsets[index];
            // The canvas is CSS-rotated per seat, so a raw canonical offset would
            // point somewhere different for each player. Counter-rotating it keeps
            // the cluster reading identically from every chair.
            const rotated = rotatePoint(dx, dy, 0, 0, -rotation);
            slots[pawn._id] = { dx: rotated.x, dy: rotated.y, scale, count: group.length };
        });
    });

    return { slots, counts };
};

const BADGE_OFFSET = 12;

// ─── Tap / hover target size ──────────────────────────────────────────────────
// The old fixed 12 board-px radius shrank with the board: on a ~350 px phone
// board a tap had to land within ~9 screen px of a pawn's centre, so ordinary
// thumb taps silently missed and the game felt frozen. The radius is now sized
// in screen pixels (a ~44 px touch target, the usual mobile guideline) and
// converted to board pixels, capped so a tap on empty board never grabs a pawn
// far away. Only the player's own movable pawns are ever candidates, and the
// nearest one wins, so the bigger target cannot pick the wrong token.
const TOUCH_TARGET_RADIUS_CSS = 22;
const MIN_HIT_RADIUS = 12;
const MAX_HIT_RADIUS = 28;

const hitRadiusFor = (rect, canvas) => {
    const boardPxPerCssPx = rect.width ? canvas.width / rect.width : 1;
    return Math.min(MAX_HIT_RADIUS, Math.max(MIN_HIT_RADIUS, TOUCH_TARGET_RADIUS_CSS * boardPxPerCssPx));
};

const drawStackBadge = (ctx, x, y, count, rotation) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((-rotation * Math.PI) / 180); // keep the digit upright for the viewer
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(8, 12, 20, 0.92)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), 0, 0.5);
    ctx.restore();
};

const Map = ({ pawns: boardPawns, nowMoving, rolledNumber }) => {
    const player = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);

    // Never draw, animate or hit-test a pawn on a cell outside its own colour's
    // path (e.g. a blue pawn in red's home column). The server repairs such boards
    // on load, so this only guards against a bad or stale payload.
    const { pawns, skippedPawns } = useMemo(() => {
        const valid = [];
        const skipped = [];
        boardPawns.forEach(pawn => (isValidPawnPosition(pawn) ? valid : skipped).push(pawn));
        return { pawns: valid, skippedPawns: skipped };
    }, [boardPawns]);

    // A skipped pawn used to stay invisible until some unrelated update (the next
    // roll or move) happened to replace the board. Ask the server for the
    // authoritative board straight away instead — it repairs illegal pawns before
    // sending — throttled so a persistently bad payload can't spam requests.
    const lastResyncRef = useRef(0);
    useEffect(() => {
        if (!skippedPawns.length) return;
        console.error('[BOARD_INTEGRITY] skipping illegal pawns, requesting resync', skippedPawns);
        const now = Date.now();
        if (!socket || !player.roomId || now - lastResyncRef.current < RESYNC_THROTTLE_MS) return;
        lastResyncRef.current = now;
        socket.emit('room:data', { roomId: player.roomId, color: player.color });
    }, [skippedPawns, socket, player.roomId, player.color]);

    const canvasRef = useRef(null);
    const ctxRef = useRef(null); // cached 2d context — not re-fetched on every event
    const touchableCentersRef = useRef({}); // pawn._id -> hit-area centre, for nearest-match picking
    const rafRef = useRef(null); // pending RAF handle for mousemove throttle
    const hintPawnRef = useRef(null); // mirrors hintPawn state without triggering renders

    // Animation bookkeeping. Kept entirely in refs so a running animation never
    // re-renders React — only the canvas repaints.
    const pawnsRef = useRef(pawns);
    // Plain objects, not Maps: this component is itself named `Map`, which
    // shadows the native constructor inside this module.
    const prevPositionsRef = useRef(null); // pawnId -> last rendered position
    const animationsRef = useRef({}); // pawnId -> { cells, perHop, lift, start }
    const drawRafRef = useRef(null);

    const [hintPawn, setHintPawn] = useState(null);

    // Movement SFX follow the existing mute toggle in the global navbar, and are
    // read through a ref so the paint loop never needs rebuilding when it flips.
    const { muted } = useAudioSettings() || {};
    const mutedRef = useRef(false);
    mutedRef.current = !!muted;

    // Local player perspective — rotates the board so the viewer's own color
    // always renders at the bottom-left ("my side"). Purely visual: game
    // coordinates, pawn positions and move logic below are untouched.
    const { rotation } = getLocalPerspective(player.color);
    const rotationRef = useRef(rotation);
    rotationRef.current = rotation;
    pawnsRef.current = pawns;

    // Cache the 2d context once on mount — avoids getContext() overhead on every event
    useEffect(() => {
        ctxRef.current = canvasRef.current?.getContext('2d') ?? null;
    }, []);

    // ── Canvas painting ────────────────────────────────────────────────────────
    // One background blit + one blit per token. Stable across renders (reads
    // everything from refs) so it can safely drive a RAF loop.
    const paint = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return false;

        const background = buildBackground();
        const sprites = buildSprites(rotationRef.current);
        if (!background || !sprites) return false; // images still decoding

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(background, 0, 0);

        const now = performance.now();
        let stillAnimating = false;

        const blit = (color, x, y, alpha, scale) => {
            const sprite = sprites[color];
            if (!sprite) return;
            if (alpha !== undefined) ctx.globalAlpha = alpha;
            if (scale === undefined || scale === 1) {
                ctx.drawImage(sprite, x - SPRITE_CENTER, y - SPRITE_CENTER);
            } else {
                const size = SPRITE_SIZE * scale;
                ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
            }
            if (alpha !== undefined) ctx.globalAlpha = 1;
        };

        const { slots, counts } = buildStackSlots(pawnsRef.current, rotationRef.current);

        // Tokens are collected first and painted back-to-front, so a token
        // nearer the viewer overlaps the one behind it the way a real piece
        // would, instead of the overlap depending on array order.
        const tokens = [];

        pawnsRef.current.forEach(pawn => {
            const slot = slots[pawn._id] || SINGLE_SLOT;
            const animation = animationsRef.current[pawn._id];
            if (!animation) {
                const { x, y } = positionMapCoords[pawn.position];
                tokens.push({ color: pawn.color, x: x + slot.dx, y: y + slot.dy, scale: slot.scale, moving: 0 });
                return;
            }

            const elapsed = now - animation.start;
            const legs = animation.cells.length - 1;
            const rawLeg = Math.floor(elapsed / animation.perHop);

            if (rawLeg >= legs) {
                delete animationsRef.current[pawn._id];
                const { x, y } = positionMapCoords[pawn.position];
                tokens.push({ color: pawn.color, x: x + slot.dx, y: y + slot.dy, scale: slot.scale, moving: 0 });
                return;
            }

            stillAnimating = true;

            // One sound per cell stepped onto — fired from the frame loop so it
            // stays locked to what the player actually sees.
            if (animation.playedLeg !== rawLeg) {
                animation.playedLeg = rawLeg;
                if (!mutedRef.current) {
                    if (animation.slide) playCapture();
                    else playStep(legs > 1 ? rawLeg / (legs - 1) : 0);
                }
            }

            const from = positionMapCoords[animation.cells[rawLeg]];
            const to = positionMapCoords[animation.cells[rawLeg + 1]];
            const local = (elapsed - rawLeg * animation.perHop) / animation.perHop;
            const eased = animation.ease ? easeInOutCubic(local) : local;
            const x = from.x + (to.x - from.x) * eased;
            const y = from.y + (to.y - from.y) * eased;
            // Arc the token upward through each leg so it reads as a hop.
            const lift = Math.sin(Math.PI * local) * animation.lift;
            // The destination slot offset is carried for the whole flight, so the
            // token flies straight into its place in the cluster rather than
            // snapping sideways the instant it lands.
            tokens.push({
                color: pawn.color,
                x: x + slot.dx,
                y: y - lift + slot.dy,
                scale: slot.scale,
                moving: 1,
            });
        });

        // Moving tokens last — a travelling piece stays on top of the board.
        tokens.sort((a, b) => a.moving - b.moving || a.y - b.y);
        tokens.forEach(token => blit(token.color, token.x, token.y, undefined, token.scale));

        // Count badge on every shared cell, so the stack size is readable at a
        // glance without having to pick the overlap apart.
        Object.keys(counts).forEach(position => {
            if (counts[position] < 2) return;
            const { x, y } = positionMapCoords[position];
            const badge = rotatePoint(BADGE_OFFSET, -BADGE_OFFSET, 0, 0, -rotationRef.current);
            drawStackBadge(ctx, x + badge.x, y + badge.y, counts[position], rotationRef.current);
        });

        // Ghost hint pawn — semi-transparent preview of where the pawn will land.
        // Suppressed mid-animation so it never competes with a moving token.
        const hint = hintPawnRef.current;
        if (hint && !stillAnimating) {
            const { x, y } = positionMapCoords[hint.position];
            blit(hint.color, x, y, 0.45);
        }

        return stillAnimating;
    }, []);

    // Drives repaints only while something is actually moving, then stops.
    const scheduleFrame = useCallback(() => {
        if (drawRafRef.current) return;
        const tick = () => {
            drawRafRef.current = null;
            if (paint()) {
                drawRafRef.current = requestAnimationFrame(tick);
            }
        };
        drawRafRef.current = requestAnimationFrame(tick);
    }, [paint]);

    // ── React to new board state ───────────────────────────────────────────────
    // Diffs incoming pawn positions against what is on screen, starts an
    // animation for anything that moved, and rebuilds hit areas at the pawns'
    // final positions so input stays correct while a token is still travelling.
    useEffect(() => {
        const previous = prevPositionsRef.current;
        const next = {};

        pawns.forEach(pawn => {
            next[pawn._id] = pawn.position;
            const before = previous ? previous[pawn._id] : undefined;
            if (before === undefined || before === pawn.position) return;

            const route = deriveRoute(pawn, before, pawn.position);
            animationsRef.current[pawn._id] = {
                cells: route || [before, pawn.position],
                perHop: route ? HOP_MS : SLIDE_MS,
                lift: route ? HOP_LIFT : SLIDE_LIFT,
                ease: !route,
                slide: !route, // capture / reset — thud instead of a step tick
                playedLeg: -1,
                start: performance.now(),
            };
        });

        prevPositionsRef.current = next;

        // Hit targets follow the same fan-out the painter uses, so each token in a
        // stack gets its own centre instead of all of them sharing the cell centre.
        const centers = {};
        const { slots } = buildStackSlots(pawns, rotation);
        pawns.forEach(pawn => {
            const slot = slots[pawn._id] || SINGLE_SLOT;
            const { x, y } = positionMapCoords[pawn.position];
            centers[pawn._id] = { x: x + slot.dx, y: y + slot.dy };
        });
        touchableCentersRef.current = centers;

        scheduleFrame();
    }, [pawns, rotation, scheduleFrame]);

    // Repaint for non-movement reasons (hover hint, perspective change), and
    // once more whenever a piece of artwork finishes decoding on first load.
    // paint() draws nothing until the board AND every pawn image are ready, but
    // only the board image used to trigger a repaint — so when the pawns finished
    // loading after it (the usual case on a slow connection) the board stayed
    // blank until some unrelated game update happened to arrive.
    useEffect(() => {
        scheduleFrame();
        const pending = [MAP_IMAGE, ...Object.values(PAWN_IMAGES)].filter(img => !img.complete);
        if (!pending.length) return undefined;
        const onLoad = () => scheduleFrame();
        pending.forEach(img => img.addEventListener('load', onLoad, { once: true }));
        return () => pending.forEach(img => img.removeEventListener('load', onLoad));
    }, [hintPawn, rotation, scheduleFrame]);

    // Which token a canonical-space point is aimed at: the nearest accepted token
    // whose centre is within `radius`. Hover and click both go through this, which
    // is what guarantees the token you see previewed is the token that moves.
    const pawnAtPoint = useCallback(
        (x, y, accept, radius) => {
            let best = null;
            let bestDistance = radius * radius;
            for (const pawn of pawns) {
                if (accept && !accept(pawn)) continue;
                const center = touchableCentersRef.current[pawn._id];
                if (!center) continue;
                const distance = (x - center.x) ** 2 + (y - center.y) ** 2;
                if (distance <= bestDistance) {
                    bestDistance = distance;
                    best = pawn;
                }
            }
            return best;
        },
        [pawns]
    );

    // ── Click handler ──────────────────────────────────────────────────────────
    const handleCanvasClick = useCallback(
        event => {
            const canvas = canvasRef.current;
            const ctx = ctxRef.current;
            if (!canvas || !ctx) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const rawX = (event.clientX - rect.left) * scaleX;
            const rawY = (event.clientY - rect.top) * scaleY;
            // The canvas is visually rotated (perspective) but its internal pixel
            // space — and every hit area in it — is still canonical, so undo the
            // rotation on the click point before testing.
            const { x: cursorX, y: cursorY } = rotatePoint(rawX, rawY, canvas.width / 2, canvas.height / 2, -rotation);

            // Exactly one token moves per click. The old loop had no break, so a
            // click on a cell holding two of your own movable tokens emitted a
            // game:move for each of them. Only this player's movable pawns are
            // candidates, so an opponent token sitting nearer the tap on a mixed
            // stack can never swallow the click.
            const target = pawnAtPoint(
                cursorX,
                cursorY,
                pawn => pawn.color === player.color && canPawnMove(pawn, rolledNumber),
                hitRadiusFor(rect, canvas)
            );
            // Offline, socket.io would buffer the move and send it whenever the
            // connection returns — possibly a stale move long after the tap. Skip it
            // instead (like the dice does); the player can tap again once reconnected,
            // and the server's turn timer still moves for them if they can't.
            if (target && socket?.connected) {
                // Room code rides along so the move still lands after a reconnect that
                // lost the server-side session (the server verifies the seat either way).
                socket.emit('game:move', target._id, player.roomId);
            }

            // Clear hint after move
            hintPawnRef.current = null;
            setHintPawn(null);
        },
        [pawnAtPoint, player.color, player.roomId, rolledNumber, socket, rotation]
    );

    // ── Mouse move handler ─────────────────────────────────────────────────────
    // Throttled to one RAF per frame — prevents canvas redraws on every mouse pixel.
    // setHintPawn only called when the hovered pawn actually changes.
    const handleMouseMove = useCallback(
        event => {
            if (!nowMoving || !rolledNumber) return;
            if (rafRef.current) return; // already a frame pending — skip

            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                const canvas = canvasRef.current;
                const ctx = ctxRef.current;
                if (!canvas || !ctx) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const rawX = (event.clientX - rect.left) * scaleX;
                const rawY = (event.clientY - rect.top) * scaleY;
                const { x, y } = rotatePoint(rawX, rawY, canvas.width / 2, canvas.height / 2, -rotation);

                let found = false;
                const hovered = pawnAtPoint(
                    x,
                    y,
                    pawn => player.color === pawn.color && canPawnMove(pawn, rolledNumber),
                    hitRadiusFor(rect, canvas)
                );
                if (hovered) {
                    const pawnPosition = getPositionAfterMove(hovered, rolledNumber);
                    if (pawnPosition) {
                        canvas.style.cursor = 'pointer';
                        // Only trigger re-render when the hovered pawn changes
                        if (hintPawnRef.current?.id !== hovered._id) {
                            const next = { id: hovered._id, position: pawnPosition, color: 'grey' };
                            hintPawnRef.current = next;
                            setHintPawn(next);
                        }
                        found = true;
                    }
                }

                if (!found) {
                    canvas.style.cursor = 'default';
                    if (hintPawnRef.current !== null) {
                        hintPawnRef.current = null;
                        setHintPawn(null);
                    }
                }
            });
        },
        [nowMoving, rolledNumber, pawnAtPoint, player.color, rotation]
    );

    // The hint was only ever cleared by a click or by hovering off a pawn. A move
    // that happens without a click (auto-move, the server's timeout move) left the
    // ghost stuck on the board, and once the turn passed the mouse-move handler
    // bails out early, so nothing cleared it until this player's next turn. It is
    // only valid for the current board, roll and turn, so drop it when any changes.
    useEffect(() => {
        if (hintPawnRef.current === null) return;
        hintPawnRef.current = null;
        setHintPawn(null);
        if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    }, [pawns, nowMoving, rolledNumber]);

    const handleMouseLeave = useCallback(() => {
        if (hintPawnRef.current === null) return;
        hintPawnRef.current = null;
        setHintPawn(null);
    }, []);

    // Cancel any pending frames on unmount to prevent stale-closure callbacks
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
        };
    }, []);

    // Auto-move: when exactly one of my pawns can legally move with the
    // rolled number, move it automatically instead of requiring a tap —
    // still gated by the existing canPawnMove check and the same server-side
    // game:move validation, so this only ever automates a click the player
    // could already have made themselves.
    // The pending timer is tracked in a ref (not the effect's own cleanup),
    // so an unrelated re-render (e.g. `pawns` getting a new array reference
    // from an unconnected server sync) can never cancel an already-scheduled
    // auto-move — only an actual turn/roll change does.
    const autoMovedForRef = useRef(null); // rolledNumber value already handled/scheduled
    const autoMoveTimerRef = useRef(null);
    useEffect(() => {
        if (!nowMoving || !rolledNumber) {
            autoMovedForRef.current = null;
            if (autoMoveTimerRef.current) {
                clearTimeout(autoMoveTimerRef.current);
                autoMoveTimerRef.current = null;
            }
            return;
        }
        if (autoMovedForRef.current === rolledNumber) return; // already scheduled for this roll

        const myMovablePawns = pawns.filter(pawn => pawn.color === player.color && canPawnMove(pawn, rolledNumber));
        if (myMovablePawns.length !== 1) return;

        autoMovedForRef.current = rolledNumber;
        const pawnId = myMovablePawns[0]._id;
        autoMoveTimerRef.current = setTimeout(() => {
            autoMoveTimerRef.current = null;
            // Same as a tap: never queue a move while offline. Allow a retry for this
            // roll once the board updates; otherwise the server's turn timer moves.
            if (!socket?.connected) {
                autoMovedForRef.current = null;
                return;
            }
            socket.emit('game:move', pawnId, player.roomId);
        }, AUTO_MOVE_DELAY_MS);
    }, [pawns, rolledNumber, nowMoving, player.color, player.roomId, socket]);

    // Cleanup the auto-move timer on unmount only
    useEffect(() => {
        return () => {
            if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
        };
    }, []);

    return (
        <canvas
            className={styles.canvas}
            width={BOARD_SIZE}
            height={BOARD_SIZE}
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
    );
};

// React.memo — prevents canvas repaint when parent re-renders for unrelated reasons
// (ping update, clock tick, toast notification, etc.)
export default React.memo(Map);

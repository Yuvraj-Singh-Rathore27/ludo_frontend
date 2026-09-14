import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
import { PlayerDataContext, SocketContext } from '../../../App';
import mapImage from '../../../images/map.jpg';
import positionMapCoords from '../positions';
import pawnImages from '../../../constants/pawnImages';
import canPawnMove from './canPawnMove';
import getPositionAfterMove from './getPositionAfterMove';
import { isValidPawnPosition } from './boardPath';
import { layoutPawns, BASE_HIT_RADIUS } from './stackLayout';
import { getLocalPerspective, rotatePoint } from '../perspective';
import { MIN_SPIN_MS, LANDING_MS, RESULT_HOLD_MS } from '../../Navbar/Dice/diceTiming';
import styles from '../Gameboard.module.css';

const SAFE_POSITIONS = [16, 24, 29, 37, 42, 50, 55, 63];

// Auto-move waits for the dice's own spin -> land -> hold sequence to fully
// finish (same fixed timing the dice component uses, plus a small buffer) so
// a pawn never starts sliding while the dice is still visibly rolling — and
// this delay never depends on pawn count or move count, only dice timing.
const AUTO_MOVE_DELAY_MS = MIN_SPIN_MS + LANDING_MS + RESULT_HOLD_MS + 150;

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
// ─────────────────────────────────────────────────────────────────────────────

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
    ctx.fillStyle = 'gold';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
};

const Map = ({ pawns, nowMoving, rolledNumber }) => {
    const player = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);

    const canvasRef = useRef(null);
    const ctxRef = useRef(null);           // cached 2d context — not re-fetched on every event
    const touchableAreasRef = useRef({});  // Path2D map keyed by pawn._id — never mutates props
    const drawOrderRef = useRef([]);       // pawns in draw order (top-most last) for hit testing
    const rafRef = useRef(null);           // pending RAF handle for mousemove throttle
    const hintPawnRef = useRef(null);      // mirrors hintPawn state without triggering renders

    const [hintPawn, setHintPawn] = useState(null);

    // Local player perspective — rotates the board so the viewer's own color
    // always renders at the bottom-left ("my side"). Purely visual: game
    // coordinates, pawn positions and move logic below are untouched.
    const { rotation } = getLocalPerspective(player.color);

    // Cache the 2d context once on mount — avoids getContext() overhead on every event
    useEffect(() => {
        ctxRef.current = canvasRef.current?.getContext('2d') ?? null;
    }, []);

    // ── Canvas redraw ──────────────────────────────────────────────────────────
    // Runs only when pawns or hintPawn change. No new Image() objects created here —
    // all images are pre-decoded at module level above.
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(MAP_IMAGE, 0, 0);

            SAFE_POSITIONS.forEach(pos => {
                const { x, y } = positionMapCoords[pos];
                drawStar(ctx, x, y);
            });

            // The board image/stars rotate with the CSS transform below, but pawn
            // tokens are counter-rotated here so they still render upright. A soft
            // ground shadow plus a glossy highlight (confined to the pawn's own
            // silhouette via 'source-atop') gives each flat token a 3D, rounded feel
            // without new artwork or a rendering-framework change.
            // offsetX/offsetY/scale spread pawns that share a cell; they are applied in
            // the upright frame so the spread looks the same for every board rotation.
            const drawUpright = (img, x, y, offsetX = 0, offsetY = 0, scale = 1) => {
                if (!img?.complete) return;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate((-rotation * Math.PI) / 180);
                ctx.translate(offsetX, offsetY);
                ctx.scale(scale, scale);

                // Ground shadow — depth cue, sits just below the token's base
                const shadowGrad = ctx.createRadialGradient(0, 12, 0, 0, 12, 11);
                shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
                shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = shadowGrad;
                ctx.beginPath();
                ctx.ellipse(0, 12, 11, 4.5, 0, 0, 2 * Math.PI);
                ctx.fill();

                ctx.drawImage(img, -17, -15, 35, 30);

                // Glossy highlight — 'source-atop' only paints where the token
                // itself is already opaque, so it never bleeds past its silhouette.
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

                ctx.restore();
            };

            // Small count badge for cells holding more pawns than the mini-grid has slots.
            const drawCountBadge = (x, y, count) => {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate((-rotation * Math.PI) / 180);
                ctx.beginPath();
                ctx.arc(11, -11, 7, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(count), 11, -11);
                ctx.restore();
            };

            // Never draw a pawn on a cell outside its own colour's path (e.g. a blue
            // pawn in red's home column). The server repairs such boards on load and
            // resyncs clients, so this only guards against a bad payload reaching us.
            const legalPawns = pawns.filter(pawn => {
                if (isValidPawnPosition(pawn)) return true;
                console.error('[BOARD_INTEGRITY] skipping illegal pawn', pawn);
                return false;
            });

            // Build fresh Path2D hit areas — stored in refs, never written to prop objects.
            // Each hit area sits where its pawn is actually drawn (including the stack
            // offset, converted back into canonical canvas space).
            const layout = layoutPawns(legalPawns, player.color);
            const areas = {};
            layout.forEach(({ pawn, offsetX, offsetY, scale, stackSize, showCount }) => {
                const { x, y } = positionMapCoords[pawn.position];
                const center = rotatePoint(x + offsetX, y + offsetY, x, y, -rotation);

                const area = new Path2D();
                area.arc(center.x, center.y, BASE_HIT_RADIUS * scale, 0, 2 * Math.PI);
                areas[pawn._id] = area;

                drawUpright(PAWN_IMAGES[pawn.color], x, y, offsetX, offsetY, scale);
                if (showCount) drawCountBadge(x, y, stackSize);
            });
            touchableAreasRef.current = areas;
            // Top-most pawn last — hit testing walks this in reverse.
            drawOrderRef.current = layout.map(entry => entry.pawn);

            // Ghost hint pawn — semi-transparent preview of where pawn will land
            if (hintPawn) {
                const { x, y } = positionMapCoords[hintPawn.position];
                ctx.globalAlpha = 0.45;
                drawUpright(PAWN_IMAGES[hintPawn.color], x, y);
                ctx.globalAlpha = 1;
            }
        };

        if (MAP_IMAGE.complete) {
            draw();
        } else {
            // First paint — map not decoded yet; draw once it is
            MAP_IMAGE.addEventListener('load', draw, { once: true });
            return () => MAP_IMAGE.removeEventListener('load', draw);
        }
    }, [pawns, hintPawn, rotation, player.color]);

    // ── Hit testing ────────────────────────────────────────────────────────────
    // Walks pawns top-most first and returns the first one under (x, y) — in
    // canonical canvas space — that belongs to this player and can legally move.
    // Opponent pawns in the same stack are ignored, never "tapped".
    const findMovablePawnAt = useCallback((ctx, x, y) => {
        const ordered = drawOrderRef.current;
        for (let i = ordered.length - 1; i >= 0; i--) {
            const pawn = ordered[i];
            if (pawn.color !== player.color || !canPawnMove(pawn, rolledNumber)) continue;
            const area = touchableAreasRef.current[pawn._id];
            if (area && ctx.isPointInPath(area, x, y)) return pawn;
        }
        return null;
    }, [player.color, rolledNumber]);

    // ── Click handler ──────────────────────────────────────────────────────────
    const handleCanvasClick = useCallback(event => {
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

        // One tap = at most one move, and only for one of my own pawns (the top-most
        // under the finger when pawns are stacked).
        const pawn = findMovablePawnAt(ctx, cursorX, cursorY);
        if (pawn) socket?.emit('game:move', pawn._id);

        // Clear hint after move
        hintPawnRef.current = null;
        setHintPawn(null);
    }, [findMovablePawnAt, socket, rotation]);

    // ── Mouse move handler ─────────────────────────────────────────────────────
    // Throttled to one RAF per frame — prevents canvas redraws on every mouse pixel.
    // setHintPawn only called when the hovered pawn actually changes.
    const handleMouseMove = useCallback(event => {
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
            const pawn = findMovablePawnAt(ctx, x, y);
            if (pawn) {
                const pawnPosition = getPositionAfterMove(pawn, rolledNumber);
                canvas.style.cursor = 'pointer';
                // Only trigger re-render when the hovered pawn changes
                if (hintPawnRef.current?.id !== pawn._id) {
                    const next = { id: pawn._id, position: pawnPosition, color: 'grey' };
                    hintPawnRef.current = next;
                    setHintPawn(next);
                }
                found = true;
            }

            if (!found) {
                canvas.style.cursor = 'default';
                if (hintPawnRef.current !== null) {
                    hintPawnRef.current = null;
                    setHintPawn(null);
                }
            }
        });
    }, [nowMoving, rolledNumber, findMovablePawnAt, rotation]);

    // Cancel any pending RAF on unmount to prevent stale-closure callbacks
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
            socket?.emit('game:move', pawnId);
        }, AUTO_MOVE_DELAY_MS);
    }, [pawns, rolledNumber, nowMoving, player.color, socket]);

    // Cleanup the auto-move timer on unmount only
    useEffect(() => {
        return () => {
            if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
        };
    }, []);

    return (
        <canvas
            className={styles.canvas}
            width={460}
            height={460}
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
    );
};

// React.memo — prevents canvas repaint when parent re-renders for unrelated reasons
// (ping update, clock tick, toast notification, etc.)
export default React.memo(Map);

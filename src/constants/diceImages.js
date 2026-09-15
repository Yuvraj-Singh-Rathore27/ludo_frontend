import one   from '../images/dice/1.png';
import two   from '../images/dice/2.png';
import three from '../images/dice/3.png';
import four  from '../images/dice/4.png';
import five  from '../images/dice/5.png';
import six   from '../images/dice/6.png';
import roll  from '../images/dice/roll.png';
// rolling.gif removed — was imported but never accessed (index 7 was unreachable).
// GIF assets decode on CPU frame-by-frame with no GPU path; removing it reduces
// bundle size and eliminates a background decode task on low-end devices.

const diceImages = [one, two, three, four, five, six, roll];

// Preload + decode every face ONCE when the module loads. The 3D dice cube is
// mounted fresh for each roll, so without this the browser re-requests and
// re-decodes all faces right as the spin starts — a visible stutter on low-end
// phones. Holding the decoded Image objects keeps them in the in-memory image
// cache, so each new <img> with the same src renders instantly.
export const PRELOADED_DICE_IMAGES = diceImages.map(src => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    if (typeof img.decode === 'function') img.decode().catch(() => {});
    return img;
});

export default diceImages;

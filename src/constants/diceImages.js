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

export default diceImages;

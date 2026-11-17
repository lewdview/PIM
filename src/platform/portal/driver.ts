// The portal driver ./bridge talks to. vite.config.ts swaps this file for the driver
// of the portal named by PIM_PORTAL (klyo, crazygames, gamealia); this default keeps
// the type checker and the editor pointed at a real one.
export { driver } from '../klyo/driver';

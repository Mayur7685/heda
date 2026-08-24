export default {};
export const existsSync = () => false;
export const readFileSync = () => { throw new Error('fs not available in browser'); };
export const writeFileSync = () => { throw new Error('fs not available in browser'); };
export const unlinkSync = () => {};
export const statSync = () => { throw new Error('fs not available in browser'); };

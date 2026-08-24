// ZgFile is Node.js only (uses fs). Not used in browser — we use Blob instead.
export class ZgFile {
  static fromFilePath(): never {
    throw new Error("ZgFile is not available in browser. Use Blob instead.");
  }
}
export default ZgFile;

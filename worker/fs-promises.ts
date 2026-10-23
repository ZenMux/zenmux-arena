import { promises } from "./fs";
export const { readFile, mkdir, writeFile, rename, unlink } = promises;
export default promises;

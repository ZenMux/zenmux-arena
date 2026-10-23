import files from "virtual:arena-files";
import { createReadonlyFs } from "./readonly-fs";
const fs = createReadonlyFs(files, process.cwd());
export const { existsSync, statSync, readdirSync, readFileSync, promises } = fs;
export default fs;

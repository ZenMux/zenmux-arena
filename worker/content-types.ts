export interface BundledFile {
  base64: string;
  size: number;
}
export type FileManifest = Record<string, BundledFile>;

// Types for the typecheck of src/lib/content/data.ts; in the app these are src/shims/node-fs.ts and node-path.ts.
declare module "node:fs" {
  export function readFileSync(file: string, encoding: string): string;
}
declare module "node:path" {
  const path: { join(...parts: string[]): string };
  export default path;
}
declare const process: { cwd(): string; env: Record<string, string | undefined> };

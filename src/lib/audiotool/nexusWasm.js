// The Nexus SDK picks its document-validator loader by checking
// `typeof process !== "undefined"`. The app's Node polyfills (needed by
// Streamr) define `process` in the browser, so the SDK wrongly assumes it is
// running on a server and refuses to load. We register the SDK's own browser
// loader explicitly instead — same CDN build the SDK would fetch itself.
import { createAudiotoolClient } from '@audiotool/nexus';

const WASM_BASE = 'https://cdn.audiotool.com/website-assets/document-service/c7e8de11659988655221fab1d0d228a522a5318d';

const browserWasmLoader = {
  async executeRuntime() {
    await import(/* @vite-ignore */ `${WASM_BASE}/wasm_exec.js`);
  },
  async loadModule() {
    const res = await fetch(`${WASM_BASE}/document_validator.wasm.gz`);
    if (!res.ok) throw new Error("Couldn't fetch the Audiotool document validator");
    return WebAssembly.compileStreaming(res);
  },
};

let registered = null;

/** Registers the browser loader once. Makes no network calls. */
export function ensureBrowserWasmLoader() {
  // createAudiotoolClient({ wasm }) is the SDK's public way to set the global
  // loader; the throwaway client it returns is never used.
  registered ??= createAudiotoolClient({ auth: 'unused', wasm: browserWasmLoader });
  return registered;
}
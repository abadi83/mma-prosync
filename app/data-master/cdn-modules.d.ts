/* Deklarasi modul eksternal yang di-load dari CDN saat runtime (webpackIgnore) */
declare module 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm' {
  export function removeBackground(image: File | Blob | string, config?: any): Promise<Blob>;
  const _default: { removeBackground: typeof removeBackground };
  export default _default;
}

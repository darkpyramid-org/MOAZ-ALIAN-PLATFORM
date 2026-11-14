/**
 * Ambient module declaration for `on-headers` — the tiny helper the
 * `compression` middleware uses to register response-header hooks (how
 * "Vary: Accept-Encoding" gets appended at flush time, before CORS appends
 * "Origin"). The package ships JavaScript only, so without this file TS7016
 * fires and the middleware typing degrades to `any`.
 */
declare module 'on-headers' {
  interface ResponseLike {
    on(event: string, listener: () => void): unknown;
  }

  function onHeaders(res: ResponseLike, listener: () => void): void;

  export default onHeaders;
}

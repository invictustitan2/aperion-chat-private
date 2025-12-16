declare module "prismjs" {
  interface PrismStatic {
    languages: Record<string, unknown>;
    highlight(code: string, grammar: unknown, language: string): string;
    util: {
      encode(code: string): string;
    };
  }

  const Prism: PrismStatic;
  export default Prism;
}

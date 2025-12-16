import { clsx } from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import "katex/dist/katex.min.css";

import Prism from "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";

function normalizeLang(lang: string | null): string {
  const raw = (lang || "").trim().toLowerCase();
  if (!raw) return "text";

  const map: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    json: "json",
    sh: "bash",
    shell: "bash",
    bash: "bash",
    py: "python",
    yml: "yaml",
    md: "markdown",
    html: "markup",
    plaintext: "text",
    text: "text",
  };

  return map[raw] || raw;
}

function MermaidBlock({ code }: { code: string }) {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setErr(null);

    (async () => {
      try {
        // Only load Mermaid if the message actually contains a mermaid block.
        const mod = await import("mermaid");
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "dark",
        });

        const id = `m-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
        const out = await mermaid.render(id, code);
        const nextSvg = typeof out === "string" ? out : out.svg;
        if (!cancelled) setSvg(nextSvg);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setErr(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  return (
    <div className="my-2 rounded-xl border border-white/10 bg-black/20 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-black/10">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">
          mermaid
        </div>
      </div>

      {err ? (
        <div className="p-3 text-xs text-red-300">Mermaid error: {err}</div>
      ) : !svg ? (
        <div className="p-3 text-xs text-gray-400">Rendering diagram…</div>
      ) : (
        <div
          className="p-3 overflow-x-auto"
          // Mermaid renders an SVG string.
          // Security level is strict; we do not accept arbitrary HTML.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string | null }) {
  const normalized = normalizeLang(lang);
  const [expanded, setExpanded] = useState(false);

  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);
  const isCollapsible = lines.length > 12;
  const visibleCode = expanded ? code : lines.slice(0, 12).join("\n");

  const highlightedHtml = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grammar = (Prism.languages as any)[normalized];

    try {
      if (!grammar) {
        return Prism.util.encode(visibleCode) as unknown as string;
      }
      return Prism.highlight(visibleCode, grammar, normalized);
    } catch {
      return Prism.util.encode(visibleCode) as unknown as string;
    }
  }, [normalized, visibleCode]);

  return (
    <div className="my-2 rounded-xl border border-white/10 bg-black/20 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-black/10">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">
          {normalized}
        </div>
        {isCollapsible && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-300 hover:bg-white/10 transition-colors"
            title={expanded ? "Collapse code" : "Expand code"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {expanded ? "Collapse" : "Expand"}
          </button>
        )}
      </div>

      <pre
        className={clsx(
          "aperion-prism p-3 text-xs md:text-sm overflow-x-auto",
          "leading-relaxed",
        )}
      >
        <code
          className={clsx("language-" + normalized, "block")}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
        {!expanded && isCollapsible && (
          <div className="mt-2 text-[11px] text-gray-400">…</div>
        )}
      </pre>
    </div>
  );
}

export function MessageContent({ content }: { content: string }) {
  return (
    <div className="space-y-2 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="underline text-gray-200 hover:text-white"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || ""}
              className="max-w-full rounded-lg border border-white/10"
              loading="lazy"
            />
          ),
          p: ({ children }) => (
            <p className="whitespace-pre-wrap leading-relaxed text-gray-100">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 text-gray-100">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 text-gray-100">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-white/10 pl-3 text-gray-200">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const text = String(children ?? "");
            const match = /language-(\w+)/.exec(className || "");
            const lang = match?.[1] ?? null;

            // Inline code (no language class) should stay inline.
            if (!lang) {
              return (
                <code
                  {...props}
                  className={clsx(
                    "px-1 py-[2px] rounded bg-black/20 border border-white/10 font-mono text-[0.9em]",
                    className,
                  )}
                >
                  {children}
                </code>
              );
            }

            const normalized = normalizeLang(lang);
            if (normalized === "mermaid") {
              return <MermaidBlock code={text.replace(/\n$/, "")} />;
            }

            return <CodeBlock code={text.replace(/\n$/, "")} lang={lang} />;
          },
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-white/10">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-white/10 bg-black/20 px-2 py-1 text-left text-sm text-gray-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-white/10 px-2 py-1 text-sm text-gray-100">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

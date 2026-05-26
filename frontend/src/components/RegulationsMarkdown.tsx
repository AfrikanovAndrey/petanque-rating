import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { regulationsForDisplay } from "../utils";

interface RegulationsMarkdownProps {
  source: string | null | undefined;
  className?: string;
}

const markdownRootClass =
  "min-w-0 max-w-full break-words [overflow-wrap:anywhere]";

const RegulationsMarkdown: React.FC<RegulationsMarkdownProps> = ({
  source,
  className = "",
}) => {
  const text = regulationsForDisplay(source);

  return (
    <div
      className={`${markdownRootClass} space-y-2 text-gray-900 ${className}`.trim()}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold text-gray-900 break-words">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-gray-900 break-words">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-gray-900 break-words">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed break-words">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 break-words">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 break-words">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="break-words">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700 break-words">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary-600 hover:underline break-words"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt ?? ""}
              className="max-w-full h-auto rounded"
            />
          ),
          table: ({ children }) => (
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium break-words">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-3 py-2 break-words">
              {children}
            </td>
          ),
          pre: ({ children }) => (
            <pre className="max-w-full overflow-x-auto rounded bg-gray-900 p-3 text-sm text-gray-100">
              {children}
            </pre>
          ),
          code: (props) => {
            const { children, className: codeClassName } = props;
            const hasLanguage =
              typeof codeClassName === "string" &&
              codeClassName.includes("language-");
            const explicitInline =
              "inline" in props
                ? (props as { inline?: boolean }).inline
                : undefined;
            const useInline =
              explicitInline === true ||
              (explicitInline !== false && !hasLanguage);
            return useInline ? (
              <code className="rounded bg-gray-100 px-1 py-0.5 text-sm break-words">
                {children}
              </code>
            ) : (
              <code className="block whitespace-pre overflow-x-auto text-sm text-gray-100">
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default RegulationsMarkdown;

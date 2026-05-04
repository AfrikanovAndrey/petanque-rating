import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { regulationsForDisplay } from "../utils";

interface RegulationsMarkdownProps {
  source: string | null | undefined;
  className?: string;
}

const RegulationsMarkdown: React.FC<RegulationsMarkdownProps> = ({
  source,
  className = "",
}) => {
  const text = regulationsForDisplay(source);

  return (
    <div className={`space-y-2 text-gray-900 ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold text-gray-900">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-gray-900">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-gray-900">{children}</h3>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary-600 hover:underline"
            >
              {children}
            </a>
          ),
          code: (props) => {
            const { children, className } = props;
            const hasLanguage =
              typeof className === "string" &&
              className.includes("language-");
            const explicitInline =
              "inline" in props
                ? (props as { inline?: boolean }).inline
                : undefined;
            const useInline =
              explicitInline === true ||
              (explicitInline !== false && !hasLanguage);
            return useInline ? (
              <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">
                {children}
              </code>
            ) : (
              <code className="block overflow-x-auto rounded bg-gray-900 p-3 text-sm text-gray-100">
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

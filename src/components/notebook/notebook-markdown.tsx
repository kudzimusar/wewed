'use client'

import ReactMarkdown from 'react-markdown'

export function NotebookMarkdown({
  markdown,
  className = '',
}: {
  markdown: string
  className?: string
}) {
  return (
    <div className={`break-words text-[15px] leading-7 text-inherit ${className}`} data-notebook-rendered-markdown>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="mb-3 mt-6 text-2xl font-semibold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-5 text-xl font-semibold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="my-2 whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-inherit">{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-6">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-amber-300/45 bg-amber-300/5 px-4 py-2 italic text-inherit/80">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-amber-200 underline decoration-amber-300/45 underline-offset-2 hover:text-amber-100"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[0.9em] text-amber-100">{children}</code>
          ),
          hr: () => <hr className="my-5 border-white/10" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

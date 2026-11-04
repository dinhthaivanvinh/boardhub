import { Fragment } from 'react';

/** Renders the tiny markdown subset used in game rules: paragraphs and **bold**. */
export function SimpleMarkdown({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="mb-3 leading-relaxed">
          {para
            .split(/(\*\*[^*]+\*\*)/)
            .map((part, j) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : (
                <Fragment key={j}>{part}</Fragment>
              ),
            )}
        </p>
      ))}
    </>
  );
}

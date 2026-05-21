import DOMPurify from "dompurify";
import parse, {
  domToReact,
  type DOMNode,
  type HTMLReactParserOptions,
} from "html-react-parser";
import { Fragment, type ReactNode } from "react";
import { senderColor, splitMentions } from "@/lib/sender";
import { useUserName } from "@/hooks/use-user-name";

const ALLOWED_TAGS = [
  "del", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "p", "a",
  "ul", "ol", "sup", "sub", "li", "b", "i", "u", "strong", "em", "s",
  "code", "hr", "br", "div", "table", "thead", "tbody", "tr", "th",
  "td", "caption", "pre", "span", "img", "details", "summary",
];

const ALLOWED_ATTR = [
  "href", "name", "target", "width", "height", "alt", "title", "src",
  "start", "class", "data-mx-color", "data-mx-bg-color", "data-mx-spoiler",
];

function MentionPill({ userId, roomId }: { userId: string; roomId: string }) {
  const name = useUserName(userId, roomId);
  return (
    <span
      className="rounded-sm bg-primary/15 px-1 font-medium"
      style={{ color: senderColor(userId) }}
      title={userId}
    >
      @{name}
    </span>
  );
}

function renderTextWithMentions(text: string, roomId: string): ReactNode[] {
  return splitMentions(text).map((seg, i) =>
    seg.userId ? (
      <MentionPill key={i} userId={seg.userId} roomId={roomId} />
    ) : (
      <Fragment key={i}>{seg.text}</Fragment>
    ),
  );
}

interface Props {
  html: string;
  roomId: string;
}

export function FormattedMessageBody({ html, roomId }: Props) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|ftp|mailto|magnet|matrix):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });

  const options: HTMLReactParserOptions = {
    replace: (node) => {
      if (node.type === "tag" && node.name === "a") {
        const href = (node as { attribs?: Record<string, string> }).attribs?.href ?? "";
        const children = (node as { children?: DOMNode[] }).children ?? [];
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer ugc"
            className="text-primary underline"
          >
            {domToReact(children, options)}
          </a>
        );
      }
      if (node.type === "text") {
        const value = (node as { data: string }).data;
        if (!value.includes(":")) return undefined;
        return <Fragment>{renderTextWithMentions(value, roomId)}</Fragment>;
      }
      return undefined;
    },
  };

  return (
    <div
      className={[
        "prose prose-sm dark:prose-invert max-w-none min-w-0 break-words",
        // Tighter vertical rhythm than the default `prose` for chat density,
        // and re-bind the prose color tokens to the shadcn theme so the
        // Reef palette stays consistent across light/dark.
        "prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1",
        "prose-pre:my-2 prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border",
        "prose-code:bg-muted prose-code:text-foreground prose-code:rounded-sm prose-code:px-1 prose-code:py-px prose-code:font-normal",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-a:text-primary prose-a:underline prose-a:underline-offset-2",
        "prose-blockquote:border-muted-foreground/40 prose-blockquote:text-muted-foreground prose-blockquote:not-italic",
        "prose-hr:border-border",
        "prose-strong:text-foreground prose-headings:text-foreground",
      ].join(" ")}
    >
      {parse(clean, options)}
    </div>
  );
}

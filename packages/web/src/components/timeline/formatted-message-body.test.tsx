import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormattedMessageBody } from "./formatted-message-body";

describe("<FormattedMessageBody>", () => {
  it("renders <strong> from sanitized HTML", () => {
    render(<FormattedMessageBody html="<p><strong>hi</strong></p>" roomId="!r:zoon.eco" />);
    const strong = screen.getByText("hi");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders a code block with the matrix language class", () => {
    render(
      <FormattedMessageBody
        html='<pre><code class="language-ts">const x = 1</code></pre>'
        roomId="!r:zoon.eco"
      />,
    );
    expect(screen.getByText("const x = 1").tagName).toBe("CODE");
  });

  it("strips <script> defensively even if it reaches the client", () => {
    const { container } = render(
      <FormattedMessageBody html="<script>alert(1)</script><p>ok</p>" roomId="!r:zoon.eco" />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("ok")).toBeDefined();
  });

  it("drops javascript: hrefs", () => {
    const { container } = render(
      <FormattedMessageBody
        html='<p><a href="javascript:alert(1)">x</a></p>'
        roomId="!r:zoon.eco"
      />,
    );
    const a = container.querySelector("a");
    // DOMPurify drops the href entirely
    expect(a?.getAttribute("href")).toBeFalsy();
  });

  it("substitutes @user:server text nodes with a mention pill", () => {
    const { container } = render(
      <FormattedMessageBody
        html="<p>hi @alice:zoon.eco welcome</p>"
        roomId="!r:zoon.eco"
      />,
    );
    expect(container.textContent).toContain("@");
    expect(container.textContent).toContain("alice");
    const pill = container.querySelector('span[title="@alice:zoon.eco"]');
    expect(pill).not.toBeNull();
  });

  it("renders list items", () => {
    render(
      <FormattedMessageBody html="<ul><li>one</li><li>two</li></ul>" roomId="!r:zoon.eco" />,
    );
    expect(screen.getByText("one").tagName).toBe("LI");
    expect(screen.getByText("two").tagName).toBe("LI");
  });

  it("renders an external link with safe target", () => {
    const { container } = render(
      <FormattedMessageBody
        html='<p><a href="https://example.com">x</a></p>'
        roomId="!r:zoon.eco"
      />,
    );
    const a = container.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("https://example.com");
    expect(a.getAttribute("rel")).toContain("noopener");
  });
});

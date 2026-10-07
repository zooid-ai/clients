import { useEffect, type ReactNode } from "react";
import type { Preview } from "@storybook/react-vite";
// Pull in the app's full Tailwind v4 layer + shadcn design tokens so stories
// render with the real theme. The dark variant is class-based
// (`@custom-variant dark (&:is(.dark *))`), so the decorator toggles `.dark` on
// `<html>`, as the app's ThemeProvider does. A wrapper div would miss Radix
// portals (dialogs, menus, popovers), which render into `document.body`.
import "../src/index.css";

function ThemeRoot({ dark, children }: { dark: boolean; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    return () => root.classList.remove("dark");
  }, [dark]);
  return <div className="bg-background text-foreground p-6">{children}</div>;
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    a11y: { test: "todo" },
  },
  globalTypes: {
    theme: {
      description: "App theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const dark = context.globals.theme === "dark";
      return (
        <ThemeRoot dark={dark}>
          <Story />
        </ThemeRoot>
      );
    },
  ],
};

export default preview;

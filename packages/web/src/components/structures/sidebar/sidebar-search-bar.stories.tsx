import type { Meta } from "@storybook/react-vite";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { setGlobalSearchEnabled } from "../../../client/feature-flags";
import { SidebarSearchBar } from "./sidebar-search-bar";

const meta = {
  title: "Structures/Sidebar/SidebarSearchBar",
} satisfies Meta;

export default meta;

export const Default = {
  render() {
    setGlobalSearchEnabled(true);
    return (
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="*"
            element={
              <div className="w-56 border border-border">
                <SidebarSearchBar />
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  },
};

export const GlobalSearchOff = {
  render() {
    setGlobalSearchEnabled(false);
    return (
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="*"
            element={
              <div className="w-56 border border-border">
                <SidebarSearchBar />
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  },
};

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>press start</Button>);
    expect(screen.getByRole("button", { name: "press start" })).toBeInTheDocument();
  });
});

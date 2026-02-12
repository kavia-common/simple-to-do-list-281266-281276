import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders Todo header", () => {
  render(<App />);
  const header = screen.getByText(/todo/i);
  expect(header).toBeInTheDocument();
});

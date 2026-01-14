import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders Personal Notes header", () => {
  render(<App />);
  expect(screen.getByText(/Personal Notes/i)).toBeInTheDocument();
});

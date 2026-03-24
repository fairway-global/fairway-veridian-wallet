import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { pauseCircleOutline, playCircleOutline } from "ionicons/icons";
import am from "../../../locales/am/am.json";
import { i18n } from "../../../i18n";
import { Intro } from "./index";

describe("Intro Component", () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  test("Render slide 1", () => {
    render(<Intro />);
    const linkElement = screen.getByText("Welcome to Veridian");
    expect(linkElement).toBeInTheDocument();
  });

  test("Renders the slides images", () => {
    render(<Intro />);
    const images = screen.getAllByRole("img");
    expect(images.length).toBe(4);
  });

  test("Renders the slides titles", () => {
    render(<Intro />);
    const titles = screen.getAllByRole("heading", { level: 2 });
    expect(titles.length).toBe(4);
  });

  test("updates the slide copy when the language changes", async () => {
    render(<Intro />);

    await act(async () => {
      await i18n.changeLanguage("am");
    });

    expect(screen.getByText(am.onboarding.slides[0].title)).toBeInTheDocument();
  });
});

describe("handleAutoplay function for slides", () => {
  test("handleAutoplay() should stop autoplay when pause icon is clicked", () => {
    const { getByTestId } = render(<Intro />);
    const playIcon = getByTestId("play-indicator");

    // Pause
    fireEvent.click(playIcon);

    expect(playIcon).toHaveAttribute("icon", playCircleOutline);
  });

  test("handleAutoplay() should start autoplay when play icon is clicked", () => {
    const { getByTestId } = render(<Intro />);
    const playIcon = getByTestId("play-indicator");

    // Pause
    fireEvent.click(playIcon);
    // Start
    fireEvent.click(playIcon);

    expect(playIcon).toHaveAttribute("icon", pauseCircleOutline);
  });
});

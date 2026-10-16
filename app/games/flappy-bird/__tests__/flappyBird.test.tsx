import { renderHook, act } from "@testing-library/react";
import { useFlappyBird } from "../hooks/useFlappyBird";

describe("useFlappyBird", () => {
  it("should start in idle phase", () => {
    const { result } = renderHook(() => useFlappyBird());
    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.score).toBe(0);
  });

  it("should transition to playing on first flap", () => {
    const { result } = renderHook(() => useFlappyBird());
    act(() => {
      result.current.flap();
    });
    expect(result.current.state.phase).toBe("playing");
  });

  it("should reset game state after gameover and restart", () => {
    const { result } = renderHook(() => useFlappyBird());

    // Start game
    act(() => {
      result.current.startGame();
    });
    expect(result.current.state.phase).toBe("playing");

    // Game over - preserve high score
    act(() => {
      result.current.resetGame();
    });
    expect(result.current.state.phase).toBe("idle");
  });
});

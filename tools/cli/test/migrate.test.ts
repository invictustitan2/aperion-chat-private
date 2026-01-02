import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("child_process", () => {
  return {
    spawn: vi.fn(),
  };
});

vi.mock("inquirer", () => {
  return {
    default: {
      prompt: vi.fn(),
    },
  };
});

vi.mock("chalk", () => {
  const passthrough = (input: string) => input;
  return {
    default: {
      blue: passthrough,
      green: passthrough,
      yellow: passthrough,
      red: passthrough,
    },
  };
});

describe("migrate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels when not confirmed", async () => {
    const { default: inquirer } = await import("inquirer");
    const { spawn } = await import("child_process");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: false } as never);

    const { migrate } = await import("../src/commands/migrate");
    await migrate({});

    expect(inquirer.prompt).toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Migration cancelled.");
  });

  it("spawns wrangler when confirmed (prompt)", async () => {
    const { default: inquirer } = await import("inquirer");
    const { spawn } = await import("child_process");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    let closeHandler: ((code: number) => void) | undefined;
    vi.mocked(spawn).mockReturnValue({
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === "close") closeHandler = cb;
      }),
    } as unknown as ReturnType<typeof spawn>);

    vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true } as never);

    const { migrate } = await import("../src/commands/migrate");
    await migrate({});

    expect(spawn).toHaveBeenCalledWith(
      "npx",
      ["wrangler", "d1", "migrations", "apply", "aperion-db", "--remote"],
      expect.objectContaining({
        cwd: "../../apps/api-worker",
        stdio: "inherit",
        shell: true,
      }),
    );

    closeHandler?.(0);
    expect(logSpy).toHaveBeenCalledWith("✓ Migrations applied successfully.");
  });

  it("spawns wrangler and exits on failure (confirm option)", async () => {
    const { default: inquirer } = await import("inquirer");
    const { spawn } = await import("child_process");

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as unknown as typeof process.exit);
    vi.spyOn(console, "error").mockImplementation(() => {});

    let closeHandler: ((code: number) => void) | undefined;
    vi.mocked(spawn).mockReturnValue({
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === "close") closeHandler = cb;
      }),
    } as unknown as ReturnType<typeof spawn>);

    const { migrate } = await import("../src/commands/migrate");
    await migrate({ confirm: true });

    expect(inquirer.prompt).not.toHaveBeenCalled();

    closeHandler?.(2);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

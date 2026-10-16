export function launchIsActive(status?: string): boolean {
  return Boolean(status) && ![
    "not-submitted", "needs-funding", "needs-attention", "pons-complete",
    "ethereum-complete", "launched",
  ].includes(status!);
}

export function nextLaunchLeg(ethereumConfirmed: boolean, robinhoodConfirmed: boolean) {
  if (!ethereumConfirmed) return "ethereum" as const;
  return robinhoodConfirmed ? null : "robinhood" as const;
}

export function launchPauseMessage(ethereumComplete: boolean) {
  return ethereumComplete
    ? "Ethereum launch complete. Click Resume to continue on Robinhood. Completed transactions will not be repeated."
    : "The Ethereum launch needs another check. Click Resume to continue from its saved progress. Completed transactions will not be repeated.";
}

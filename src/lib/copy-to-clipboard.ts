type ClipboardEnvironment = {
  clipboard?: Pick<Clipboard, "writeText"> | null;
  document?: Document | null;
};

function hasOwn(environment: ClipboardEnvironment, key: keyof ClipboardEnvironment) {
  return Object.prototype.hasOwnProperty.call(environment, key);
}

export async function copyTextToClipboard(
  value: string,
  environment?: ClipboardEnvironment,
): Promise<void> {
  const clipboard = environment && hasOwn(environment, "clipboard")
    ? environment.clipboard
    : typeof navigator !== "undefined"
      ? navigator.clipboard
      : undefined;

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the synchronous selection-based copy for restricted browsers.
    }
  }

  const doc = environment && hasOwn(environment, "document")
    ? environment.document
    : typeof document !== "undefined"
      ? document
      : undefined;
  if (!doc?.body || typeof doc.execCommand !== "function") {
    throw new Error("Copy failed. Select the displayed text and copy it manually.");
  }

  const field = doc.createElement("textarea");
  field.value = value;
  field.readOnly = true;
  field.tabIndex = -1;
  field.setAttribute("aria-hidden", "true");
  Object.assign(field.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "1px",
    height: "1px",
    padding: "0",
    border: "0",
    opacity: "0",
    fontSize: "16px",
    zIndex: "-1",
  });

  doc.body.appendChild(field);
  let copied = false;
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, value.length);
    copied = doc.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    field.remove();
  }

  if (!copied) {
    throw new Error("Copy failed. Select the displayed text and copy it manually.");
  }
}

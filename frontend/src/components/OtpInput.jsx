import { useRef } from "react";

export default function OtpInput({ value, onChange, id = "otp", label = "One-time code" }) {
  const inputs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || "");

  const updateDigit = (index, nextValue) => {
    const digit = nextValue.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    onChange(next.join(""));
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  };

  const pasteCode = (event, index) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    const next = [...digits];
    pasted.slice(0, 6 - index).split("").forEach((digit, offset) => { next[index + offset] = digit; });
    onChange(next.join(""));
    inputs.current[Math.min(index + pasted.length, 5)]?.focus();
  };

  return <div className="otp-inputs" role="group" aria-label={label}>
    {digits.map((digit, index) => <input
      key={index}
      ref={(node) => { inputs.current[index] = node; }}
      id={`${id}-${index + 1}`}
      aria-label={`Digit ${index + 1} of 6`}
      type="text"
      inputMode="numeric"
      autoComplete={index === 0 ? "one-time-code" : "off"}
      pattern="[0-9]"
      maxLength={1}
      required
      value={digit}
      onChange={(event) => updateDigit(index, event.target.value)}
      onPaste={(event) => pasteCode(event, index)}
      onKeyDown={(event) => {
        if (event.key === "Backspace" && !digit && index > 0) inputs.current[index - 1]?.focus();
        if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
        if (event.key === "ArrowRight" && index < 5) inputs.current[index + 1]?.focus();
      }}
    />)}
  </div>;
}

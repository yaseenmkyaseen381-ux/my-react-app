import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { googleLogin } from "../api";
import { saveSession } from "../authSession";

const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";

function createNonce() {
  return Array.from(window.crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function GoogleAuthButton({ mode = "login" }) {
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (!clientId) {
      setError("Google sign-in needs VITE_GOOGLE_CLIENT_ID in frontend/.env and GOOGLE_CLIENT_ID in backend/.env.");
      return undefined;
    }

    let active = true;
    let script = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`);
    const renderButton = () => {
      if (!active || !window.google?.accounts?.id || !buttonRef.current) return;
      const nonce = createNonce();
      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce,
        callback: async (response) => {
          if (!active) return;
          setLoading(true);
          setError("");
          try {
            const result = await googleLogin({ credential: response.credential, nonce, mode });
            saveSession("user", result.token, result.user);
            navigate("/home", { replace: true });
          } catch (requestError) {
            if (requestError.code === "ACCOUNT_NOT_FOUND" && mode === "login") {
              navigate("/signup", { state: { email: requestError.details?.email || "", message: "No account was found for that Google email. Create your account to continue." } });
              return;
            }
            setError(requestError.message || "Google sign-in failed. Please try again.");
          } finally { setLoading(false); }
        },
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard", theme: "outline", size: "large", shape: "rectangular",
        text: "continue_with", logo_alignment: "left", width: Math.min(360, Math.floor(buttonRef.current.clientWidth || 320)),
      });
    };
    const onScriptError = () => { if (active) setError("Google sign-in could not load. Check your connection and try again."); };

    if (window.google?.accounts?.id) renderButton();
    else {
      if (!script) {
        script = document.createElement("script");
        script.src = GOOGLE_SCRIPT;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderButton);
      script.addEventListener("error", onScriptError);
    }

    return () => {
      active = false;
      script?.removeEventListener("load", renderButton);
      script?.removeEventListener("error", onScriptError);
      buttonRef.current?.replaceChildren();
    };
  }, [clientId, navigate, mode]);

  return <div className="google-auth-wrap">
    {loading ? <div className="google-loading" role="status">Signing in with Google…</div> : <div className="google-signin-slot" ref={buttonRef} />}
    {error && <p className="google-auth-error" role="alert">{error}</p>}
  </div>;
}

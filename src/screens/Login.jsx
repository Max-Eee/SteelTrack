import React, { useState } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "../components/ui/input-otp";
import { Button } from "../components/ui/button";
import { loginUser } from "../lib/auth";

const Login = ({ onLoginSuccess }) => {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (code.length !== 6) {
      setError("Please enter the complete code");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await loginUser(code);

      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.error || "Invalid access code");
      }
    } catch (error) {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-2xl">
              <InputOTP
                value={code}
                onChange={setCode}
                maxLength={6}
                className="w-full"
                mask
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot
                    index={0}
                    className="border-white/30 bg-white/5 text-white text-xl font-bold backdrop-blur-sm"
                  />
                  <InputOTPSlot
                    index={1}
                    className="border-white/30 bg-white/5 text-white text-xl font-bold backdrop-blur-sm"
                  />
                  <InputOTPSlot
                    index={2}
                    className="border-white/30 bg-white/5 text-white text-xl font-bold backdrop-blur-sm"
                  />
                </InputOTPGroup>
                <InputOTPSeparator className="text-white/60" />
                <InputOTPGroup>
                  <InputOTPSlot
                    index={3}
                    className="border-white/30 bg-white/5 text-white text-xl font-bold backdrop-blur-sm"
                  />
                  <InputOTPSlot
                    index={4}
                    className="border-white/30 bg-white/5 text-white text-xl font-bold backdrop-blur-sm"
                  />
                  <InputOTPSlot
                    index={5}
                    className="border-white/30 bg-white/5 text-white text-xl font-bold backdrop-blur-sm"
                  />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {error && (
              <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-lg p-3 text-red-100 text-sm text-center shadow-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="w-full bg-white/90 text-black hover:bg-white hover:scale-105 transition-all duration-200 backdrop-blur-sm shadow-xl border border-white/20 font-semibold py-3 text-lg"
            >
              {isLoading ? "Verifying..." : "Enter"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

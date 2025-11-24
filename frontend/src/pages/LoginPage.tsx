import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Phone, Mail } from "lucide-react";
import orderIllustration from "../../order.svg?url";

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      console.error("Login error:", err);
      console.error("Error response:", err.response);
      console.error("Error message:", err.message);
      
      // More detailed error message
      if (err.response) {
        setError(err.response.data?.detail || "Invalid credentials. Please try again.");
      } else if (err.request) {
        setError("Cannot connect to server. Please ensure the backend is running.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Dark Gradient with Illustration - Hidden on mobile */}
      <div className="relative hidden w-1/2 flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-primary via-slate-900 to-primary-dark px-8 py-8 md:px-12 md:py-10 lg:flex xl:px-16 xl:py-12">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
          <div className="absolute right-1/4 bottom-1/3 h-80 w-80 rounded-full bg-secondary-light/10 blur-3xl" />
        </div>

        {/* Logo/Brand */}
        <div className="relative z-10 flex items-center gap-3 self-start">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/20 backdrop-blur border border-secondary/30">
            <img src={orderIllustration} alt="ProcuraHub" className="h-7 w-7 object-contain brightness-0 invert" />
          </div>
          <span className="text-2xl font-bold text-white">ProcuraHub</span>
        </div>

        {/* Welcome Message */}
        <div className="relative z-10 flex flex-col items-center max-w-lg text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            Welcome to<br/>ProcuraHub
          </h1>
          <p className="text-base lg:text-lg text-slate-300 leading-relaxed">
            Streamline your procurement process with intelligent RFQ management, 
            automated supplier invitations, real-time quote tracking, and seamless 
            purchase order workflows—all in one powerful platform.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10 w-full">
          <p className="text-xs lg:text-sm text-slate-400">
            Copyright © {new Date().getFullYear()}, ProcuraHub. All rights reserved
          </p>
        </div>
      </div>

      {/* Right Side - Mobile: Full screen with gradient overlay, Desktop: White */}
      <div className="relative flex w-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-white px-4 py-8 sm:px-6 sm:py-12 lg:w-1/2 lg:px-8">
        {/* Mobile: Gradient overlay background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary to-slate-900 lg:hidden">
          {/* Decorative circles for mobile */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/4 top-1/4 h-48 w-48 rounded-full bg-secondary/20 blur-3xl" />
            <div className="absolute right-1/4 bottom-1/3 h-64 w-64 rounded-full bg-secondary-light/10 blur-3xl" />
          </div>
        </div>

        {/* Mobile: Logo at top */}
        <div className="relative z-10 mb-6 flex items-center gap-2 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/30 backdrop-blur border border-secondary/40">
            <img src={orderIllustration} alt="ProcuraHub" className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          <span className="text-xl font-bold text-white">ProcuraHub</span>
        </div>

        {/* Welcome Message - Mobile only */}
        <div className="relative z-10 mb-8 text-center lg:hidden px-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
            Welcome Back
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-sm mx-auto">
            Sign in to manage your procurement operations efficiently
          </p>
        </div>

        {/* Login Card */}
        <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl shadow-slate-900/20 lg:shadow-slate-900/10">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-2">Sign In</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Enter your credentials to access ProcuraHub
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <input
                id="email"
                type="email"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 sm:py-3.5 text-sm text-slate-700 placeholder-slate-400 transition focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <input
                id="password"
                type="password"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 sm:py-3.5 text-sm text-slate-700 placeholder-slate-400 transition focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-gradient-to-r from-secondary to-secondary-dark px-4 py-3 sm:py-3.5 text-sm font-semibold text-white shadow-lg shadow-secondary/30 transition hover:shadow-xl hover:shadow-secondary/40 disabled:cursor-not-allowed disabled:opacity-75"
            >
              {isSubmitting ? "Please wait..." : "Sign In"}
            </button>
          </form>

          {/* Additional Info */}
          <div className="mt-5 sm:mt-6 text-center">
            <p className="text-xs sm:text-sm text-slate-600">
              Need access? <span className="font-semibold text-secondary">Contact your administrator</span>
            </p>
          </div>

          {/* Contact Info */}
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              <span>9999878787</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              <span>info@procurahub.io</span>
            </div>
          </div>
        </div>

        {/* Mobile: Footer */}
        <div className="relative z-10 mt-8 text-center lg:hidden">
          <p className="text-xs text-slate-300">
            Copyright © {new Date().getFullYear()}, ProcuraHub. All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

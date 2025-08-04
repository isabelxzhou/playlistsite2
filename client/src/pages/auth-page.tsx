import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ParticleBackground from "@/components/particle-background";

export default function AuthPage() {
  const [password, setPassword] = useState("");
  const { loginMutation, user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Determine username based on password
    let username = "viewer";
    if (password === "mathrock") {
      username = "admin";
    }
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen text-white">
      <ParticleBackground />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="glass-effect rounded-2xl p-8 max-w-sm w-full mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-6">
              who are you
            </h1>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-effect border-white/20 focus:border-blue-400 text-white placeholder-gray-400 text-center"
                placeholder="password"
                required
              />

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium py-3 transition-all duration-300"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "..." : "enter"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
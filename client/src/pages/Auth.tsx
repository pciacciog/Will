import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Shield, Eye, EyeOff, Handshake, Pencil, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MobileLayout } from "@/components/ui/design-system";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['/api/user'], user);
      setLocation('/');
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string; firstName: string; lastName: string }) => {
      const res = await apiRequest('/api/register', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['/api/user'], user);
      setLocation('/');
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Unable to create account",
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    loginMutation.mutate({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    });
  };

  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    if (password !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    registerMutation.mutate({
      email: formData.get('email') as string,
      password: password,
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
    });
  };

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-green-50" style={{ touchAction: 'none' }}>
      {/* Content Area with Back Button Inside */}
      <div className="h-full overflow-hidden flex flex-col pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] px-4" style={{ overscrollBehavior: 'none' }}>
        {/* Back Button positioned in shaded area */}
        <div className="flex justify-start mb-4">
          <Link href="/">
            <button className="p-2 rounded-lg bg-white/80 shadow-sm hover:bg-white hover:shadow-md transition-all duration-200 backdrop-blur-sm">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </button>
          </Link>
        </div>
          
          <div className="max-w-sm mx-auto flex flex-col">
          {/* Header & Icon */}
          <div className="text-center mb-3">
            <div className="bg-blue-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">Join Your Inner Circle</h1>
            <p className="text-base text-gray-500 leading-snug">Connect with the people who matter. Grow together.</p>
          </div>

          {/* Step Descriptions */}
          <div className="space-y-1 mb-3">
            <div className="flex items-start space-x-2">
              <div className="bg-blue-100 p-1 rounded-full shadow-sm">
                <Handshake className="w-3 h-3 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Form Your Circle</p>
                <p className="text-gray-500 text-sm">Start or join a group of 2–4 close friends.</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="bg-green-100 p-1 rounded-full shadow-sm">
                <Pencil className="w-3 h-3 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Set Your <em>Will</em></p>
                <p className="text-gray-500 text-sm">Make a commitment.</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="bg-purple-100 p-1 rounded-full shadow-sm">
                <TrendingUp className="w-3 h-3 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Stay Accountable</p>
                <p className="text-gray-500 text-sm">Support each other daily.</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="w-full">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="flex border rounded-xl overflow-hidden text-center w-full bg-gray-50 mx-auto mb-3 py-2">
                <TabsTrigger 
                  value="login" 
                  className="w-1/2 py-1 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-gray-700 data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600 border-r border-gray-200 flex justify-center items-center"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  className="w-1/2 py-1 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-gray-700 data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600 flex justify-center items-center"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0.5 space-y-3">
                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <Label htmlFor="login-email" className="text-xs font-medium">Email</Label>
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                      className="w-full px-3 py-1.5 border rounded-xl text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password" className="text-xs font-medium">Password</Label>
                    <div className="relative mt-0.5">
                      <Input
                        id="login-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        required
                        className="w-full px-3 py-1.5 border rounded-xl text-xs pr-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 text-white py-1.5 rounded-xl text-xs font-medium hover:bg-blue-700 transition"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Signing in..." : "Sign In"}
                    </Button>
                  </div>
                </form>
                
                {/* Privacy Notice - Inline within form */}
                <div className="text-center pt-0.5">
                  <p className="text-xs text-gray-400 font-light">
                    By continuing, you agree to our commitment to your privacy and security.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="register" className="mt-0.5 space-y-3">
                <form onSubmit={handleRegister} className="space-y-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <Label htmlFor="register-firstName" className="text-xs font-medium">First Name</Label>
                      <Input
                        id="register-firstName"
                        name="firstName"
                        type="text"
                        placeholder="First name"
                        required
                        className="w-full px-2 py-1 border rounded-xl text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="register-lastName" className="text-xs font-medium">Last Name</Label>
                      <Input
                        id="register-lastName"
                        name="lastName"
                        type="text"
                        placeholder="Last name"
                        required
                        className="w-full px-2 py-1 border rounded-xl text-xs mt-0.5"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="register-email" className="text-xs font-medium">Email</Label>
                    <Input
                      id="register-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                      className="w-full px-2 py-1 border rounded-xl text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password" className="text-xs font-medium">Password</Label>
                    <div className="relative mt-0.5">
                      <Input
                        id="register-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        required
                        className="w-full px-2 py-1 border rounded-xl text-xs pr-6"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-2.5 w-2.5" />
                        ) : (
                          <Eye className="h-2.5 w-2.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="register-confirmPassword" className="text-xs font-medium">Confirm Password</Label>
                    <div className="relative mt-0.5">
                      <Input
                        id="register-confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        required
                        className="w-full px-2 py-1 border rounded-xl text-xs pr-6"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-2.5 w-2.5" />
                        ) : (
                          <Eye className="h-2.5 w-2.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 text-white py-1.5 rounded-xl text-xs font-medium hover:bg-blue-700 transition"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Creating account..." : "Create Account"}
                    </Button>
                  </div>
                </form>
                
                {/* Privacy Notice - Inline within form */}
                <div className="text-center pt-0.5">
                  <p className="text-xs text-gray-400 font-light">
                    By continuing, you agree to our commitment to your privacy and security.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
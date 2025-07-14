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
    <MobileLayout scrollable={false}>
      <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-blue-50 via-white to-green-50">
        {/* Fixed Header with Back Button */}
        <div className="fixed top-0 left-0 right-0 z-20 pt-[env(safe-area-inset-top)] pb-2 bg-gradient-to-br from-blue-50 via-white to-green-50">
          <div className="flex justify-start px-4 pt-4">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-gray-100 transition">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
            </Link>
          </div>
        </div>

        {/* Non-scrollable Content Area */}
        <div className="flex-1 overflow-hidden pt-[calc(env(safe-area-inset-top)+4rem)] pb-[env(safe-area-inset-bottom)] px-4">
          <div className="max-w-sm mx-auto h-full flex flex-col justify-center space-y-2">
          {/* Header & Icon */}
          <div className="text-center space-y-1 mb-1">
            <div className="bg-violet-100 p-1.5 rounded-full w-8 h-8 flex items-center justify-center mx-auto">
              <Shield className="w-4 h-4 text-violet-500" />
            </div>
            <h1 className="text-lg font-semibold">Join Your Inner Circle</h1>
            <p className="text-xs text-gray-500">Connect with the people who matter. Grow together.</p>
          </div>

          {/* Step Descriptions */}
          <div className="space-y-1 mb-1">
            <div className="flex items-start space-x-2">
              <div className="bg-blue-100 p-1.5 rounded-full shadow-sm">
                <Handshake className="w-3 h-3 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Form Your Circle</p>
                <p className="text-xs text-gray-500">Start or join a group of 2–4 close friends.</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="bg-green-100 p-1.5 rounded-full shadow-sm">
                <Pencil className="w-3 h-3 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Set Your <em>Will</em></p>
                <p className="text-xs text-gray-500">Make a commitment.</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="bg-purple-100 p-1.5 rounded-full shadow-sm">
                <TrendingUp className="w-3 h-3 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Stay Accountable</p>
                <p className="text-xs text-gray-500">Support each other daily.</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="w-full">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="flex border rounded-xl overflow-hidden text-center w-full bg-gray-50 mx-auto">
                <TabsTrigger 
                  value="login" 
                  className="w-1/2 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-700 data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600 border-r border-gray-200 flex justify-center items-center"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  className="w-1/2 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-700 data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600 flex justify-center items-center"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-1 space-y-1.5">
                <form onSubmit={handleLogin} className="space-y-1.5">
                  <div>
                    <Label htmlFor="login-email" className="text-xs font-medium">Email</Label>
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                      className="w-full px-3 py-1.5 border rounded-xl text-sm mt-0.5"
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
                        className="w-full px-3 py-1.5 border rounded-xl text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
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
                  <Button 
                    type="submit" 
                    className="w-full bg-violet-600 text-white py-1.5 rounded-xl font-medium hover:bg-violet-700 transition"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
                
                {/* Privacy Notice - Inline within form */}
                <div className="text-center pt-0.5">
                  <p className="text-xs text-gray-400 font-light">
                    By continuing, you agree to our commitment to your privacy and security.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="register" className="mt-1 space-y-1">
                <form onSubmit={handleRegister} className="space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="register-firstName" className="text-xs font-medium">First Name</Label>
                      <Input
                        id="register-firstName"
                        name="firstName"
                        type="text"
                        placeholder="First name"
                        required
                        className="w-full px-3 py-1.5 border rounded-xl text-sm mt-0.5"
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
                        className="w-full px-3 py-1.5 border rounded-xl text-sm mt-0.5"
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
                      className="w-full px-3 py-1.5 border rounded-xl text-sm mt-0.5"
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
                        className="w-full px-3 py-1.5 border rounded-xl text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
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
                  <div>
                    <Label htmlFor="register-confirmPassword" className="text-xs font-medium">Confirm Password</Label>
                    <div className="relative mt-0.5">
                      <Input
                        id="register-confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        required
                        className="w-full px-3 py-1.5 border rounded-xl text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-violet-600 text-white py-1.5 rounded-xl font-medium hover:bg-violet-700 transition"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "Creating account..." : "Create Account"}
                  </Button>
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
    </MobileLayout>
  );
}
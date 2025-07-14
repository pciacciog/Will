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
      <div className="h-screen overflow-hidden flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] px-4 bg-gradient-to-br from-blue-50 via-white to-green-50">
        {/* Back Button */}
        <div className="absolute top-[calc(env(safe-area-inset-top)+1rem)] left-4 z-10">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-gray-100 transition">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          </Link>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col justify-center space-y-3 max-w-sm mx-auto w-full pt-16">
          {/* Header & Icon */}
          <div className="text-center space-y-1 mb-2">
            <div className="bg-violet-100 p-2 rounded-full w-10 h-10 flex items-center justify-center mx-auto">
              <Shield className="w-5 h-5 text-violet-500" />
            </div>
            <h1 className="text-xl font-semibold">Join Your Inner Circle</h1>
            <p className="text-sm text-gray-500">Connect with the people who matter. Grow together.</p>
          </div>

          {/* Step Descriptions */}
          <div className="space-y-1.5 mb-2">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 p-2 rounded-full shadow-sm">
                <Handshake className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">Form Your Circle</p>
                <p className="text-sm text-gray-500">Start or join a group of 2–4 close friends.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-green-100 p-2 rounded-full shadow-sm">
                <Pencil className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">Set Your <em>Will</em></p>
                <p className="text-sm text-gray-500">Make a commitment.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-purple-100 p-2 rounded-full shadow-sm">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">Stay Accountable</p>
                <p className="text-sm text-gray-500">Support each other daily.</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="w-full">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="flex border rounded-xl overflow-hidden text-center w-full bg-gray-50 mx-auto">
                <TabsTrigger 
                  value="login" 
                  className="w-1/2 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-700 data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600 border-r border-gray-200 flex justify-center items-center"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  className="w-1/2 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-700 data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600 flex justify-center items-center"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-2 space-y-2">
                <form onSubmit={handleLogin} className="space-y-2">
                  <div>
                    <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                      className="w-full px-4 py-2 border rounded-xl text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="login-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        required
                        className="w-full px-4 py-2 border rounded-xl text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-violet-600 text-white py-2 rounded-xl font-medium hover:bg-violet-700 transition"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
                
                {/* Privacy Notice - Inline within form */}
                <div className="text-center pt-1">
                  <p className="text-xs text-gray-400 font-light">
                    By continuing, you agree to our commitment to your privacy and security.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="register" className="mt-2 space-y-2">
                <form onSubmit={handleRegister} className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="register-firstName" className="text-sm font-medium">First Name</Label>
                      <Input
                        id="register-firstName"
                        name="firstName"
                        type="text"
                        placeholder="First name"
                        required
                        className="w-full px-4 py-2 border rounded-xl text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="register-lastName" className="text-sm font-medium">Last Name</Label>
                      <Input
                        id="register-lastName"
                        name="lastName"
                        type="text"
                        placeholder="Last name"
                        required
                        className="w-full px-4 py-2 border rounded-xl text-sm mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="register-email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="register-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                      className="w-full px-4 py-2 border rounded-xl text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password" className="text-sm font-medium">Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="register-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        required
                        className="w-full px-4 py-2 border rounded-xl text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="register-confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="register-confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        required
                        className="w-full px-4 py-2 border rounded-xl text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-violet-600 text-white py-2 rounded-xl font-medium hover:bg-violet-700 transition"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
                
                {/* Privacy Notice - Inline within form */}
                <div className="text-center pt-1">
                  <p className="text-xs text-gray-400 font-light">
                    By continuing, you agree to our commitment to your privacy and security.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
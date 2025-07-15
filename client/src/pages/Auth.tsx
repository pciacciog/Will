import { useState } from "react";
import SplashScreen from "@/components/SplashScreen";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Hand, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MobileLayout } from "@/components/ui/design-system";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Remove splash screen functionality

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      return await res.json();
    },
    onSuccess: (user) => {
      console.log('Login success, user:', user);
      queryClient.setQueryData(['/api/user'], user);
      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      // Set a flag to show splash screen on first Home load
      localStorage.setItem('showSplashOnHome', 'true');
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
      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      // Set a flag to show splash screen on first Home load
      localStorage.setItem('showSplashOnHome', 'true');
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
    const credentials = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };
    console.log('Submitting login:', credentials);
    loginMutation.mutate(credentials);
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

  // Splash screen is now handled by Home component

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
          
          <div className="max-w-sm mx-auto flex flex-col -mt-4">
          {/* Header & Icon */}
          <div className="text-center mb-2">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-3 rounded-2xl w-14 h-14 flex items-center justify-center mx-auto mb-2 shadow-lg">
              <Hand className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">WILL</h1>
          </div>

          {/* Content Section - Elevated */}
          <div className="-mt-6">
            <p className="text-base text-gray-500 leading-snug text-center mb-6">Become who you're meant to be. <span className="font-semibold text-gray-700 italic">Together.</span></p>

          {/* Tabs - Enhanced Design */}
          <div className="w-full">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="flex border rounded-2xl overflow-hidden text-center w-full bg-gradient-to-r from-gray-50 to-gray-100 mx-auto mb-4 py-2 shadow-inner">
                <TabsTrigger 
                  value="login" 
                  className="w-1/2 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-lg data-[state=active]:transform data-[state=active]:scale-105 data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600 border-r border-gray-200 flex justify-center items-center transition-all duration-200"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  className="w-1/2 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-lg data-[state=active]:transform data-[state=active]:scale-105 data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600 flex justify-center items-center transition-all duration-200"
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
    </div>
  );
}
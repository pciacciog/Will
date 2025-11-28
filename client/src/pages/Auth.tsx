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
import { sessionPersistence } from "@/services/SessionPersistence";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Remove splash screen functionality

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      // 🔥 CRITICAL: Send device token with login request for immediate ownership transfer
      const deviceTokenData = localStorage.getItem('pendingDeviceToken');
      let deviceToken = null;
      
      console.log(`🔍 [Login] Checking for stored device token...`);
      console.log(`🔍 [Login] Raw localStorage data:`, deviceTokenData);
      
      if (deviceTokenData) {
        try {
          const tokenInfo = JSON.parse(deviceTokenData);
          deviceToken = tokenInfo.token;
          console.log(`📱 [Login] Sending device token with login: ${deviceToken?.substring(0, 8)}...`);
          console.log(`🔍 [Login] Full token info:`, tokenInfo);
        } catch (error) {
          console.warn('Failed to parse stored device token:', error);
        }
      } else {
        console.log(`⚠️ [Login] No device token found in localStorage`);
      }
      
      const loginPayload = {
        ...credentials,
        deviceToken // Send device token for immediate ownership transfer
      };
      
      const res = await apiRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify(loginPayload),
        headers: deviceToken ? {
          'X-Device-Token': deviceToken // Also send in headers for redundancy
        } : undefined
      });
      return await res.json();
    },
    onSuccess: async (user) => {
      console.log('Login success, user:', user);
      
      // Save JWT token for mobile auth persistence
      if (user.token) {
        await sessionPersistence.saveToken(user.token);
        console.log('✅ [Login] JWT token saved to persistent storage');
      }
      
      queryClient.setQueryData(['/api/user'], user);
      
      // 🔥 NEW: Token ownership already transferred by login endpoint
      // Clear the pending token since it's now owned by the user
      const deviceTokenData = localStorage.getItem('pendingDeviceToken');
      if (deviceTokenData) {
        localStorage.removeItem('pendingDeviceToken');
        console.log('✅ [Login] Cleared pending device token - ownership transferred to user');
      }
      
      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      // Set a flag to show splash screen on first Home load
      console.log('Setting showSplashOnHome to true in localStorage');
      localStorage.setItem('showSplashOnHome', 'true');
      // Redirect to home page
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
      // ISSUE #2 FIX: Send device token with registration request for immediate ownership transfer
      const deviceTokenData = localStorage.getItem('pendingDeviceToken');
      let deviceToken = null;
      
      console.log(`🔍 [Registration] Checking for stored device token...`);
      console.log(`🔍 [Registration] Raw localStorage data:`, deviceTokenData);
      
      if (deviceTokenData) {
        try {
          const tokenInfo = JSON.parse(deviceTokenData);
          deviceToken = tokenInfo.token;
          console.log(`📱 [Registration] Sending device token with registration: ${deviceToken?.substring(0, 8)}...`);
          console.log(`🔍 [Registration] Full token info:`, tokenInfo);
        } catch (error) {
          console.warn('Failed to parse stored device token:', error);
        }
      } else {
        console.log(`⚠️ [Registration] No device token found in localStorage`);
      }
      
      // TIMEZONE FIX: Detect user's timezone on signup
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log(`🌍 [Registration] Detected timezone: ${userTimezone}`);
      
      const registerPayload = {
        ...credentials,
        timezone: userTimezone, // Send timezone for storage
        deviceToken // Send device token for immediate ownership transfer
      };
      
      const res = await apiRequest('/api/register', {
        method: 'POST',
        body: JSON.stringify(registerPayload),
        headers: deviceToken ? {
          'X-Device-Token': deviceToken // Also send in headers for redundancy
        } : undefined
      });
      return await res.json();
    },
    onSuccess: async (user) => {
      console.log('Registration success, user:', user);
      
      // Save JWT token for mobile auth persistence
      if (user.token) {
        await sessionPersistence.saveToken(user.token);
        console.log('✅ [Registration] JWT token saved to persistent storage');
      }
      
      queryClient.setQueryData(['/api/user'], user);
      
      // Send pending device token now that user is authenticated
      try {
        const { sendPendingDeviceToken } = await import('../services/NotificationService');
        const tokenSent = await sendPendingDeviceToken();
        if (tokenSent) {
          console.log('📱 Device token successfully linked to new user account');
        }
      } catch (error) {
        console.error('Failed to send pending device token:', error);
      }
      
      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      // Set a flag to show splash screen on first Home load
      console.log('Setting showSplashOnHome to true in localStorage');
      localStorage.setItem('showSplashOnHome', 'true');
      // Redirect to home page
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
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/30" style={{ touchAction: 'none' }}>
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-emerald-200/40 to-teal-300/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-indigo-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-gradient-to-br from-teal-100/40 to-emerald-200/30 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      {/* Content Area with Back Button Inside */}
      <div className="relative h-full overflow-hidden flex flex-col pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] px-4" style={{ overscrollBehavior: 'none' }}>
        {/* Back Button positioned in shaded area */}
        <div className="flex justify-start mb-4">
          <Link href="/">
            <button className="p-2 rounded-xl bg-white/70 shadow-md hover:bg-white hover:shadow-lg transition-all duration-300 backdrop-blur-sm border border-white/50">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </button>
          </Link>
        </div>
          
          <div className="max-w-sm mx-auto flex flex-col">
          {/* Header & Icon with Glowy Effect */}
          <div className="text-center mb-2 md:mb-4">
            <div className="relative inline-block">
              {/* Glow effect behind icon */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl blur-xl opacity-40 animate-pulse scale-110"></div>
              <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-2xl w-14 h-14 flex items-center justify-center mx-auto mb-2 md:mb-3 shadow-xl shadow-emerald-500/25">
                <Hand className="w-7 h-7 text-white" />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight mb-1 md:mb-2">WILL</h1>
            <p className="text-sm text-gray-500 leading-snug text-center mb-4 md:mb-6">Become who you're meant to be. <span className="font-semibold text-gray-700 italic">Together.</span></p>
          </div>

          {/* Content Section */}
          <div>

          {/* Tabs - Glowy Enhanced Design */}
          <div className="w-full">
            <div className="relative">
              {/* Subtle glow behind tabs */}
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-200/30 via-teal-200/20 to-blue-200/30 rounded-3xl blur-lg opacity-60"></div>
              <Tabs defaultValue="login" className="relative w-full">
                <TabsList className="flex border border-white/60 rounded-2xl overflow-hidden text-center w-full bg-white/80 backdrop-blur-sm mx-auto mb-4 py-2 shadow-lg">
                  <TabsTrigger 
                    value="login" 
                    className="w-1/2 py-2 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/25 data-[state=active]:transform data-[state=active]:scale-105 data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600 border-r border-gray-200/50 flex justify-center items-center transition-all duration-300 rounded-xl mx-1"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger 
                    value="register" 
                    className="w-1/2 py-2 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/25 data-[state=active]:transform data-[state=active]:scale-105 data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600 flex justify-center items-center transition-all duration-300 rounded-xl mx-1"
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
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2 rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02]"
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
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2 rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02]"
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
    </div>
  );
}
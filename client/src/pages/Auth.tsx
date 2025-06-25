import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Shield, Users, Target } from "lucide-react";

export default function Auth() {
  const handleSignIn = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Back Button */}
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        {/* Main Auth Card */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-indigo-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Join Your Inner Circle
            </CardTitle>
            <CardDescription className="text-gray-600">
              Connect with your accountability partners and achieve your goals together
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Features Preview */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Form Your Circle</h3>
                  <p className="text-sm text-gray-600">Create or join intimate groups of 2-4 people</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Target className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Set Your Will</h3>
                  <p className="text-sm text-gray-600">Create meaningful commitments with your circle's support</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Stay Accountable</h3>
                  <p className="text-sm text-gray-600">Track progress and support each other daily</p>
                </div>
              </div>
            </div>

            {/* Sign In Button */}
            <div className="pt-4">
              <Button 
                onClick={handleSignIn}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 text-base"
                size="lg"
              >
                Continue with Replit
              </Button>
            </div>

            {/* Privacy Notice */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                By continuing, you agree to our commitment to your privacy and security. 
                We use secure authentication to protect your personal information.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            New to accountability circles? 
            <Link href="/" className="text-indigo-600 hover:text-indigo-700 font-medium ml-1">
              Learn more
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
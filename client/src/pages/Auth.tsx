import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Shield, Users, Target } from "lucide-react";

export default function Auth() {
  const handleLogin = () => {
    // Redirect to Replit's authentication endpoint
    window.location.href = '/api/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Back to Landing */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Inner Circle</h1>
                <p className="text-gray-600">
                  Connect with your accountability partners and achieve your goals together
                </p>
              </div>

              {/* Features Preview */}
              <div className="space-y-4 mb-8">
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

              {/* Login Button */}
              <Button 
                onClick={handleLogin}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3"
                size="lg"
              >
                Continue with Replit
              </Button>

              <p className="text-xs text-gray-500 text-center mt-4">
                By continuing, you agree to our terms of service and privacy policy
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
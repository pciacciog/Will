import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Handshake, Pencil, TrendingUp } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-md mx-auto px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] h-screen flex flex-col justify-center space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-3xl flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight leading-tight">
            A space to <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">grow</span><br />
            with your people
          </h1>
          
          <p className="text-base text-gray-500 leading-snug">
            Join forces with up to 3 friends. Set meaningful goals together. 
            Hold each other accountable. Celebrate every victory as one.
          </p>
          
          <div className="mt-6">
            <Link href="/auth">
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl shadow-md transition"
              >
                Start Your Journey →
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Step Flow Cards */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center space-x-4">
            <div className="bg-blue-100 p-2 rounded-full shadow-sm">
              <Handshake className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Build Your Inner Circle</h3>
              <p className="text-gray-500 text-sm">Invite the people who matter most.</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center space-x-4">
            <div className="bg-green-100 p-2 rounded-full shadow-sm">
              <Pencil className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Create Your <em>Will</em></h3>
              <p className="text-gray-500 text-sm">Define what you will do.</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center space-x-4">
            <div className="bg-purple-100 p-2 rounded-full shadow-sm">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Go to Work</h3>
              <p className="text-gray-500 text-sm">Share in the struggle.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

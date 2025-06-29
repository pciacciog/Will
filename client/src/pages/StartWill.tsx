import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { createDateTimeFromInputs } from "@/lib/dateUtils";

// Helper function to calculate next Monday at 12:00 AM
function getNextMondayStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days until next Monday
  let daysUntilMonday;
  if (dayOfWeek === 0) { // Sunday
    // If it's Sunday after 12:00 PM, use next Monday
    if (now.getHours() >= 12) {
      daysUntilMonday = 1;
    } else {
      daysUntilMonday = 1;
    }
  } else if (dayOfWeek === 1) { // Monday
    // If it's Monday, use next Monday (one week from today)
    daysUntilMonday = 7;
  } else {
    // Tuesday through Saturday
    daysUntilMonday = 8 - dayOfWeek;
  }
  
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0); // 12:00 AM
  
  return nextMonday.toISOString();
}

// Helper function to calculate the Sunday at 12:00 PM of the same week
function getWeekEndSunday(mondayStart: string): string {
  const monday = new Date(mondayStart);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6); // Add 6 days to get to Sunday
  sunday.setHours(12, 0, 0, 0); // 12:00 PM
  
  return sunday.toISOString();
}

export default function StartWill() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [schedulingMode, setSchedulingMode] = useState('prescribed'); // 'prescribed' or 'custom'
  const [willData, setWillData] = useState({
    startDate: '',
    endDate: '',
    what: '',
    why: '',
  });
  const [whatCharCount, setWhatCharCount] = useState(0);
  const [whyCharCount, setWhyCharCount] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  const createWillMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/wills', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: (will) => {
      // Invalidate all related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      
      // Add the creator's commitment
      addCommitmentMutation.mutate({
        willId: will.id,
        what: willData.what,
        why: willData.why,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addCommitmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(`/api/wills/${data.willId}/commitments`, {
        method: 'POST',
        body: JSON.stringify({
          what: data.what,
          why: data.why,
        })
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      
      toast({
        title: "Will Created!",
        description: "Will has been created and is pending review from other members.",
      });
      setLocation('/hub');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let startDateTime: string;
    let endDateTime: string;
    
    if (schedulingMode === 'prescribed') {
      // Use prescribed weekly schedule
      startDateTime = getNextMondayStart();
      endDateTime = getWeekEndSunday(startDateTime);
    } else {
      // Use custom dates from form
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const startDate = formData.get('startDate') as string;
      const startTime = formData.get('startTime') as string;
      const endDate = formData.get('endDate') as string;
      const endTime = formData.get('endTime') as string;

      // Combine date and time using utility function
      startDateTime = createDateTimeFromInputs(startDate, startTime);
      endDateTime = createDateTimeFromInputs(endDate, endTime);

      // Validation for custom dates
      const now = new Date();
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);

      if (start <= now) {
        toast({
          title: "Invalid Start Date",
          description: "Start date must be in the future",
          variant: "destructive",
        });
        return;
      }

      if (end <= start) {
        toast({
          title: "Invalid End Date",
          description: "End date must be after start date",
          variant: "destructive",
        });
        return;
      }
    }

    setWillData({ ...willData, startDate: startDateTime, endDate: endDateTime });
    setCurrentStep(2);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const what = formData.get('what') as string;

    if (!what.trim()) {
      toast({
        title: "Empty Commitment",
        description: "Please describe what you will do",
        variant: "destructive",
      });
      return;
    }

    setWillData({ ...willData, what: what.trim() });
    setCurrentStep(3);
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const why = formData.get('why') as string;

    if (!why.trim()) {
      toast({
        title: "Missing Motivation",
        description: "Please explain why this matters to you",
        variant: "destructive",
      });
      return;
    }

    const finalWillData = {
      ...willData,
      why: why.trim(),
      circleId: circle?.id,
    };

    // Create the will
    createWillMutation.mutate({
      title: finalWillData.what || "Group Goal",
      description: finalWillData.why || "Group commitment",
      startDate: finalWillData.startDate,
      endDate: finalWillData.endDate,
      circleId: finalWillData.circleId,
    });

    setWillData(finalWillData);
  };

  const handleCancel = () => {
    setLocation('/hub');
  };

  if (!circle) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">No Circle Found</h2>
          <p className="text-gray-600 mb-6">You need to be part of an Inner Circle to create a Will.</p>
          <Button onClick={() => setLocation('/inner-circle')}>
            Create or Join Circle
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center">
              <div className={`w-8 h-8 ${currentStep >= 1 ? 'bg-primary text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-sm font-semibold`}>
                1
              </div>
              <span className={`ml-2 text-sm ${currentStep >= 1 ? 'text-primary' : 'text-gray-600'} font-medium`}>When</span>
            </div>
            <div className={`w-8 h-0.5 ${currentStep >= 2 ? 'bg-primary' : 'bg-gray-300'}`}></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 ${currentStep >= 2 ? 'bg-primary text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-sm font-semibold`}>
                2
              </div>
              <span className={`ml-2 text-sm ${currentStep >= 2 ? 'text-primary' : 'text-gray-600'} font-medium`}>What</span>
            </div>
            <div className={`w-8 h-0.5 ${currentStep >= 3 ? 'bg-primary' : 'bg-gray-300'}`}></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 ${currentStep >= 3 ? 'bg-primary text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-sm font-semibold`}>
                3
              </div>
              <span className={`ml-2 text-sm ${currentStep >= 3 ? 'text-primary' : 'text-gray-600'} font-medium`}>Why</span>
            </div>
          </div>
        </div>
        
        {/* Step 1: Set Dates */}
        {currentStep === 1 && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Your Timeline</h2>
                <p className="text-gray-600">Choose your scheduling preference</p>
              </div>
              
              <form onSubmit={handleStep1Submit} className="space-y-8">
                {/* Scheduling Mode Selection */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-lg font-medium text-gray-900 mb-4">
                      Choose Your Schedule
                    </label>
                    <RadioGroup value={schedulingMode} onValueChange={setSchedulingMode} className="space-y-4">
                      <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <RadioGroupItem value="prescribed" id="prescribed" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="prescribed" className="cursor-pointer">
                            <div className="font-medium text-gray-900 mb-1">📅 Week Template</div>
                            <div className="text-sm text-gray-600">
                              Runs Monday 12:00 AM to Sunday 12:00 PM.
                            </div>
                          </Label>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <RadioGroupItem value="custom" id="custom" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="custom" className="cursor-pointer">
                            <div className="font-medium text-gray-900 mb-1">⚙️ Custom</div>
                            <div className="text-sm text-gray-600">
                              Pick your own start and end times.
                            </div>
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                {/* Prescribed Weekly Preview */}
                {schedulingMode === 'prescribed' && (
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <div>
                      <div className="font-medium text-gray-900 mb-2">Selected Schedule</div>
                      <div className="text-sm text-gray-700 space-y-1">
                        <div><strong>Start:</strong> {new Date(getNextMondayStart()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at 12:00 AM</div>
                        <div><strong>End:</strong> {new Date(getWeekEndSunday(getNextMondayStart())).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at 12:00 PM</div>
                        <div className="mt-2 text-xs text-gray-600">This is the schedule for your upcoming Will.</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom Date Inputs */}
                {schedulingMode === 'custom' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Start Date & Time */}
                      <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Start Date & Time</label>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                            <Input 
                              type="date" 
                              name="startDate"
                              required 
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                            <Input 
                              type="time" 
                              name="startTime"
                              required 
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* End Date & Time */}
                      <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-700 mb-3">End Date & Time</label>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                            <Input 
                              type="date" 
                              name="endDate"
                              required 
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                            <Input 
                              type="time" 
                              name="endTime"
                              required 
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
                
                <div className="flex justify-between">
                  <Button type="button" variant="ghost" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Next →
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        
        {/* Step 2: What Will You Do */}
        {currentStep === 2 && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">What would you like to do?</h2>
                <p className="text-gray-600">Cause it's as simple as wanting.</p>
              </div>
              
              <form onSubmit={handleStep2Submit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Want</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-900 pointer-events-none select-none font-normal text-sm leading-6">I will</span>
                    <Textarea 
                      name="what"
                      required 
                      rows={4} 
                      maxLength={50}
                      value={willData.what}
                      onChange={(e) => {
                        setWillData({ ...willData, what: e.target.value });
                        setWhatCharCount(e.target.value.length);
                      }}
                      className="w-full pl-16 pr-4 py-3 resize-none text-sm leading-6 font-normal" 
                      placeholder="call my grandmother this week"
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1 text-right">{whatCharCount} / 50</div>
                </div>

                
                <div className="flex justify-between">
                  <Button type="button" variant="ghost" onClick={() => setCurrentStep(1)}>
                    ← Back
                  </Button>
                  <Button type="submit">
                    Next →
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        
        {/* Step 3: Why */}
        {currentStep === 3 && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Why would you like to do this?</h2>
                <p className="text-gray-600">Remember this when it gets tough.</p>
              </div>

              {/* What Preview */}
              {willData.what && (
                <div className="mb-6 p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                  <p className="text-gray-900 font-medium text-center">
                    I will {willData.what}
                  </p>
                </div>
              )}
              
              <form onSubmit={handleStep3Submit} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Your Why</label>
                    <span className="text-xs text-gray-500 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Private - only you can see this
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-900 pointer-events-none select-none font-normal text-sm leading-6 z-10">Because </span>
                    <Textarea 
                      name="why"
                      required 
                      rows={4} 
                      maxLength={50}
                      value={willData.why}
                      onChange={(e) => {
                        setWillData({ ...willData, why: e.target.value });
                        setWhyCharCount(e.target.value.length);
                      }}
                      className="w-full pl-20 pr-4 py-3 resize-none text-sm leading-6 font-normal border-2 border-blue-200 focus:border-blue-400 bg-white/80" 
                      placeholder="I like how I feel after I talk to her"
                      style={{ 
                        lineHeight: '1.5',
                        paddingTop: '12px'
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1 text-right">{whyCharCount} / 50</div>
                </div>

                
                <div className="flex justify-between">
                  <Button type="button" variant="ghost" onClick={() => setCurrentStep(2)}>
                    ← Back
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createWillMutation.isPending || addCommitmentMutation.isPending}
                    className="bg-primary hover:bg-blue-600"
                  >
                    {createWillMutation.isPending || addCommitmentMutation.isPending ? 'Creating...' : 'Create Will →'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
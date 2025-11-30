import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, User, Shield, Settings, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountSettingsModal({ isOpen, onClose }: AccountSettingsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  
  useEffect(() => {
    if (isOpen && user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
    }
  }, [isOpen, user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: { firstName: string; lastName: string; email: string }) => {
      const res = await apiRequest('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      return await res.json();
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated",
        duration: 4000,
      });
      setFirstName(updatedUser.firstName);
      setLastName(updatedUser.lastName);
      setEmail(updatedUser.email);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
      const res = await apiRequest('/api/change-password', {
        method: 'POST',
        body: JSON.stringify(passwordData)
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed",
        duration: 4000,
      });
      const form = document.getElementById('change-password-form') as HTMLFormElement;
      if (form) form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const handleUpdateProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!firstName || !lastName || !email) {
      toast({
        title: "Error",
        description: "Please fill in all profile fields",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    updateProfileMutation.mutate({ firstName, lastName, email });
  };

  const handleChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "New password must be at least 6 characters long",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword, confirmPassword });
  };

  const deleteAccountMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest('/api/account', {
        method: 'DELETE',
        body: JSON.stringify({ password })
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted",
        duration: 4000,
      });
      setShowDeleteDialog(false);
      onClose();
      setTimeout(() => {
        setLocation('/auth');
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const handleDeleteAccount = () => {
    if (!deletePassword) {
      toast({
        title: "Error",
        description: "Please enter your password to confirm account deletion",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    deleteAccountMutation.mutate(deletePassword);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white px-5 pt-4 pb-3 border-b border-gray-100/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <Settings className="h-4 w-4 text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Account Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 active:scale-95"
              aria-label="Close"
              data-testid="button-close-settings"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="flex gap-2 p-1 bg-gray-100/70 rounded-xl">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm transition-all duration-200 ${
                activeTab === 'profile'
                  ? 'bg-white text-gray-900 font-semibold shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 font-medium'
              }`}
              data-testid="tab-profile"
            >
              <User className="h-4 w-4" />
              <span>Profile</span>
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm transition-all duration-200 ${
                activeTab === 'security'
                  ? 'bg-white text-gray-900 font-semibold shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 font-medium'
              }`}
              data-testid="tab-security"
            >
              <Shield className="h-4 w-4" />
              <span>Security</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-5">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">Profile Information</h3>
              </div>
              <div className="p-5">
                <form onSubmit={handleUpdateProfile} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-gray-600">First Name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        required
                        className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                        data-testid="input-profile-firstname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-gray-600">Last Name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                        required
                        className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                        data-testid="input-profile-lastname"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-600">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                      data-testid="input-profile-email"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-10 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium shadow-sm hover:shadow transition-all active:scale-[0.98]"
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-update-profile"
                  >
                    {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              {/* Change Password Card */}
              <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">Change Password</h3>
                </div>
                <div className="p-5">
                  <form id="change-password-form" onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-600">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          name="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Enter current password"
                          required
                          className="h-11 pr-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                        />
                        <button
                          type="button"
                          className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-sm font-medium text-gray-600">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          name="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          required
                          className="h-11 pr-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                        />
                        <button
                          type="button"
                          className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          aria-label={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-600">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          required
                          className="h-11 pr-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                        />
                        <button
                          type="button"
                          className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-10 rounded-lg border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-all active:scale-[0.98]"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={changePasswordMutation.isPending}
                        className="flex-1 h-10 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium shadow-sm hover:shadow transition-all active:scale-[0.98]"
                      >
                        {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Delete Account Card */}
              <div className="bg-red-50/50 rounded-xl border border-red-200/60 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-red-700 mb-1">Delete Account</h3>
                      <p className="text-sm text-red-600/80 leading-relaxed">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      data-testid="button-delete-account"
                      className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-sm transition-all active:scale-[0.98]"
                    >
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-gray-600">
                  This will permanently delete your account, all your Will commitments, progress, and Circle memberships. This action cannot be undone.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="deletePassword" className="text-sm font-medium text-gray-700">
                    Enter your password to confirm
                  </Label>
                  <Input
                    id="deletePassword"
                    type="password"
                    placeholder="Your password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-red-500 focus:ring-red-500/20 transition-all"
                    data-testid="input-delete-password"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel 
              onClick={() => {
                setDeletePassword("");
                setShowDeleteDialog(false);
              }}
              className="h-10 rounded-lg border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending || !deletePassword}
              className="h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
              data-testid="button-confirm-delete"
            >
              {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

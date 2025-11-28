import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

export default function Admin() {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading...</div>;
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to access this page.</p>
          <Link href="/inner-circle" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            Return to Circle
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
          <p className="text-gray-600">Internal testing and management tools</p>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Data Endpoints</h2>
            <div className="space-y-3">
              <div>
                <a 
                  href="/admin/users" 
                  target="_blank"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  /admin/users
                </a>
                <p className="text-sm text-gray-600">JSON list of all users</p>
              </div>
              <div>
                <a 
                  href="/admin/wills" 
                  target="_blank"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  /admin/wills
                </a>
                <p className="text-sm text-gray-600">JSON list of all active wills</p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Link href="/inner-circle" className="text-blue-600 hover:text-blue-800">
              ← Back to Circle
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
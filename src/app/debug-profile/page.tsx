"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export default function DebugProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        
        setProfile(profileData);
        console.log("Profile data:", profileData);
        console.log("Profile error:", error);
      }
      setLoading(false);
    };

    checkProfile();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!user) return <div>Not logged in</div>;

  const requiredFields = [
    "username",
    "fname", 
    "lname",
    "address",
    "contact_no",
    "birthday",
    "gender",
  ];

  const missingFields = requiredFields.filter(field => {
    const value = profile?.[field];
    return !value || value === null || value === undefined || value === "";
  });

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Profile Debug</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">User Info</h2>
          <p>Email: {user.email}</p>
          <p>ID: {user.id}</p>
          <p>Email Confirmed: {user.email_confirmed_at ? "Yes" : "No"}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Profile Status</h2>
          <p>Profile exists: {profile ? "Yes" : "No"}</p>
          {profile && (
            <div>
              <p>Missing fields: {missingFields.length}</p>
              {missingFields.length > 0 && (
                <div>
                  <p>Missing:</p>
                  <ul className="list-disc list-inside">
                    {missingFields.map(field => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold">Raw Profile Data</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

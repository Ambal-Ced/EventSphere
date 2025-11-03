import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export default async function AdminPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // NOOP: middleware will refresh session cookies when needed
          }
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", session.user.id)
    .single();

  if ((profile?.account_type as string | undefined) !== "admin") {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Restricted area for administrators</p>
      </div>

      <div className="border-b mb-6">
        <div className="flex gap-4">
          <button className="px-3 py-2 text-sm font-medium rounded-t-md bg-background border-b-2 border-primary">
            EventTria
          </button>
          <button className="px-3 py-2 text-sm font-medium rounded-t-md hover:text-primary">
            Feedback
          </button>
          <button className="px-3 py-2 text-sm font-medium rounded-t-md hover:text-primary">
            Account Review
          </button>
        </div>
      </div>

      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        This section is intentionally empty for now. Content coming soon.
      </div>
    </div>
  );
}


